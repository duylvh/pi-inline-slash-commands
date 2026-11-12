import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type AutocompleteItem,
	type AutocompleteProvider,
	type AutocompleteSuggestions,
	Editor,
	getKeybindings,
} from "@earendil-works/pi-tui";

const owned = new WeakSet<AutocompleteItem>();
const ORIGINALS = Symbol.for("inline-slash-commands.originals");

function inlineSlashQuery(textBeforeCursor: string): string | null {
	return textBeforeCursor.match(/(?:^|\s)\/([^\s/]*)$/)?.[1] ?? null;
}

function createProvider(current: AutocompleteProvider): AutocompleteProvider {
	return {
		async getSuggestions(lines, cursorLine, cursorCol, options): Promise<AutocompleteSuggestions | null> {
			const before = (lines[cursorLine] ?? "").slice(0, cursorCol);
			const query = inlineSlashQuery(before);
			const lineStartCommand = cursorLine === 0 && before.trimStart().startsWith("/");
			const builtinOwns = lineStartCommand && (query === null || before.trimStart() === `/${query}`);
			if (options.force || builtinOwns) {
				return current.getSuggestions(lines, cursorLine, cursorCol, options);
			}
			const result = query === null ? null : await current.getSuggestions([`/${query}`], 0, query.length + 1, options);
			if (!result || result.items.length === 0) {
				const fallback = await current.getSuggestions(lines, cursorLine, cursorCol, options);
				// Pi queues requests and each one reads the input when it runs, so a request our inline trigger started can
				// see "hi /mod " and get Pi's empty-prefix file list, which Pi never asks for without Tab.
				return fallback?.prefix === "" ? null : fallback;
			}
			for (const item of result.items) owned.add(item);
			return { items: result.items, prefix: `/${query}` };
		},

		applyCompletion(lines, cursorLine, cursorCol, item, prefix) {
			if (!owned.has(item)) {
				return current.applyCompletion(lines, cursorLine, cursorCol, item, prefix);
			}
			const line = lines[cursorLine] ?? "";
			const start = cursorCol - prefix.length;
			const after = line.slice(cursorCol);
			const insert = `/${item.value}${/^\s/.test(after) ? "" : " "}`;
			const newLines = [...lines];
			newLines[cursorLine] = line.slice(0, start) + insert + after;
			const consumed = start + `/${item.value} `.length;
			return { lines: newLines, cursorLine, cursorCol: consumed };
		},

		shouldTriggerFileCompletion(lines, cursorLine, cursorCol) {
			return current.shouldTriggerFileCompletion?.(lines, cursorLine, cursorCol) ?? true;
		},
	};
}

function patchEditor(): void {
	const proto = Editor.prototype as any;
	const originals = (proto[ORIGINALS] ??= {});
	for (const name of ["isAtStartOfMessage", "isInSlashCommandContext", "handleInput"]) {
		originals[name] ??= proto[name];
	}

	proto.isAtStartOfMessage = function (this: any) {
		if (originals.isAtStartOfMessage.call(this)) return true;
		const line: string = this.state.lines[this.state.cursorLine] ?? "";
		return inlineSlashQuery(line.slice(0, this.state.cursorCol)) === "";
	};

	proto.isInSlashCommandContext = function (this: any, text: string) {
		return originals.isInSlashCommandContext.call(this, text) || inlineSlashQuery(text) !== null;
	};

	proto.handleInput = function (this: any, data: string) {
		if (this.autocompleteState && this.autocompleteList && getKeybindings().matches(data, "tui.select.confirm")) {
			const selected = this.autocompleteList.getSelectedItem();
			if (selected && owned.has(selected)) {
				this.autocompleteList.onSelect(selected);
				return;
			}
		}
		return originals.handleInput.call(this, data);
	};
}

export default function (pi: ExtensionAPI): void {
	patchEditor();
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.addAutocompleteProvider(createProvider);
	});
}
