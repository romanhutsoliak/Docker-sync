import fs from 'fs';
import {describe, expect, it} from 'vitest';
import {
    calculateIfWatcherMustBeReloaded,
    consoleLogAnyPathToShortPath,
    consoleLogEventCommand,
    consoleLogLinuxPathToShortName,
    consoleLogWindowsPathToShortName,
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
    resetWatcherOperationsPerSecond,
    windowsCurrentDirectoryPath
} from "./HostNodeWatcher.helper.js";

const sourcePath = process.cwd() + '\\testing_environment\\linux\\sourceFile.txt';
const targetPath = process.cwd() + '\\testing_environment\\windows\\targetFile.txt';
const renamePath = process.cwd() + '\\testing_environment\\windows\\targetFile_renamed.txt';

const targetDirPath = process.cwd() + '\\testing_environment\\windows\\targetDir';
const renameDirPath = process.cwd() + '\\testing_environment\\windows\\targetDir_renamed.txt';

const project = 'projectName';

describe('helper', () => {
    it('handles windowsCurrentDirectoryPath', () => {
        const currentPath = windowsCurrentDirectoryPath(project);

        expect(currentPath).toBe('D:\\\\Roman\\\\webserver_v2\\\\spd-mothership9\\\\projectName');
    });

    it('handles getLinuxVolumesDirPath', () => {
        const linuxVolumesDirPath = getLinuxVolumesDirPath(project);

        expect(linuxVolumesDirPath).toBe('w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data');
    });

    it('handles convertToLinuxNetworkPath', () => {
        const linuxPath = convertToLinuxNetworkPath('D:\\Roman\\webserver_v2\\spd-mothership9\\projectName\\server.php', project);

        expect(linuxPath).toBe('w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data\\server.php');
    });

    it('handles convertToWindowsNetworkPath', () => {
        const windowsNetworkPath = convertToWindowsNetworkPath('w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data\\server.php', project);

        expect(windowsNetworkPath).toBe('D:\\Roman\\webserver_v2\\spd-mothership9\\projectName\\server.php');
    });

    it('handles fileHash', () => {
        const hash = fileHash('./testing_environment/fileHashTestFile.txt');

        expect(hash).toBe('40bd001563085fc35165329ea1ff5c5ecbdbbeef');
    });

    it('handles findWindowsProjectsToWatch when not empty windowsProjectsToWatch', () => {
        const projectsToWatch = findWindowsProjectsToWatch();

        expect(projectsToWatch).toStrictEqual(['dbd-mothership']);
    });

    it('handles findWindowsProjectsToWatch when empty windowsProjectsToWatch', () => {
        const projectsToWatch = findWindowsProjectsToWatch(true);

        expect(projectsToWatch).toStrictEqual(['spd-mothership', 'dbd-mothership']);
    });

    it('handles getLinuxProjectsDirectoriesToWatch', () => {
        expect(getLinuxProjectsDirectoriesToWatch('spd-mothership')).toStrictEqual([
            'public\\shipping.log',
            'public\\delivery.log',
            'public\\pickup.log',
            'storage\\logs',
            'bootstrap\\cache'
        ]);
        expect(getLinuxProjectsDirectoriesToWatch('dbd-mothership')).toStrictEqual(['storage\\logs', 'bootstrap\\cache', 'storage\\framework\\cache']);
        expect(getLinuxProjectsDirectoriesToWatch('emptyProject')).toStrictEqual([]);
        // expect(getLinuxProjectsDirectoriesToWatch('projectDoesntExistAsLinuxVolume')).toStrictEqual([]);
    });

    it('handles excludesFoldersFromLinuxProjectsToWatch', () => {
        const ignorePaths = [
            'storage\\logs\\laravel.log',
            'bootstrap\\cache\\packages.php',
        ];

        ignorePaths.forEach(function (path) {
            expect(excludeFoldersFromLinuxProjectsToWatch('D:\\Roman\\webserver_v2\\spd-mothership9\\custom\\' + path, 'custom'))
                .toBeTruthy();
        });

        ignorePaths.forEach(function (path) {
            expect(excludeFoldersFromLinuxProjectsToWatch('D:\\Roman\\webserver_v2\\spd-mothership9\\custom\\' + path, 'noSpecificProjectKey'))
                .toBeTruthy();
        });

        const ignorePathsWithStar = [
            'storage\\logs\\laravel.log',
            'bootstrap\\cache\\packages.php',
            'public\\shipping.log',
            'public\\delivery.log',
            'public\\pickup.log',
        ];

        ignorePathsWithStar.forEach(function (path) {
            expect(excludeFoldersFromLinuxProjectsToWatch('D:\\Roman\\webserver_v2\\spd-mothership9\\custom\\' + path, 'spd-mothership'))
                .toBeTruthy();
        });

        const eligiblePaths = [
            'app\\model\\Account.php',
            'app\\controllers\\AccountController.php',
            'storage\\app\\favicon.ico',
        ];

        eligiblePaths.forEach(function (path) {
            expect(excludeFoldersFromLinuxProjectsToWatch('D:\\Roman\\webserver_v2\\spd-mothership9\\custom\\' + path, 'custom'))
                .toBeFalsy();
        });
    });

    it('handles getFilesListInDirectoryRecursively', async () => {
        const sourcePath = process.cwd() + '\\testing_environment\\linux\\copyMeToWindows.txt';
        const sourcePath2 = process.cwd() + '\\testing_environment\\linux\\subDir\\copyMeToWindows2.txt';

        const targetPath = process.cwd() + '\\testing_environment\\windows\\copyMeToWindows.txt';
        const targetPath2 = process.cwd() + '\\testing_environment\\windows\\subDir\\copyMeToWindows2.txt';

        expect(fs.existsSync(sourcePath)).toBeTruthy();
        expect(fs.existsSync(targetPath)).toBeFalsy();
        expect(fs.existsSync(sourcePath2)).toBeTruthy();
        expect(fs.existsSync(targetPath2)).toBeFalsy();

        getFilesListInDirectoryRecursively(process.cwd() + '\\testing_environment\\linux', function (err, filesList) {
            filesList.map((sourcePath) => {
                const targetPath = sourcePath.replace('\\testing_environment\\linux\\', '\\testing_environment\\windows\\');

                // fs.writeFile(process.cwd() + '\\testing_environment\\linux\\log.txt', sourcePath + "\n" + targetPath, () => {});
                execEventCommand('change', sourcePath, targetPath, null, project);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 200));

        expect(fs.existsSync(sourcePath)).toBeTruthy();
        expect(fs.existsSync(targetPath)).toBeTruthy();
        expect(fs.existsSync(sourcePath2)).toBeTruthy();
        expect(fs.existsSync(targetPath2)).toBeTruthy();

        await new Promise(resolve => setTimeout(resolve, 100));

        // remove files for next testing
        fs.unlinkSync(targetPath);
        fs.unlinkSync(targetPath2);
        fs.rmSync(process.cwd() + '\\testing_environment\\windows\\subDir', {recursive: true, force: true});
    });

    // file operations
    it('handles execEventCommand add', () => {
        if (!fs.existsSync(sourcePath)) {
            fs.writeFileSync(sourcePath, "");
        }

        if (fs.existsSync(targetPath)) {
            fs.unlinkSync(targetPath);
        }

        expect(fs.existsSync(sourcePath)).toBeTruthy();
        expect(fs.existsSync(targetPath)).toBeFalsy();

        execEventCommand('add', sourcePath, targetPath, null, project);

        expect(fs.existsSync(sourcePath)).toBeTruthy();
        expect(fs.existsSync(targetPath)).toBeTruthy();
    });

    it('handles execEventCommand change', () => {
        if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
            fs.writeFileSync(sourcePath, "");

            execEventCommand('add', sourcePath, targetPath, null, project);
        }

        expect(fs.existsSync(sourcePath)).toBeTruthy();
        expect(fs.existsSync(targetPath)).toBeTruthy();
        expect(fileHash(sourcePath)).toBe(fileHash(targetPath));

        fs.writeFileSync(sourcePath, "123");

        expect(fileHash(sourcePath)).not.toBe(fileHash(targetPath));

        execEventCommand('change', sourcePath, targetPath, null, project);

        expect(fs.existsSync(targetPath)).toBeTruthy();
        expect(fileHash(sourcePath)).toBe(fileHash(targetPath));
    });

    it('handles execEventCommand rename', () => {
        if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, "");
        }

        expect(fs.existsSync(targetPath)).toBeTruthy();
        expect(fs.existsSync(renamePath)).toBeFalsy();

        execEventCommand('rename', sourcePath, targetPath, renamePath, project);

        expect(fs.existsSync(targetPath)).toBeFalsy();
        expect(fs.existsSync(renamePath)).toBeTruthy();

        // rename back
        execEventCommand('rename', sourcePath, renamePath, targetPath, project);

        expect(fs.existsSync(targetPath)).toBeTruthy();
        expect(fs.existsSync(renamePath)).toBeFalsy();
    });

    it('handles execEventCommand unlink', () => {
        if (!fs.existsSync(targetPath)) {
            fs.writeFileSync(targetPath, "");
        }

        expect(fs.existsSync(targetPath)).toBeTruthy();

        execEventCommand('unlink', sourcePath, sourcePath, null, project);
        execEventCommand('unlink', sourcePath, targetPath, null, project);

        expect(fs.existsSync(sourcePath)).toBeFalsy();
        expect(fs.existsSync(targetPath)).toBeFalsy();
    });
    // end file operations

    // folder operations
    it('handles execEventCommand add dir', () => {
        if (fs.existsSync(targetDirPath)) {
            fs.rmSync(targetDirPath, {recursive: true, force: true});
        }

        expect(fs.existsSync(targetDirPath)).toBeFalsy();

        execEventCommand('addDir', sourcePath, targetDirPath, null, project);

        expect(fs.existsSync(targetDirPath)).toBeTruthy();
    });

    it('handles execEventCommand rename dir', () => {
        if (!fs.existsSync(targetDirPath)) {
            fs.mkdirSync(targetDirPath);
        }

        expect(fs.existsSync(targetDirPath)).toBeTruthy();
        expect(fs.existsSync(renameDirPath)).toBeFalsy();

        execEventCommand('renameDir', sourcePath, targetDirPath, renameDirPath, project);

        expect(fs.existsSync(targetDirPath)).toBeFalsy();
        expect(fs.existsSync(renameDirPath)).toBeTruthy();

        // rename back
        execEventCommand('renameDir', sourcePath, renameDirPath, targetDirPath, project);

        expect(fs.existsSync(targetDirPath)).toBeTruthy();
        expect(fs.existsSync(renameDirPath)).toBeFalsy();
    });

    it('handles execEventCommand delete dir', () => {
        if (!fs.existsSync(targetDirPath)) {
            fs.mkdirSync(targetDirPath);
        }

        expect(fs.existsSync(targetDirPath)).toBeTruthy();

        execEventCommand('unlinkDir', sourcePath, targetDirPath, null, project);

        expect(fs.existsSync(targetDirPath)).toBeFalsy();
    });
    // end folder operations

    it('handles consoleLogWindowsPathToShortName', () => {
        expect(consoleLogWindowsPathToShortName('D:\\Roman\\webserver_v2\\spd-mothership9\\projectName\\server.php'))
            .toBe('\\server.php');
    });

    it('handles consoleLogLinuxPathToShortName', () => {
        expect(consoleLogLinuxPathToShortName('w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data\\server.php'))
            .toBe('\\server.php');
    });

    it('handles consoleLogAnyPathToShortPath', () => {
        expect(consoleLogAnyPathToShortPath('D:\\Roman\\webserver_v2\\spd-mothership9\\projectName\\server.php'))
            .toBe('\\server.php');

        expect(consoleLogAnyPathToShortPath('w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data\\server.php'))
            .toBe('\\server.php');
    });

    it('handles consoleLogEventCommand', () => {
        const windowsNetworkPath = 'D:\\Roman\\webserver_v2\\spd-mothership9\\projectName\\server.php';
        const linuxNetworkPath = 'w:\\data\\docker\\volumes\\spd-mothership9_projectName\\_data\\server.php';

        consoleLogEventCommand('C', windowsNetworkPath, linuxNetworkPath, project, '<-')
        // C: projectName -> \server.php -> \server.php
    });

    it('handles WatcherMustBeReloaded', async () => {
        //-- 1 sec
        incrementWatcherOperationsPerSecond(project);
        incrementWatcherOperationsPerSecond(project);
        incrementWatcherOperationsPerSecond(project);
        incrementWatcherOperationsPerSecond(project);
        incrementWatcherOperationsPerSecond(project);
        incrementWatcherOperationsPerSecond(project);

        await new Promise(resolve => setTimeout(resolve, 1000));
        calculateIfWatcherMustBeReloaded(project);
        expect(isWatcherMustBeReloaded(project)).toBeFalsy();

        //-- 2 sec
        await new Promise(resolve => setTimeout(resolve, 1000));
        calculateIfWatcherMustBeReloaded(project);
        expect(isWatcherMustBeReloaded(project)).toBeFalsy();

        //-- 3 sec
        await new Promise(resolve => setTimeout(resolve, 1000));
        calculateIfWatcherMustBeReloaded(project);
        expect(isWatcherMustBeReloaded(project)).toBeTruthy();

        // test reset
        resetWatcherOperationsPerSecond(project);
        expect(isWatcherMustBeReloaded(project)).toBeFalsy();
    });

    it('handles System beep', async () => {
        // playSystemBeep();
    });

    it('handles excludeWindowsWatcherPaths', async () => {
        const excludePaths = [
            'node_modules\\main.js',
            'start_with_star\\main.js',
            'some_folder_before\\start_with_star\\main.js',
            'some_folder_before\\some_folder_before2\\start_with_star\\main.js',
            '.idea\\project.file',
            'storage\\logs\\laravel.log',
            'vendor\\laravel\\index.php',
        ];
        excludePaths.forEach(function (path) {
            expect(excludeWindowsWatcherPaths('D:\\Roman\\webserver_v2\\spd-mothership9\\' + project + '\\' + path, project))
                .toBeTruthy();
        });

        const notExcludePaths = [
            'config\\app.php',
            'app\\Http\\Controllers\\AppController.php',
            'database\\migrations\\2012_03_14_200112_table_updates.php',
            'public\\vendor\\nova\\index.js',
        ];
        notExcludePaths.forEach(function (path) {
            expect(excludeWindowsWatcherPaths('D:\\Roman\\webserver_v2\\spd-mothership9\\' + project + '\\' + path, project))
                .toBeFalsy();
        });
    });

    // https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
    it('handles colors', async () => {
        // console.log('\x1b[0m%s\x1b[0m', 'Reset');
        // console.log('\x1b[1m%s\x1b[0m', 'Bright');
        // console.log('\x1b[2m%s\x1b[0m', 'Dim');
        // console.log('\x1b[4m%s\x1b[0m', 'Underscore');
        // console.log('\x1b[5m%s\x1b[0m', 'Blink');
        // console.log('\x1b[7m%s\x1b[0m', 'Reverse');
        // console.log('\x1b[8m%s\x1b[0m', 'Hidden');
        // console.log('\x1b[30m%s\x1b[0m', 'FgBlack');
        // console.log('\x1b[31m%s\x1b[0m', 'FgRed');
        // console.log('\x1b[32m%s\x1b[0m', 'FgGreen');
        // console.log('\x1b[33m%s\x1b[0m', 'FgYellow');
        // console.log('\x1b[34m%s\x1b[0m', 'FgBlue');
        // console.log('\x1b[35m%s\x1b[0m', 'FgMagenta');
        // console.log('\x1b[36m%s\x1b[0m', 'FgCyan');
        // console.log('\x1b[37m%s\x1b[0m', 'FgWhite');
        // console.log('\x1b[90m%s\x1b[0m', 'FgGray');
        // console.log('\x1b[40m%s\x1b[0m', 'BgBlack');
        // console.log('\x1b[41m%s\x1b[0m', 'BgRed');
        // console.log('\x1b[42m%s\x1b[0m', 'BgGreen');
        // console.log('\x1b[43m%s\x1b[0m', 'BgYellow');
        // console.log('\x1b[44m%s\x1b[0m', 'BgBlue');
        // console.log('\x1b[45m%s\x1b[0m', 'BgMagenta');
        // console.log('\x1b[46m%s\x1b[0m', 'BgCyan');
        // console.log('\x1b[47m%s\x1b[0m', 'BgWhite');
        // console.log('\x1b[100m%s\x1b[0m', 'BgGray');
    });
});
