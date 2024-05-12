#!/usr/bin/node

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import child_process from 'child_process';
import configProd from "./HostNodeWatcher.config.js";
import configTest from "./HostNodeWatcher.config.testing.js";

const config = isTesting() ? configTest : configProd;

export function convertToLinuxNetworkPath(sourcePath, project) {
    const regexpCurrDir = new RegExp(windowsCurrentDirectoryPath(project), 'gi');

    return sourcePath?.replace(regexpCurrDir, getLinuxVolumesDirPath(project));
}

export function isTesting() {
    return process.env.NODE_ENV === 'test';
}

export function convertToWindowsNetworkPath(sourcePath, project) {
    const regexpCurrDir = new RegExp(getLinuxVolumesDirPath(project).replaceAll('\\', '\\\\'), 'gi');
    return sourcePath?.replace(regexpCurrDir, windowsCurrentDirectoryPath(project).replaceAll('\\\\', '\\'));
}

export function windowsCurrentDirectoryPath(project) {
    return config.windowsCurrentDirectoryRootPath + '\\\\' + project;
}

export function getLinuxVolumesDirPath(project) {
    return config.linuxVolumesDirPathTemplate.replace('{{project}}', project);
}

export function fileHash(filePath) {
    const hashSum = crypto.createHash('sha1');
    hashSum.update(fs.readFileSync(filePath));

    return hashSum.digest('hex');
}

// checks in docker file for volume "project_folder_name:/app"
export function findWindowsProjectsToWatch(forceScanProjects = false) {
    // if projects were added manually
    if (config.windowsProjectsToWatch.length && !forceScanProjects) {
        return config.windowsProjectsToWatch;
    }

    let windowsProjectsToWatchReturnArray = [];
    Object.keys(config.dockerComposeYml.services).forEach((dockerProject) => {
        if (config.dockerComposeYml.services[dockerProject]?.volumes) {
            config.dockerComposeYml.services[dockerProject]?.volumes.forEach((volume) => {
                // it must be only a named volume
                if (!volume.match(/^[\.\/]+/g) && volume.match(/.+?\:\/app$/gi)) {
                    const projectFolderName = volume.replace(':/app', '');

                    // check if such directories exist
                    if (fs.existsSync(windowsCurrentDirectoryPath(projectFolderName))) {
                        windowsProjectsToWatchReturnArray.push(projectFolderName);
                    }
                }
            });
        }
    });
    return windowsProjectsToWatchReturnArray;
}

export function getLinuxProjectsDirectoriesToWatch(project) {
    let hasSpecificProjectKeyInArray = false;
    let linuxProjectsDirectories = [];

    // respect empty array, means nothing to watch
    Object.keys(config.linuxProjectsToWatch).forEach((linuxProject) => {
        if (linuxProject === project) {
            linuxProjectsDirectories = config.linuxProjectsToWatch[linuxProject];
            hasSpecificProjectKeyInArray = true;

            return false;
        }
    });

    // if linuxProjectsDirectories has * append common rules from '*' element
    if (hasSpecificProjectKeyInArray && linuxProjectsDirectories.includes('*') && config.linuxProjectsToWatch?.['*'].length) {
        linuxProjectsDirectories = [...new Set([...linuxProjectsDirectories ,...config.linuxProjectsToWatch?.['*']])].filter((v) => {
            return v !== '*';
        });
    }

    // if no specific section use "common" rule
    if (!hasSpecificProjectKeyInArray && !linuxProjectsDirectories.length && config.linuxProjectsToWatch?.['*'].length) {
        linuxProjectsDirectories = config.linuxProjectsToWatch['*'];
    }

    // check if such directories exist in a linux volume
    if (!isTesting() && linuxProjectsDirectories.length) {
        linuxProjectsDirectories = linuxProjectsDirectories.filter((relativePath) => {
            if (fs.existsSync(getLinuxVolumesDirPath(project) + '\\' + relativePath)) {
                return true;
            }

            return false;
        });
    }

    return linuxProjectsDirectories;
}

// don't sync folders win -> linux which are in linuxProjectsToWatch array
export function excludeFoldersFromLinuxProjectsToWatch(path, project) {
    if (config.linuxProjectsToWatch[project]?.length) {
        for (const watcherPath of config.linuxProjectsToWatch[project]) {
            if (watcherPath !== '*' && path.includes('\\' + watcherPath)) {
                return true;
            }

            if (watcherPath === '*') {
                for (const watcherPathStar of config.linuxProjectsToWatch['*']) {
                    if (watcherPathStar !== '*' && path.includes('\\' + watcherPathStar)) {
                        return true;
                    }
                }
            }
        }
    } else {
        for (const watcherPath of config.linuxProjectsToWatch['*']) {
            if (watcherPath !== '*' && path.includes('\\' + watcherPath + '\\')) {
                return true;
            }
        }
    }

    return false;
}

export function excludeWindowsWatcherPaths(path, project) {
    for (let watcherPath of config.ignoreWindowsWatcherPaths) {
        if (watcherPath.startsWith('*')) {
            watcherPath = watcherPath.slice(1);
        } else {
            watcherPath = '\\' + project + (!watcherPath.startsWith('\\') ? '\\' : '') + watcherPath;
        }

        if (path.includes(watcherPath)) {
            return true;
        }
    }

    return false;
}

// this export function for linux directory watches
export function getFilesListInDirectoryRecursively(directoryPath, callback) {
    if (!fs.existsSync(directoryPath)) {
        return;
    }

    let results = [];
    fs.readdir(directoryPath, function (err, list) {
        if (err) {
            return callback(err);
        }

        let pending = list.length;
        if (!pending) {
            return callback(null, results);
        }

        list.forEach(function (file) {
            file = path.resolve(directoryPath, file);
            fs.stat(file, function (err, stat) {
                if (stat && stat.isDirectory()) {
                    getFilesListInDirectoryRecursively(file, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) {
                            callback(null, results);
                        }
                    });
                } else {
                    results.push(file);
                    if (!--pending) {
                        callback(null, results);
                    }
                }
            });
        });
    });
}

export function execEventCommand(eventName, sourcePath, targetPath, renamedToTargetPath, project, syncDirection = '->') {
    if (['change', 'add'].includes(eventName)) {
        if (fs.existsSync(sourcePath)) {
            let targetPathHash = '';

            if (fs.existsSync(targetPath)) {
                targetPathHash = fileHash(targetPath);
            }

            if (!targetPathHash || fileHash(sourcePath) !== targetPathHash) {
                fs.cpSync(sourcePath, targetPath);
                consoleLogEventCommand('C', sourcePath, null, project, syncDirection);

                return true;
            }
        }
    } else if (eventName === 'unlink') {
        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
            consoleLogEventCommand('D', null, targetPath, project, syncDirection);

            return true;
        }
    } else if (eventName === 'rename' || eventName === 'renameDir') {
        if (fs.existsSync(targetPath)) {
            fs.renameSync(targetPath, renamedToTargetPath);
            consoleLogEventCommand('R', sourcePath, renamedToTargetPath, project, syncDirection);

            return true;
        }
    } else if (eventName === 'addDir') {
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath);
            consoleLogEventCommand('C', null, targetPath, project, syncDirection);

            return true;
        }
    } else if (eventName === 'unlinkDir') {
        if (fs.existsSync(targetPath)) {
            fs.rmSync(targetPath, {recursive: true, force: true});
            consoleLogEventCommand('D', null, targetPath, project, syncDirection);

            return true;
        }
    }

    return false;
}

export function consoleLogEventCommand(eventName, sourcePath, targetPath = null, project, syncDirection = '->') {
    let sourceShortPath = '';
    let targetShortPath = '';

    if (sourcePath) {
        sourceShortPath = consoleLogAnyPathToShortPath(sourcePath);
    }

    if (targetPath) {
        targetShortPath = (sourceShortPath ? ' -> ' : '') +
            consoleLogAnyPathToShortPath(targetPath);
    }

    console.log('\x1b[90m%s: \x1b[0m \x1b[37m%s\x1b[0m %s %s', eventName, project, syncDirection, (sourceShortPath + targetShortPath));
}

export function consoleLogWindowsPathToShortName(sourcePath) {
    const shortPath = sourcePath.replace(config.windowsCurrentDirectoryRootPath.replaceAll('\\\\', '\\'), '');

    if (shortPath !== sourcePath) {
        return shortPath.replace(/^\\.+?\\/, "\\");
    }

    return shortPath;
}

export function consoleLogLinuxPathToShortName(sourcePath) {
    const linuxVolumesDirPathRegexp = config.linuxVolumesDirPathTemplate.replace('{{project}}', '.+?')
        .replaceAll('\\', '\\\\');
    const regExp = new RegExp(linuxVolumesDirPathRegexp, "ig");
    return sourcePath.replace(regExp, '');
}

export function consoleLogAnyPathToShortPath(sourcePath) {
    let shortPath = consoleLogWindowsPathToShortName(sourcePath);
    shortPath = consoleLogLinuxPathToShortName(shortPath);

    return shortPath;
}

let watcherOperationsPerSecondArray = [];
let watcherOperationsSpike = [];
let watcherMustBeReloaded = [];

export function incrementWatcherOperationsPerSecond(project) {
    if (isWatcherMustBeReloaded(project)) {
        return;
    }

    const timestamp = 'S' + Math.floor(Date.now() / 1000).toString();

    if (watcherOperationsPerSecondArray[project] === undefined) {
        watcherOperationsPerSecondArray[project] = [];
    }

    if (watcherOperationsPerSecondArray[project][timestamp] === undefined) {
        watcherOperationsPerSecondArray[project][timestamp] = 0;
    }

    watcherOperationsPerSecondArray[project][timestamp] += 1;
}

export function calculateIfWatcherMustBeReloaded(project) {
    let maxOperationsPerSecond = 0;

    if (watcherOperationsPerSecondArray[project]) {
        Object.entries(watcherOperationsPerSecondArray[project]).forEach(([, operationsPerSecond]) => {
            if (operationsPerSecond > maxOperationsPerSecond) {
                maxOperationsPerSecond = operationsPerSecond;
            }
        });
    }

    // If we have operations spike (git checkout)
    if (maxOperationsPerSecond > 5) {
        watcherOperationsSpike[project] = true;
    }

    // wait for idle to reload watcher
    if (watcherOperationsSpike[project]) {
        Object.entries(watcherOperationsPerSecondArray[project]).reverse().slice(0, 1).forEach(([time]) => {
            const timestampNow = Math.floor(Date.now() / 1000);
            const timestampTime = parseInt(time.replace('S', ''));

            if (timestampNow - timestampTime > 2) {
                watcherMustBeReloaded[project] = true;
            }
        });
    }
}

export function isWatcherMustBeReloaded(project) {
    return watcherMustBeReloaded[project] === true;
}

export function resetWatcherOperationsPerSecond(project) {
    watcherOperationsPerSecondArray[project] = [];
    watcherOperationsSpike[project] = false;
    watcherMustBeReloaded[project] = false;
}

export function playSystemBeep() {
    // windows
    if (process.platform === 'win32'){
        child_process.exec("powershell.exe [console]::beep(900,900)");
    }
    // mac
    else if (process.platform === 'darwin') {
        child_process.exec("afplay /System/Library/Sounds/Glass.aiff");
    }
}

// tests covered








