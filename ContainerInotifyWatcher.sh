#!/bin/sh

sourceDir="/app/"
destinationDir="/source/"
delayBetweenEventAndActionSecunds=1

inotifywait --recursive --monitor --event modify,move,create,delete "$sourceDir" | while read path action file; do
	
	if [ "$action" == "DELETE" ]; then
		prevActionFIlePath="$path$file"
		prevActionEcho="$eventTime $path $action $file"
		continue
	fi
	if [ "$prevActionFIlePath" != "" ]; then
		if [ "$action" != "CREATE" ] || [ "$prevActionFIlePath" != "$path$file" ]; then
			prevActionFIlePath=""
			echo "$prevActionEcho"
		fi
		prevActionFIlePath=""
	fi
	
	eventTime=`date +%s`
	echo "$eventTime $path $action $file"
	
done | while read eventTime path action file; do
	
	# echo "$eventTime $path $action $file"
	
	
	# Delay 2 seconds between event and action
	currectTime=`date +%s`
	delay=$(( $(( $eventTime )) + $delayBetweenEventAndActionSecunds - $(( $currectTime )) ))
	
	if [ $delay -gt 0 ]; then
		sleep $delay
		currectTime=`date +%s`
	fi
	
	
	sourceFile="$path$file"
	
	# exclude shadow creating for files: CREATE|/1/.#3.txt || DELETE|/1/.#3.txt when modify /1/3.txt file
	if ( [ "$action" == "CREATE" ] || [ "$action" == "DELETE" ] ) && [ "$sourceFile" != "${sourceFile/\/.\#/}" ]; then
		continue
	fi
	# ignore folders: /.git/, /.idea/
	if ( [ "$sourceFile" != "${sourceFile/\/.git\//}" ] || [ "$sourceFile" != "${sourceFile/\/.idea\//}" ] ); then
		continue
	fi
	
    destinationFile=`echo "$sourceFile" | sed -e "s~^${sourceDir}~${destinationDir}~g"`
	
	# echo -e '--------'
    # echo -e "$action $sourceFile $destinationFile"
	
	# files
	if ( [ "$action" == "MODIFY" ] || [ "$action" == "MOVED_TO" ] ) && [ -f "$sourceFile" ]; then
		sourceSha1sum=`sha1sum "$sourceFile" | cut -d " " -f 1`
		if [ -f "$destinationFile" ]; then
			destinationSha1sum=`sha1sum "$destinationFile" | cut -d " " -f 1`
		else
			destinationSha1sum=""
		fi
		if [ "$sourceSha1sum" != "$destinationSha1sum" ]; then 
			(mkdir -p $(dirname "$destinationFile") && cp -p "$sourceFile" "$destinationFile") || :
			echo -e "$currectTime: cp -p $sourceFile  $destinationFile"
		fi
	fi
	
	if ( [ "$action" == "DELETE" ] || [ "$action" == "MOVED_FROM" ] ) && [ -f "$destinationFile" ]; then
		rm -f "$destinationFile" || :
		echo -e "$currectTime: rm -f $destinationFile"
	fi
	
	# directories
	if ( [ "$action" == "CREATE,ISDIR" ] || [ "$action" == "MOVED_TO,ISDIR" ] ) && [ ! -d "$destinationFile" ]; then
		mkdir -p "$destinationFile" || :
		echo -e "$currectTime: mkdir -p $destinationFile"
	fi
	
	if ( [ "$action" == "DELETE,ISDIR" ] || [ "$action" == "MOVED_FROM,ISDIR" ] ) && [ -d "$destinationFile" ]; then
		rm -rf "$destinationFile" || :
		echo -e "$currectTime: rm -rf $destinationFile"
	fi
	
done