import YAML from "yaml";
import fs from 'fs';

let dockerComposeYml = [];

if (process.env.NODE_ENV !== 'test') {
    if (!fs.existsSync('w:\\data\\docker\\volumes')) {
        console.log('Fatal error: You need to create disc W:\\ bind to \\\\wsl.localhost\\docker-desktop-data.');
        console.log('Windows explorer: Network\\Linux\\docker-desktop-data, context menu, "Map network drive..."');
        process.exit();
    }

    if (!fs.existsSync('./docker-compose.yml')) {
        console.log('Fatal error: docker-compose.yml not found. You must run this script from projects root folder where docker-compose.yml is located');
        process.exit();
    }
    dockerComposeYml = YAML.parse(fs.readFileSync('./docker-compose.yml', 'utf8'));

    if (!dockerComposeYml.name || !Object.keys(dockerComposeYml.services).length) {
        console.log('Fatal error: docker-compose.yml doesn\'t have name or services property');
        process.exit();
    }
}

export default {
    dockerComposeYml,
    windowsCurrentDirectoryRootPath: process.cwd().replaceAll('\\', '\\\\'),
    linuxVolumesDirPathTemplate: 'w:\\data\\docker\\volumes\\' + dockerComposeYml.name + '_{{project}}\\_data',

    windowsProjectsToWatch: [
        'spd-mothership',
        // 'spd-orders',
        // 'spd-locations',
    ],
    ignoreWindowsWatcherPaths: [
        '*\\.git\\',
        '*\\.idea\\',
        '*\\node_modules\\',
        '\\resources\\js\\',
        '\\bootstrap\\cache\\',
        '\\storage\\framework\\',
        '\\storage\\debugbar\\',
        '\\extensions\\',
        '\\vendor\\',
    ],

    // linus -> windows watch (every 5 sec setInterval)
    linuxProjectsToWatch: {
        // project names here, empty array no sync
        'spd-locations': [
            '*', // includes/adds values from default
            'public\\shipping.log',
            'public\\delivery.log',
            'public\\pickup.log',
        ],
        // default if there is no specific rule
        '*': [
            'storage\\logs',
            // 'bootstrap\\cache',
        ]
    },

}