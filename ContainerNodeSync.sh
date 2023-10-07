#!/bin/sh

# pathes
watcherLogPath="/watcher/logs/watcher.log"

# reset files on every run to keep them small
truncate -s0 $watcherLogPath

echo -e "Watcher init"

tail -f "$watcherLogPath" | while IFS="|" read action sourceFile destinationFile; do
	
	# echo -e "$action $sourceFile $destinationFile"
	
	currectTime=`date +%s`
	
	if [ "$action" == "cp" ] || [ "$action" == "mv" ]; then
		if [ -f "$sourceFile" ]; then
			if [ "$action" == "cp" ]; then
				sourceSha1sum=`sha1sum "$sourceFile" | cut -d " " -f 1`
				if [ -f "$destinationFile" ]; then
					destinationSha1sum=`sha1sum "$destinationFile" | cut -d " " -f 1`
				else
					destinationSha1sum=""
				fi
				
				if [ "$sourceSha1sum" != "$destinationSha1sum" ]; then
					# execute command don't show errors " || :" always return true
					(mkdir -p $(dirname "$destinationFile") && cp -p "$sourceFile" "$destinationFile") || :
					echo -e "$currectTime: cp -p $sourceFile $destinationFile"
				fi
			fi
			
			if [ "$action" == "mv" ]; then
				mv "$sourceFile" "$destinationFile" || :
				echo -e "$currectTime: mv $sourceFile $destinationFile"
			fi
		fi
	
	else
		if [ "$action" == "rm" ] && [ -f "$destinationFile" ]; then
			rm -f "$destinationFile" || :
			echo -e "$currectTime: rm -f $destinationFile"
		fi
		
		if [ "$action" == "mkdir" ] && [ ! -d "$destinationFile" ]; then
			mkdir -p "$destinationFile" || :
			echo -e "$currectTime: mkdir -p $destinationFile"
		fi
		
		if [ "$action" == "rmdir" ] && [ -d "$destinationFile" ]; then
			rm -rf "$destinationFile" || :
			echo -e "$currectTime: rm -rf $destinationFile"
		fi
	fi
	
done



