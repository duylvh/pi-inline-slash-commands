#!/usr/bin/env bash
# Drives a real pi TUI in tmux with only this extension loaded and checks what the input pane shows.
set -euo pipefail
cd "$(dirname "$0")/.."
ext="$PWD/index.ts"
work="$(mktemp -d)"
mkdir -p "$work/somedir"
session="inline-slash-smoke-$$"
failures=0

tmux new-session -d -s "$session" -x 110 -y 30 "cd '$work' && pi -ne -e '$ext' --no-session"
trap 'tmux kill-session -t "$session" 2>/dev/null; rm -rf "$work"' EXIT
sleep "${PI_BOOT_SECONDS:-8}"

screen() { tmux capture-pane -t "$session" -p; }
type_text() { tmux send-keys -t "$session" -l "$1"; sleep 0.8; }
key() { tmux send-keys -t "$session" "$@"; sleep 0.8; }
reset_input() { key Escape; key C-c; }
check() {
	local name="$1" pattern="$2" want="$3"
	if screen | grep -q -- "$pattern"; then got=present; else got=absent; fi
	if [ "$got" = "$want" ]; then echo "ok   $name"; else echo "FAIL $name ($pattern is $got)"; screen | tail -12; failures=$((failures + 1)); fi
}

type_text 'please review this /mod'
check "inline /mod opens the command pane" "model .*Select model" present
key Enter
check "Enter fills the command" "please review this /model" present
check "Enter does not open the pane again" "Select model" absent
reset_input

type_text 'asdasdasd /'
check "inline / opens the command pane" "Open settings menu" present
key BSpace
check "Backspace over / closes the pane" "Open settings menu" absent
check "Backspace over / shows no file list" "somedir/" absent
reset_input

type_text 'hi /mod '
check "space after the token closes the pane" "Select model" absent
check "space after the token shows no file list" "somedir/" absent
reset_input

type_text '/mod'
check "line-start /mod still opens the built-in pane" "model .*Select model" present
reset_input

type_text '/model '
check "line-start /model argument completion still works" "claude-.*anthropic" present
reset_input

[ "$failures" -eq 0 ] && echo "tmux smoke ok" || { echo "$failures failure(s)"; exit 1; }
