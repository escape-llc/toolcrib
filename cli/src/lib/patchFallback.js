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

  const isDeletedFile = parsed.newFileName === '/dev/null';
  // A deletion's real target is its *source* name (oldFileName) — newFileName
  // is /dev/null itself for a deletion, so falling through to the same
  // newFileName-based path resolution used for create/update would target
  // a literal "/dev/null" path inside the project instead of the file
  // actually being removed.
  const targetRelPath = (isDeletedFile ? parsed.oldFileName : parsed.newFileName).replace(/^[ab]\//, '');
  const targetPath = path.join(projectRoot, targetRelPath);

  // Defense in depth: every relPath this CLI itself writes into a patch
  // header comes from its own vendored file list or fixed strings
  // (package.json, .gitignore, ...), never from anything an attacker
  // controls directly — but nothing enforced that at the point a patch is
  // actually applied. Rejecting a resolved target outside projectRoot here
  // means a corrupted, hand-edited, or (in a worse scenario) tampered
  // patch file can't be used to write outside the project regardless of
  // how it got that path, rather than relying solely on every upstream
  // producer of a patch file staying honest.
  const resolvedRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(resolvedRoot + path.sep)) {
    return { success: false, error: `Refusing to apply patch: target path "${targetRelPath}" resolves outside the project root.` };
  }

  if (isDeletedFile) {
    if (!fs.existsSync(targetPath)) {
      // Already gone (e.g. a re-run after a partial previous apply) —
      // the end state this patch wants is already true, not a failure.
      return { success: true };
    }
    fs.rmSync(targetPath);
    return { success: true };
  }

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
