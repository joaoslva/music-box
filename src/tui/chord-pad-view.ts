import type { ChordPadState, PadDegree } from "../app/chord-pad.ts";
import { chordName, romanNumeral } from "../core/chord.ts";
import { keyName } from "../core/theory.ts";

const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const INVERSE = "\x1b[7m";
const INDENT = "    ";

/** Eight levels of block, for the suggestion-strength meter under each pad. */
const BARS = [" ", "▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"] as const;

const MIN_CELL = 6;
/** Past this the columns just get airy without reading better. */
const MAX_CELL = 8;
const PAD_COUNT = 7;

/** Trim plain text to fit, marking the cut. */
function truncate(text: string, max: number): string {
  if (max <= 0) return "";
  if (text.length <= max) return text;
  if (max === 1) return "…";
  return `${text.slice(0, max - 1)}…`;
}

/**
 * Render the chord pad as lines of text.
 *
 * A pure function of `(state, width)` -- no I/O, no cursor tracking, no cached
 * layout. That is what makes resize a non-event: it is a recompute with a
 * different number, not a special case with its own invalidation bugs. Every
 * line is built to fit the width given, so a narrow terminal degrades rather
 * than wrapping into nonsense.
 */
export function renderChordPad(state: ChordPadState, width: number): string[] {
  const lines: string[] = [];
  const avail = Math.max(0, width - INDENT.length);

  lines.push("", ...renderHeader(state, width), "");
  lines.push(...renderPads(state, width, avail));
  lines.push("");
  lines.push(...renderSounding(state, avail));
  lines.push("");
  lines.push(...renderSuggestions(state, width, avail));
  lines.push("");
  lines.push(...renderHelp(state, width, avail));

  return lines;
}

function renderHeader(state: ChordPadState, width: number): string[] {
  const titleText = "music-box · chord pad";
  const keyText = keyName(state.key);
  const title = `${BOLD}music-box${RESET} ${DIM}·${RESET} chord pad`;
  const keyLabel = `${CYAN}${keyText}${RESET}`;

  // Right-align the key against the title when there is room; below that give
  // it its own line rather than letting the header wrap.
  const gap = width - 2 - titleText.length - keyText.length;
  if (gap >= 2) return [`  ${title}${" ".repeat(gap)}${keyLabel}`];
  if (width >= titleText.length + 2) return [`  ${title}`, `  ${keyLabel}`];
  return [`  ${truncate(titleText, Math.max(0, width - 2))}`, `  ${keyLabel}`];
}

function barFor(weight: number, peak: number, held: boolean): string {
  // A held pad is the chord you are on, not a chord you might go to -- showing
  // it an empty meter reads as "weak suggestion" rather than "playing now".
  if (held) return "▮";
  if (weight <= 0) return "·";
  const level = peak > 0 ? weight / peak : 0;
  return BARS[Math.max(1, Math.round(level * (BARS.length - 1)))] ?? "·";
}

function padColour(pad: PadDegree, peak: number): string {
  if (pad.held) return `${INVERSE}${BOLD}`;
  if (pad.weight >= peak && peak > 0) return `${BOLD}${CYAN}`;
  if (pad.weight > 0) return CYAN;
  return DIM;
}

/**
 * The seven pads, with the suggestion strength drawn *under the key you would
 * press*. This is the point of the whole feature: the next chord should be
 * visible where your fingers are, not in a list you have to read across.
 */
function renderPads(state: ChordPadState, width: number, avail: number): string[] {
  const peak = Math.max(0, ...state.pads.map((p) => p.weight));
  const cell = Math.min(MAX_CELL, Math.floor(avail / PAD_COUNT));

  // Below the point where seven columns stay readable, stack them instead.
  if (cell < MIN_CELL) return renderPadsStacked(state, avail, peak);

  const numbers: string[] = [];
  const numerals: string[] = [];
  const names: string[] = [];
  const bars: string[] = [];

  for (const pad of state.pads) {
    const colour = padColour(pad, peak);
    const centre = (text: string) => {
      const clipped = truncate(text, cell - 1);
      const left = Math.floor((cell - clipped.length) / 2);
      return " ".repeat(Math.max(0, left)) + clipped +
        " ".repeat(Math.max(0, cell - clipped.length - left));
    };

    numbers.push(`${DIM}${centre(String(pad.degree + 1))}${RESET}`);
    numerals.push(`${colour}${centre(romanNumeral(pad.chord))}${RESET}`);
    names.push(`${colour}${centre(chordName(pad.chord))}${RESET}`);
    bars.push(`${pad.held ? BOLD + YELLOW : CYAN}${centre(barFor(pad.weight, peak, pad.held))}${RESET}`);
  }

  const rows = [numbers, numerals, names, bars].map((cells) => INDENT + cells.join(""));
  // The name row is dropped first when vertical space is tight rather than
  // horizontal -- callers with short terminals can slice it off.
  return rows;
}

function renderPadsStacked(
  state: ChordPadState,
  avail: number,
  peak: number,
): string[] {
  return state.pads.map((pad) => {
    const colour = padColour(pad, peak);
    const label = `${pad.degree + 1} ${romanNumeral(pad.chord).padEnd(5)}` +
      `${chordName(pad.chord).padEnd(6)}${barFor(pad.weight, peak, pad.held)}`;
    return `${INDENT}${colour}${truncate(label, avail)}${RESET}`;
  });
}

function renderSounding(state: ChordPadState, avail: number): string[] {
  if (state.sounding.length === 0) {
    return [`${INDENT}${DIM}${truncate("— press 1 to 7 —", avail)}${RESET}`];
  }

  return state.sounding.map((voice) => {
    const numeral = romanNumeral(voice.chord);
    const name = chordName(voice.chord);
    const pitches = voice.pitches.join(" ");

    // Columns first, then whatever room is left goes to the pitch list.
    const numeralCell = numeral.padEnd(Math.min(8, avail));
    const rest = avail - numeralCell.length;
    const nameCell = truncate(name, Math.max(0, Math.min(9, rest))).padEnd(
      Math.max(0, Math.min(9, rest)),
    );
    const pitchCell = truncate(pitches, Math.max(0, rest - nameCell.length));

    return (
      `${INDENT}${BOLD}${YELLOW}${numeralCell}${RESET}` +
      `${BOLD}${nameCell}${RESET}${DIM}${pitchCell}${RESET}`
    );
  });
}

function renderSuggestions(state: ChordPadState, width: number, avail: number): string[] {
  const label = "next   ";
  const room = avail - label.length;
  if (room < 6) return [];

  const lines: string[] = [];
  const cells: string[] = [];
  let used = 0;

  for (const suggestion of state.suggestions) {
    const plain = `${romanNumeral(suggestion.chord)} ${(suggestion.weight * 100).toFixed(0)}%`;
    const cost = plain.length + (cells.length > 0 ? 3 : 0);
    if (used + cost > room) break;
    used += cost;
    cells.push(
      `${romanNumeral(suggestion.chord)} ${DIM}${(suggestion.weight * 100).toFixed(0)}%${RESET}`,
    );
  }

  if (cells.length > 0) {
    lines.push(`${INDENT}${DIM}next${RESET}   ${cells.join("   ")}`);
  }

  const reason = state.suggestions[0]?.reason;
  if (reason && width >= 40) {
    lines.push(`${INDENT}   ${DIM}${truncate(reason, Math.max(0, avail - 3))}${RESET}`);
  }

  return lines;
}

function renderHelp(state: ChordPadState, width: number, avail: number): string[] {
  const quit = `${INDENT}${DIM}${truncate("esc or ctrl-c to quit", avail)}${RESET}`;

  // Below this the hint lines stop being readable, so show only what fits.
  if (width < 48) {
    return [
      `${INDENT}${DIM}${truncate(`1-7 chord   oct ${state.octave}`, avail)}${RESET}`,
      "",
      quit,
    ];
  }

  const settings =
    `q ${state.extension}  w ${state.suspension}  ` +
    `e voice-leading ${state.voiceLeading ? "on" : "off"}`;
  const controls = `- = key   \\ major/minor   , . octave ${state.octave}   r reset`;

  return [
    `${INDENT}${DIM}${truncate("1…7 chord    shift borrowed    ctrl secondary", avail)}${RESET}`,
    `${INDENT}${DIM}${truncate(settings, avail)}${RESET}`,
    `${INDENT}${DIM}${truncate(controls, avail)}${RESET}`,
    "",
    quit,
  ];
}
