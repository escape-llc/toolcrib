import { readdirSync, readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

/**
 * Loads every worked example under `ai-docs/examples/*.md` once, keyed by
 * filename minus extension (e.g. `router-integration`). The one-line
 * description for `list_examples()` is the first non-empty line of each
 * file's body, skipping its own top-level `# Title` heading if present.
 */
export function loadExamples(vendoredRoot) {
  const examplesDir = join(vendoredRoot, 'ai-docs', 'examples');
  let files = [];
  try {
    files = readdirSync(examplesDir).filter((f) => extname(f) === '.md');
  } catch {
    files = [];
  }

  const examples = new Map();
  for (const file of files) {
    const name = basename(file, '.md');
    const content = readFileSync(join(examplesDir, file), 'utf8');
    const bodyLines = content.split('\n').filter((l) => l.trim().length > 0);
    const firstNonHeading = bodyLines.find((l) => !l.trim().startsWith('#')) ?? '';
    examples.set(name, { name, description: firstNonHeading.trim(), content });
  }

  return {
    listExamples() {
      return [...examples.values()].map(({ name, description }) => ({ name, description }));
    },

    getExample(name) {
      return examples.get(name)?.content ?? null;
    },
  };
}
