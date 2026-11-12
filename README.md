# pi-inline-slash-commands

Slash-command suggestions anywhere in the [pi](https://github.com/earendil-works/pi) prompt, like Claude Code.

Type `/` after a space, or at the start of any line, and pi opens the same command pane it shows for a `/` at the start of the input. The list and its order are pi's own, so commands, prompt templates and `skill:` entries all appear.

```
please review this /mod
→ model            <provider/model> — Select model (opens selector UI)
  skill:use-modern-go
  ...
```

- Enter or Tab fills in `/name ` where you typed it. An inline pick never submits the prompt.
- A `/` at the start of the message behaves exactly as before, so Enter still runs the command.
- Tab on a path such as `cat /Us` still completes files.

## Install

```sh
pi install git:github.com/duylvh/pi-inline-slash-commands
```

Or try it once with `pi -e git:github.com/duylvh/pi-inline-slash-commands`.

[pi-geek-tui](https://github.com/duylvh/pi-geek-tui) 0.2.1 and later draw inline suggestions in its own command panel.

## Limits

Pi runs a command or expands a skill only when the message starts with `/`. An inline `/skill:name` reaches the model as plain text.

## How it works

Pi refuses `/` as an extension trigger character, so the extension wraps the editor's slash-context checks on `Editor.prototype` and stacks an autocomplete provider that asks pi's built-in provider for `/query` suggestions. The prototype originals are kept under a `Symbol.for` key, so `/reload` never stacks wrappers.
