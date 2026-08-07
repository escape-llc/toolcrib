import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const isWindows = process.platform === 'win32';

/** Base options applied to every spawned git process. */
const baseOpts = (cwd) => ({
  cwd,
  windowsHide: true, // belt-and-suspenders against any console flash on Windows
  shell: isWindows,  // needed so Windows resolves the git.cmd shim correctly
});

/** Quick, buffered checks — output isn't meant for the user, just a yes/no/value. */
async function quietGit(args, cwd) {
  try {
    const { stdout } = await execFileAsync('git', args, baseOpts(cwd));
    return { ok: true, stdout: stdout.trim() };
  } catch (err) {
    return { ok: false, error: err };
  }
}

export async function isGitInstalled() {
  return (await quietGit(['--version'])).ok;
}

export async function isInsideGitRepo(cwd) {
  return (await quietGit(['rev-parse', '--is-inside-work-tree'], cwd)).ok;
}

export async function gitInit(cwd) {
  return quietGit(['init'], cwd);
}

/**
 * Streaming apply — the user should see git's own output live, especially
 * on failure (git apply's "patch does not apply" messages point at the
 * exact failing hunk, which is genuinely useful diagnostic info worth
 * surfacing rather than swallowing and reformatting).
 */
export function gitApplyStreaming(patchPath, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('git', ['apply', patchPath], {
      ...baseOpts(cwd),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    proc.stdout.on('data', (chunk) => process.stdout.write(chunk));
    proc.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });

    proc.on('close', (code) => {
      resolve(code === 0 ? { success: true } : { success: false, error: stderr.trim() });
    });

    proc.on('error', (err) => resolve({ success: false, error: err.message }));
  });
}

/**
 * Ensures a git repo is present before attempting `git apply`, offering to
 * initialize one on the spot rather than failing outright — this is the
 * common real-world gap (git installed, but the project itself was never
 * `git init`'d yet), not a platform limitation.
 */
export async function ensureGitRepo(cwd, { confirmFn }) {
  if (await isInsideGitRepo(cwd)) return true;
  if (!(await isGitInstalled())) return false;

  const shouldInit = await confirmFn('No git repository found here. Initialize one now?');
  if (!shouldInit) return false;

  const result = await gitInit(cwd);
  return result.ok;
}
