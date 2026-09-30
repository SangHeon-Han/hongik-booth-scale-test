#!/bin/bash
set -euo pipefail
# Run on a real macOS runner; substitute only the browser-opening command.
project_dir="$PWD"
test_dir=$(mktemp -d)
launcher_pid=''
cleanup() {
  if [[ -n "$launcher_pid" ]]; then
    kill "$launcher_pid" 2>/dev/null || true
    wait "$launcher_pid" 2>/dev/null || true
  fi
  rm -rf -- "$test_dir"
}
trap cleanup EXIT
mkdir "$test_dir/browser stub"
ln -s "$project_dir" "$test_dir/Booth project with spaces"
cat > "$test_dir/browser stub/open" <<'SH'
#!/bin/bash
printf '%s\n' "$1" >> "$BOOTH_BROWSER_LOG"
SH
chmod +x "$test_dir/browser stub/open"
export BOOTH_BROWSER_LOG="$test_dir/browser.log"
export PATH="$test_dir/browser stub:$PATH"
test -x "$project_dir/실행.command"
/bin/bash -n "$project_dir/실행.command"
cd "$test_dir"
"$test_dir/Booth project with spaces/실행.command" > "$test_dir/launcher.log" 2>&1 &
launcher_pid=$!
ready=false
for ((attempt=0;attempt<90;attempt++)); do
  if ! kill -0 "$launcher_pid" 2>/dev/null; then cat "$test_dir/launcher.log"; exit 1; fi
  if [[ -f "$BOOTH_BROWSER_LOG" ]]; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then cat "$test_dir/launcher.log"; exit 1; fi
curl --fail --silent http://127.0.0.1:4310/ | grep -q 'HICD 2026'
# A second launch opens the existing server and exits without starting another.
"$test_dir/Booth project with spaces/실행.command"
[[ $(wc -l < "$BOOTH_BROWSER_LOG") -eq 2 ]]
grep -q '^http://127.0.0.1:4310/$' "$BOOTH_BROWSER_LOG"
kill "$launcher_pid"
wait "$launcher_pid" || true
launcher_pid=''
if curl --silent --max-time 2 http://127.0.0.1:4310/ >/dev/null; then
  echo 'The launcher left its server running after termination.' >&2; exit 1
fi
printf 'macOS launcher: build, startup, spaced path, browser URL, reuse and shutdown passed.\n'
