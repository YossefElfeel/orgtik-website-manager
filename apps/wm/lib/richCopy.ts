/** Keep website formatting and dynamic slots outside the editable text runs. */
export function copyParts(value: string) {
  return value.split(/(<\/?[a-z][a-z0-9]*\/?>|\{\d+\})/gi).map((text) => ({
    text,
    fixed: /^(<\/?[a-z][a-z0-9]*\/?>|\{\d+\})$/i.test(text),
  }));
}

export function readableCopy(value: string, fixedValues: string[] = []) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\{(\d+)\}/g, (_, index) => fixedValues[Number(index)] ?? "…");
}

/** The words an editor can change, with the website's formatting kept out of the input. */
export const copyText = (value: string) => copyParts(value).filter(part => !part.fixed).map(part => part.text).join("");

/** Apply a whole-heading edit while retaining every formatting token in its original order. */
export function replaceCopyText(source: string, text: string) {
  const parts = copyParts(source);
  const owners: number[] = [];
  const before = parts.flatMap((part, index) => {
    const chars = part.fixed ? [] : Array.from(part.text);
    owners.push(...chars.map(() => index));
    return chars;
  });
  const after = Array.from(text);
  const result = parts.map(part => part.fixed ? part.text : "");
  const emptyOwner = parts.findIndex((part, index) => !part.fixed && index > 0 && /^<[a-z]/i.test(parts[index - 1].text));
  const append = (char: string, index: number) => {
    const owner = owners[index] ?? owners.at(-1) ?? (emptyOwner < 0 ? 0 : emptyOwner);
    result[owner] += char;
  };
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    append(after[start], start);
    start++;
  }
  let end = 0;
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++;
  const oldLength = before.length - start - end;
  const newLength = after.length - start - end;
  // Normal typing changes a tiny middle range. Bound work for unusually large pasted headings.
  if (oldLength * newLength > 1_000_000) {
    for (let j = 0; j < newLength; j++) append(after[start + j], start + Math.floor(j * oldLength / newLength));
  } else {
    const width = newLength + 1;
    const matches = new Uint32Array((oldLength + 1) * width);
    for (let i = oldLength - 1; i >= 0; i--) for (let j = newLength - 1; j >= 0; j--) {
      matches[i * width + j] = before[start + i] === after[start + j]
        ? 1 + matches[(i + 1) * width + j + 1]
        : Math.max(matches[(i + 1) * width + j], matches[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (j < newLength) {
      if (i < oldLength && before[start + i] === after[start + j]) {
        append(after[start + j++], start + i++);
      } else if (i < oldLength && matches[(i + 1) * width + j] > matches[i * width + j + 1]) {
        i++;
      } else {
        const position = start + i;
        append(after[start + j++], position > 0 && parts[owners[position - 1]].text.trim() ? position - 1 : position);
      }
    }
  }
  for (let j = after.length - end; j < after.length; j++) append(after[j], before.length - (after.length - j));
  return result.join("");
}
