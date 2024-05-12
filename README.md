# Docker-sync script

The script is used to sync project data between ghost (Windows) machine and Docker container

## Requirement

 - Windows 10+
 - Node.JS 16+
 - Docker

## Setup

Create a new disc w: in for windows `net use W: \\wsl.localhost\docker-desktop-data`

Install npm packages for watcher
`npm install`

## Configuring

All setting are in file `HostNodeWatcher.config.js`

## Usage

Run the script from folder where `docker-compose.yml` file is

`node watcher\HostNodeWatcher.js`

## Testing 

`npm run test`