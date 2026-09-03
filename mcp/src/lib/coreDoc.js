import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEADING_RE = /^(#{2,3})\s+(.*)$/;

/**
 * Splits CORE.md into `{ heading, level, content }` sections on `##`/`###`
 * boundaries, so `get_core_doc(section?)` can return one section instead of
 * the whole ~484-line file every time. Content before the first heading
 * (the title line and the "Reading strategy" callout) is kept under a
 * synthetic `null`-heading section so nothing is silently dropped.
 */
export function loadCoreDoc(vendoredRoot) {
  const corePath = join(vendoredRoot, 'ai-docs', 'CORE.md');
  const raw = readFileSync(corePath, 'utf8');
  const lines = raw.split('\n');

  const sections = [];
  let current = { heading: null, level: 0, lines: [] };

  for (const line of lines) {
    const match = HEADING_RE.exec(line);
    if (match) {
      sections.push(current);
      current = { heading: match[2].trim(), level: match[1].length, lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);

  const finalized = sections.map((s) => ({
    heading: s.heading,
    level: s.level,
    content: s.lines.join('\n').trim(),
  }));

  return {
    fullText: raw,

    listSections() {
      return finalized.filter((s) => s.heading).map(({ heading, level }) => ({ heading, level }));
    },

    getSection(heading) {
      if (!heading) return raw;
      // Substring match, not exact equality: real CORE.md headings carry a
      // leading number and sometimes an emoji (e.g. "3. ⛔ Anti-Patterns —
      // DO NOT Generate These") that a caller guessing at a section name
      // from its meaning, not its literal text, shouldn't need to know.
      const needle = heading.toLowerCase();
      const found = finalized.find((s) => s.heading?.toLowerCase().includes(needle));
      return found ? found.content : null;
    },
  };
}
