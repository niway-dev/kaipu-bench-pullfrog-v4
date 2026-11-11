#!/usr/bin/env bash
# NIW2-697 spike: run the Vision spike on the Mac mini, copy results back.
set -euo pipefail
cd "$(dirname "$0")"
REMOTE=/tmp/niw2-697-vision
LOCAL_OUT=/tmp/niw2-697/vision-results
P='export PATH="/opt/homebrew/bin:$PATH"'
ssh -o BatchMode=yes macmini "$P; rm -rf $REMOTE && mkdir -p $REMOTE/src"
scp -o BatchMode=yes -q ./*.swift ./run.sh macmini:$REMOTE/src/
ssh -o BatchMode=yes macmini "$P; chmod +x $REMOTE/src/run.sh && $REMOTE/src/run.sh $REMOTE/out"
mkdir -p "$LOCAL_OUT"
scp -o BatchMode=yes -q macmini:$REMOTE/out/results-*.json macmini:$REMOTE/out/machine.txt "$LOCAL_OUT/"
echo "copied to $LOCAL_OUT"
