#!/usr/bin/node

import fs from 'fs';
import Watcher from 'watcher'; // https://www.npmjs.com/package/watcher
import {
    calculateIfWatcherMustBeReloaded,
    convertToLinuxNetworkPath,
    convertToWindowsNetworkPath,
    excludeFoldersFromLinuxProjectsToWatch,
    excludeWindowsWatcherPaths,
    execEventCommand,
    fileHash,
    findWindowsProjectsToWatch,
    getFilesListInDirectoryRecursively,
    getLinuxProjectsDirectoriesToWatch,
    getLinuxVolumesDirPath,
    incrementWatcherOperationsPerSecond,
    isWatcherMustBeReloaded,
    playSystemBeep,
    resetWatcherOperationsPerSecond,
    windowsCurrentDirectoryPath
} from "./HostNodeWatcher.helper.js";

console.log('Node watcher init:');

// windows -> linus watch
const windowsProjectsToWatch = findWindowsProjectsToWatch();
const watcherDescriptors = [];

// watch for projects changes
windowsProjectsToWatch.forEach((project) => {
    // if no docker volume skip sync
    if (!fs.existsSync(getLinuxVolumesDirPath(project))) {
        console.log('Docker volume not found: ' + getLinuxVolumesDirPath(project));
        return;
    }

    // windows to linux
    createWatcher(project);

    console.log('- Windows watcher init for ' + project);

    // linux to windows
    const linuxProjectsDirectoriesToWatch = getLinuxProjectsDirectoriesToWatch(project);
    if (linuxProjectsDirectoriesToWatch.length) {
        let linuxProjectsSourcePathHashes = [];

        function copyLinuxToWindowsFn(sourcePath) {
            // cache file sourcePath hash for performance and reduce disc read
            if (
                !linuxProjectsSourcePathHashes[sourcePath] ||
                (fs.existsSync(sourcePath) && fileHash(sourcePath) !== linuxProjectsSourcePathHashes[sourcePath])
            ) {
                const targetPath = convertToWindowsNetworkPath(sourcePath, project);
                execEventCommand('change', sourcePath, targetPath, null, project, '<-');

                linuxProjectsSourcePathHashes[sourcePath] = fileHash(sourcePath);
            }
        }

        setInterval(() => {
			try {
				linuxProjectsDirectoriesToWatch.forEach((relativePath) => {
					const fullPath = getLinuxVolumesDirPath(project) + '\\' + relativePath;
					if (fs.lstatSync(fullPath).isDirectory()) {
						getFilesListInDirectoryRecursively(fullPath, function (err, filesList) {
							if (err) {
								throw err;
							}
							filesList.map((sourcePath) => copyLinuxToWindowsFn(sourcePath));
						});
					} else {
						copyLinuxToWindowsFn(fullPath);
					}
				});
			} catch (exception) {
				playSystemBeep();

				console.log('--- exception linux ---');
				console.log(exception);
			}
        }, 5000);

        console.log('- Linux watcher init for ' + project);
        console.log(linuxProjectsDirectoriesToWatch);
    }
	
    console.log('');
});

setInterval(() => {
    windowsProjectsToWatch.forEach((project) => {
        calculateIfWatcherMustBeReloaded(project);

        if (isWatcherMustBeReloaded(project)) {
            resetWatcherOperationsPerSecond(project);

            // restart file watcher
            createWatcher(project);
        }
    });
}, 1000);

function createWatcher(project) {
    if (watcherDescriptors[project] !== undefined && !watcherDescriptors[project].isReady()) {
        console.log('');
        console.log('--- Watcher is not ready: ' + project);

        return;
    }

    if (watcherDescriptors[project] !== undefined && !watcherDescriptors[project].isClosed()) {
        console.log('');
        console.log('\x1b[32m%s\x1b[0m', '--- Restarted watcher for: ' + project);

        watcherDescriptors[project].close();
    }

    watcherDescriptors[project] = new Watcher(windowsCurrentDirectoryPath(project), {
        ignoreInitial: false,
        recursive: true,
        renameDetection: true,
        ignore: (path) => {
            if (excludeWindowsWatcherPaths(path, project)) {
                return true;
            }

            return false;
        }
    }, (eventName, sourcePath, renamedToPath) => {
        // don't interrupt on error
        try {
            if (excludeFoldersFromLinuxProjectsToWatch(sourcePath, project) && ['change', 'add', 'rename'].includes(eventName)) {
                return;
            }

            const targetPath = convertToLinuxNetworkPath(sourcePath, project);
            const renamedToTargetPath = renamedToPath ? convertToLinuxNetworkPath(renamedToPath, project) : null;
            const operationWasPerformed = execEventCommand(eventName, sourcePath, targetPath, renamedToTargetPath, project);

            if (operationWasPerformed) {
                incrementWatcherOperationsPerSecond(project);
            }
        } catch (exception) {
            playSystemBeep();

            console.log('--- exception windows ---');
            console.log(exception);
        }
    }).watchPollingOnce();
}