// Reads the data the website keeps as class fields in its page components (`FAM = [...]` in
// Services.jsx and so on) without running or changing the website: find the field, take the
// literal up to its matching bracket, and evaluate it as plain data. Anything that isn't plain
// data (JSX, a reference to another field) fails loudly, so the seed never guesses.
import fs from "node:fs";

// The end of the literal that opens at `start` (a "[" or "{"), skipping strings, template
// literals and comments.
function literalEnd(src, start) {
  const open = src[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < src.length && src[i] !== c; i++) if (src[i] === "\\") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      i = src.indexOf("\n", i);
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i = src.indexOf("*/", i) + 1;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        if (c !== close) throw new Error(`Unbalanced literal at ${start}`);
        return i + 1;
      }
    }
  }
  throw new Error(`No end for the literal at ${start}`);
}

/** The value of the class field `name` in the file, e.g. field(file, "FAM"). */
export function field(file, name) {
  const src = fs.readFileSync(file, "utf8");
  const m = new RegExp(`^  ${name} = ([\\[{])`, "m").exec(src);
  if (!m) throw new Error(`${name} not found in ${file}`);
  const start = m.index + m[0].length - 1;
  const text = src.slice(start, literalEnd(src, start));
  try {
    return new Function(`"use strict"; return (${text});`)();
  } catch (e) {
    throw new Error(`${name} in ${file} isn't plain data: ${e.message}`);
  }
}
