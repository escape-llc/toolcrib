import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const isWindows = process.platform === 'win32';

/** Base options applied to every spawned git process. */
const baseOpts = (cwd, shell = false) => ({
  cwd,
  windowsHide: true, // belt-and-suspenders against any console flash on Windows
  shell,
});

/**
 * Git is run WITHOUT a shell first, on every platform. Windows resolves a
 * bare `git` to git.exe through the normal PATH search, and with no shell
 * there is nothing to interpret a path like `C:\a&b\x.patch`: a project
 * directory containing `&` or `%` used to be handed to cmd.exe as command
 * syntax (#831). Only if that fails with ENOENT (git reachable solely
 * through a git.cmd shim) do we retry through a shell, with every argument
 * double-quoted and anything cmd.exe would still expand rejected outright.
 */
const shouldRetryWithShell = (err) => isWindows && err && err.code === 'ENOENT';

export function shellSafeArgs(args) {
  for (const a of args) {
    if (/["%\r\n]/.test(a)) {
      throw new Error(`Refusing to pass an argument containing a quote, %, or newline through cmd.exe: ${a}`);
    }
  }
  // A run of backslashes right before the closing quote would escape it
  // under Windows argument parsing, so a trailing run is doubled.
  return args.map((a) => `"${a.replace(/(\\+)$/, '$1$1')}"`);
}

/** Quick, buffered checks — output isn't meant for the user, just a yes/no/value. */
async function quietGit(args, cwd) {
  try {
    const { stdout } = await execFileAsync('git', args, baseOpts(cwd));
    return { ok: true, stdout: stdout.trim() };
  } catch (err) {
    if (shouldRetryWithShell(err)) {
      try {
        const { stdout } = await execFileAsync('git', shellSafeArgs(args), baseOpts(cwd, true));
        return { ok: true, stdout: stdout.trim() };
      } catch (retryErr) {
        return { ok: false, error: retryErr };
      }
    }
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
export async function gitApplyStreaming(patchPath, cwd) {
  const first = await spawnApply(['apply', patchPath], cwd, false);
  if (first.enoent && isWindows) {
    try {
      return await spawnApply(shellSafeArgs(['apply', patchPath]), cwd, true);
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return first;
}

function spawnApply(args, cwd, shell) {
  return new Promise((resolve) => {
    const proc = spawn('git', args, {
      ...baseOpts(cwd, shell),
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

    proc.on('error', (err) => resolve({ success: false, error: err.message, enoent: err.code === 'ENOENT' }));
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
