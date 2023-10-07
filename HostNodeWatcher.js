#!/usr/bin/node

// https://www.npmjs.com/package/watcher
import Watcher from 'watcher';
import fs from 'fs'; 


const hostCurrentDirrectoryRootPath = process.cwd().replaceAll('\\', '\\\\');
const containerSoursePath = '/source';
const containerDestinationPath = '/app';
const hostWatcherLogDirPathTemplate = './docker/watcher/{{project}}';
const hostWatcherLogPathTemplate = hostWatcherLogDirPathTemplate + '/watcher.log';


console.log('Node watcher init');
let hostProjectsToWatch = [
	// 'project-folder',
];
findHostProjectsToWatch(hostCurrentDirrectoryRootPath);
console.log(hostProjectsToWatch);


// watch for projects changess
hostProjectsToWatch.forEach(function(project) {
	if (!fs.existsSync(hostWatcherLogDirPath(project))) {
		fs.mkdirSync(hostWatcherLogDirPath(project));
	}
	new Watcher( hostCurrentDirrectoryPath(project), {
			ignoreInitial: false,
			recursive: true,
			renameDetection: true,
			ignore: (path) => {
				if (path.includes('\\.git\\')) {
					return true;
				}
				if (path.includes('\\vendor\\')) {
					return true;
				}
				if (path.includes('\\node_modules\\')) {
					return true;
				}
				if (path.includes('\\.idea\\')) {
					return true;
				}
				return false;
			}
		}, ( eventName, targetPath, renamedToPath ) => {
			console.log ( Date.now() + ': ' + eventName ); // => could be any target event: 'add', 'addDir', 'change', 'rename', 'renameDir', 'unlink' or 'unlinkDir'
			// => the file system path where the event took place, this is always provided
			console.log ( convertToUnixRelativePath(targetPath, project) ); 
			// => the file system path "targetPath" got renamed to, this is only provided on 'rename'/'renameDir' events
			console.log ( convertToUnixRelativePath(renamedToPath || null, project) ); 
			
			let unixExecCommand = createUnixExecCommand(eventName, targetPath, renamedToPath, project);
			if (unixExecCommand) {
				fs.appendFileSync(hostWatcherLogPath(project), unixExecCommand + "\n");
			}
		}); 
});


// Helper functions
// ---------------------------------------------------------------------------------------------------
function convertToUnixRelativePath(path, project) {
	const regexpCurrDir = new RegExp(hostCurrentDirrectoryPath(project), 'gi');
	return path?.replace(regexpCurrDir, '').replaceAll('\\', '/');
}

function hostCurrentDirrectoryPath(project) {
	return hostCurrentDirrectoryRootPath + '\\\\' + project;
}

function hostWatcherLogDirPath(project) {
	return hostWatcherLogDirPathTemplate.replace('{{project}}', project);
}

function hostWatcherLogPath(project) {
	return hostWatcherLogPathTemplate.replace('{{project}}', project);
}

function findHostProjectsToWatch(dirPathLevel1) {
	// if projects were added manually
	if (hostProjectsToWatch.length) {
		return;
	}
	
	let filesLevel2, dirPathLevel2, filesLevel3, dirPathLevel3, filesLevel4, dirPathLevel4;
	
	const filesLevel1 = fs.readdirSync(dirPathLevel1, { withFileTypes: true });
	
	filesLevel1.forEach(function (filesObgectLevel2) {
		dirPathLevel2 = filesObgectLevel2.path + '\\\\' + filesObgectLevel2.name;
		if (filesObgectLevel2.isDirectory()) {
			filesLevel3 = fs.readdirSync(dirPathLevel2, { withFileTypes: true });
			filesLevel3.forEach(function (filesObgectLevel3) {
				if (filesObgectLevel3.name == '.git') {
					hostProjectsToWatch.push(filesObgectLevel2.name);
					return false;
				}
			});
		}
	});
};

function createUnixExecCommand(eventName, targetPath, renamedToPath, project) {
	targetPath = convertToUnixRelativePath(targetPath, project);
	if (['change', 'add'].includes(eventName)) {
		return 'cp|' + containerSoursePath + targetPath + '|' + containerDestinationPath + targetPath;
	}
	if (eventName == 'unlink') {
		return 'rm||' + containerDestinationPath + targetPath;
	}
	if (eventName == 'rename' || eventName == 'renameDir') {
		renamedToPath = convertToUnixRelativePath(renamedToPath || null, project);
		return 'mv|' + containerSoursePath + targetPath + '|' + containerDestinationPath + renamedToPath;
	}
	if (eventName == 'addDir') {
		return 'mkdir||' + containerDestinationPath + targetPath;
	}
	if (eventName == 'unlinkDir') {
		return 'rmdir||' + containerDestinationPath + targetPath;
	}
	
	return null;
}
