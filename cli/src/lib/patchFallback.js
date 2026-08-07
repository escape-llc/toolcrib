import fs from 'node:fs';
import path from 'node:path';
import { parsePatch, applyPatch } from 'diff';

/**
 * Last-resort patch application when git is unavailable and the user
 * declined to `git init`. Uses the same `diff` library already depended
 * on for patch generation, so no new dependency is introduced for this
 * fallback path. Less battle-tested than `git apply` against messy
 * real-world drift, which is why it's the fallback, not the default.
 */
export function applyPatchFallback(patchPath, projectRoot) {
  const patchText = fs.readFileSync(patchPath, 'utf-8');
  const [parsed] = parsePatch(patchText);

  const targetRelPath = parsed.newFileName.replace(/^b\//, '');
  const targetPath = path.join(projectRoot, targetRelPath);

  const isNewFile = parsed.oldFileName === '/dev/null';
  const currentContent = isNewFile ? '' : fs.readFileSync(targetPath, 'utf-8');

  const result = applyPatch(currentContent, parsed);
  if (result === false) {
    return { success: false, error: 'Patch did not apply cleanly against current file content.' };
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, result);
  return { success: true };
}
