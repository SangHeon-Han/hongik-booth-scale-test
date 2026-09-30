#!/bin/bash
# Compatible with the Bash 3.2 included with macOS.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"

booth_url='http://127.0.0.1:4310/'
booth_pid=''
cleanup() {
  local status=$?
  trap - EXIT
  if [[ -n "$booth_pid" ]]; then
    kill "$booth_pid" 2>/dev/null || true
    wait "$booth_pid" 2>/dev/null || true
  fi
  if [[ "$status" -ne 0 && "$status" -ne 130 && -t 0 ]]; then
    printf '\nPress Return to close this window. '
    read -r _ || true
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT TERM HUP
fail() { printf '\n%s\n' "$1" >&2; exit 1; }
open_booth() {
  if ! open "$booth_url"; then
    printf 'Open this address in your browser: %s\n' "$booth_url"
  fi
}

if booth_page=$(curl --silent --max-time 2 "$booth_url" 2>/dev/null); then
  case "$booth_page" in
    *'HICD 2026'*) open_booth; exit 0 ;;
    *) fail 'Port 4310 is used by another application. Close that application and try again.' ;;
  esac
fi

command -v node >/dev/null 2>&1 || fail 'Install Node.js LTS from https://nodejs.org, then reopen this launcher.'
command -v npm >/dev/null 2>&1 || fail 'npm is missing. Reinstall Node.js LTS from https://nodejs.org.'
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>22?0:1)' \
  || fail 'Node.js 20.19+ or 22.12+ is required. Install a supported LTS version.'

if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  printf 'Installing dependencies...\n'
  npm ci --no-fund --no-audit || fail 'Dependency installation failed. Check your internet connection and try again.'
fi
npm run build || fail 'Build failed. See the message above.'
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4310 --strictPort >server.log 2>server-error.log &
booth_pid=$!
booth_attempt=0
while [[ "$booth_attempt" -lt 40 ]]; do
  kill -0 "$booth_pid" 2>/dev/null || fail 'Server could not start. See server-error.log.'
  booth_page=$(curl --silent --max-time 1 "$booth_url" 2>/dev/null) || booth_page=''
  case "$booth_page" in
    *'HICD 2026'*)
      open_booth
      printf '\nBooth Scale Test is running at %s\nKeep this window open. Press Ctrl+C to stop.\n' "$booth_url"
      wait "$booth_pid"
      exit 0
      ;;
  esac
  booth_attempt=$((booth_attempt+1))
  sleep .25
done
fail 'The server did not become ready. See server-error.log.'
