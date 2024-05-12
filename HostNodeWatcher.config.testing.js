
let dockerComposeYml = {
    version: '3.9',
    name: 'spd-mothership9',
    services: {
        ngrok: {
            image: 'ngrok/ngrok:alpine',
            volumes: ['./docker/ngrok/ngrok.yml:/etc/ngrok.yml'],
            networks: ['default'],
        },
        'nginx-proxy': {
            image: 'jwilder/nginx-proxy:alpine',
            volumes: [
                './docker/nginx-proxy/ssl:/etc/nginx/certs',
                './docker/nginx-proxy/nginx-config.conf:/etc/nginx/conf.d/nginx-config.conf',
                '/var/run/docker.sock:/tmp/docker.sock:ro',
            ],
        },
        spd: {
            build: [Object],
            volumes: ['spd-mothership:/app'],
        },
        dbd: {
            build: [Object],
            environment: [Array],
            volumes: ['dbd-mothership:/app'],
        },
        dbz: {
            build: [Object],
            volumes: ['dbz-mothership:/app'],
        }
    },
    volumes: {
        'spd-mothership': null,
        'spd-orders': null,
        'spd-locations': null
    }
};

export default {
    dockerComposeYml,
    windowsCurrentDirectoryRootPath: 'D:\\\\Roman\\\\webserver_v2\\\\' + dockerComposeYml.name,
    linuxVolumesDirPathTemplate: 'w:\\data\\docker\\volumes\\' + dockerComposeYml.name + '_{{project}}\\_data',

    windowsProjectsToWatch: [
        'dbd-mothership',
    ],
    ignoreWindowsWatcherPaths: [
        '\\.git\\',
        '\\.idea\\',
        '\\storage\\logs\\',
        '\\storage\\framework\\',
        '\\vendor\\',
        '\\node_modules\\',
        '*\\start_with_star\\',
    ],

    // linus -> windows watch (every 5 sec setInterval)
    linuxProjectsToWatch: {
        // project names here, empty array no sync
        'emptyProject': [],
        'projectDoesntExistAsLinuxVolume': [
            'storage\\logs',
            'bootstrap\\cache',
            'storage\\framework\\cache',
        ],
        'dbd-mothership': [
            'storage\\logs',
            'bootstrap\\cache',
            'storage\\framework\\cache',
        ],
        'spd-mothership': [
            '*',
            'public\\shipping.log',
            'public\\delivery.log',
            'public\\pickup.log',
            'storage\\logs',
            'bootstrap\\cache',
        ],
        // default if there is no specific rule
        '*': [
            'storage\\logs',
            'bootstrap\\cache',
        ]
    }
}