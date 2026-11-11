#!/usr/bin/env bash
# NIW2-697 spike: run the color/capture/memory spike on the Mac mini and copy results back.
# Run from the M5:   ./run-on-macmini.sh [local-output-dir]     (default /tmp/niw2-697/results)
# Electron never runs on this machine. Screen capture needs Screen Recording permission, so
# the job runs under launchd with mise's node as the responsible process.
set -euo pipefail
cd "$(dirname "$0")"
LOCAL_OUT="${1:-/tmp/niw2-697/results}"
REMOTE=/tmp/niw2-697-spike
LABEL=dev.niw2-697.spike
SSH=(ssh -o BatchMode=yes macmini)
NODE_PATH_EXPORT='export PATH="$HOME/.local/share/mise/installs/node/24/bin:$HOME/.bun/bin:/opt/homebrew/bin:$PATH"'
ELECTRON='$HOME/Documents/Workspace/Agent/kaipu-record/apps/kaipu-record/node_modules/.bin/electron'

echo "== copy spike to the mini ($REMOTE)"
"${SSH[@]}" "launchctl remove $LABEL 2>/dev/null || true; rm -rf $REMOTE && mkdir -p $REMOTE/fixtures $REMOTE/out"
scp -o BatchMode=yes -q colormath.cjs decode.html renderer.js electron-spike.cjs launcher.cjs \
  make-fixtures.swift macmini:$REMOTE/
scp -o BatchMode=yes -q fixtures/g27fc-display.icc macmini:$REMOTE/fixtures/

echo "== generate fixtures on the mini (swift + ColorSync/sips)"
"${SSH[@]}" "cd $REMOTE && swiftc -O make-fixtures.swift -o fixtures-tool && ./fixtures-tool make $REMOTE/fixtures-gen $REMOTE/fixtures/g27fc-display.icc && ls -la $REMOTE/fixtures-gen"

echo "== write the job script"
"${SSH[@]}" "cat > $REMOTE/job.sh" <<JOB
#!/bin/zsh
$NODE_PATH_EXPORT
export SPIKE_FIXTURES=$REMOTE/fixtures-gen SPIKE_OUT=$REMOTE/out SPIKE_TOOL=$REMOTE/fixtures-tool SPIKE_REPS=3
export SPIKE_ELECTRON=$ELECTRON
node $REMOTE/launcher.cjs
# launchctl submit is KeepAlive: stay alive after the work so it is not restarted. Removed by the caller.
sleep 3600
JOB
"${SSH[@]}" "chmod +x $REMOTE/job.sh"

echo "== submit launchd job $LABEL"
"${SSH[@]}" "launchctl submit -l $LABEL -o $REMOTE/job.log -e $REMOTE/job.log -- /bin/zsh $REMOTE/job.sh"

echo "== polling for completion (max 10 min)"
done_flag=""
for _ in $(seq 1 120); do
  if "${SSH[@]}" "test -f $REMOTE/out/DONE"; then done_flag=yes; break; fi
  sleep 5
done
"${SSH[@]}" "tail -5 $REMOTE/job.log" || true
"${SSH[@]}" "launchctl remove $LABEL 2>/dev/null || true"
if [ -z "$done_flag" ]; then echo "TIMEOUT: job did not finish; log copied below" >&2; fi

echo "== copy results to $LOCAL_OUT"
mkdir -p "$LOCAL_OUT"
scp -o BatchMode=yes -q "macmini:$REMOTE/out/results-*.json" "macmini:$REMOTE/out/capture.png" \
  "macmini:$REMOTE/job.log" "$LOCAL_OUT/" || true
"${SSH[@]}" "pgrep -fl 'niw2-697-spike' || echo 'no leftover spike processes'"
[ -n "$done_flag" ] || exit 1
node summarize.cjs "$LOCAL_OUT"/results-*.json
