/**
 * Text input helper: wraps the Douyin keyboard API (tt.showKeyboard) into a
 * single prompt-style call. Only one prompt may be active at a time; starting
 * a new prompt cancels the previous one.
 */

declare const tt: any;

export interface PromptOptions {
  /** Text shown in the input when the keyboard opens. */
  defaultValue?: string;
  /** Maximum character count. Defaults to 24. */
  maxLength?: number;
  /** Called with the final text when the user confirms or dismisses. */
  onDone: (value: string) => void;
  /** Called if the prompt is cancelled programmatically. */
  onCancel?: () => void;
}

let active: PromptOptions | null = null;
let latestValue = '';
let finished = false;

function handleInput(res: any): void {
  if (res && typeof res.value === 'string') latestValue = res.value;
}

function handleConfirm(res: any): void {
  if (res && typeof res.value === 'string') latestValue = res.value;
  finish(latestValue);
}

function handleComplete(res: any): void {
  if (res && typeof res.value === 'string') latestValue = res.value;
  // Keyboard dismissed (back gesture etc.) — treat as done with latest text.
  if (!finished) finish(latestValue);
}

function unregister(): void {
  try {
    if (typeof tt.offKeyboardInput === 'function') tt.offKeyboardInput(handleInput);
    if (typeof tt.offKeyboardConfirm === 'function') tt.offKeyboardConfirm(handleConfirm);
    if (typeof tt.offKeyboardComplete === 'function') tt.offKeyboardComplete(handleComplete);
  } catch {
    /* platform without keyboard events */
  }
}

function finish(value: string): void {
  if (finished || !active) return;
  finished = true;
  const cb = active.onDone;
  active = null;
  unregister();
  try {
    if (typeof tt.hideKeyboard === 'function') tt.hideKeyboard();
  } catch {
    /* ignore */
  }
  cb(value);
}

/** Cancel the active prompt without calling onDone. */
export function dismissPrompt(): void {
  if (!active) return;
  const cb = active.onCancel;
  active = null;
  finished = true;
  unregister();
  try {
    if (typeof tt.hideKeyboard === 'function') tt.hideKeyboard();
  } catch {
    /* ignore */
  }
  cb?.();
}

/**
 * Show the platform keyboard and collect a line of text.
 * Falls back to the default value immediately when no keyboard API exists.
 */
export function promptText(opts: PromptOptions): void {
  dismissPrompt();
  active = opts;
  latestValue = opts.defaultValue ?? '';
  finished = false;
  try {
    if (typeof tt === 'undefined' || typeof tt.showKeyboard !== 'function') {
      finish(latestValue);
      return;
    }
    tt.showKeyboard({
      defaultValue: latestValue,
      maxLength: opts.maxLength ?? 24,
      multiple: false,
      confirmHold: false,
      confirmType: 'done',
    });
    tt.onKeyboardInput(handleInput);
    tt.onKeyboardConfirm(handleConfirm);
    tt.onKeyboardComplete(handleComplete);
  } catch {
    finish(latestValue);
  }
}
