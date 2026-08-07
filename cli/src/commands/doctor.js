import path from 'node:path';
import * as p from '@clack/prompts';
import { fetchRelease } from '../lib/release.js';
import { normalize } from '../lib/patches.js';
import { readLock, readTextIfExists } from '../lib/project.js';
import { listVersions } from '../lib/github.js';

const TOOLKIT_DIR = './toolcrib';

/**
 * Reports drift without staging any patches — a read-only diagnostic.
 * "No drift" here answers a different question than "are you on the
 * latest version," which is checked separately below; the two are
 * deliberately not conflated (see design notes).
 */
export async function doctorCommand() {
  const projectRoot = process.cwd();
  p.intro('toolcrib doctor');

  const lock = readLock(projectRoot);
  if (!lock) {
    p.log.error('No toolcrib install found. Run `toolcrib init` first.');
    process.exitCode = 1;
    return;
  }

  const spinner = p.spinner();
  spinner.start(`Checking against installed version v${lock.version}`);
  const release = await fetchRelease(lock.version);

  const drifted = [];
  for (const relPath of release.allFiles()) {
    const targetPath = path.join(projectRoot, TOOLKIT_DIR, relPath);
    const local = readTextIfExists(targetPath);
    const shipped = release.readFile(relPath);
    if (normalize(local) !== normalize(shipped)) {
      drifted.push(relPath);
    }
  }
  await release.cleanup();
  spinner.stop('Drift check complete');

  if (drifted.length === 0) {
    p.log.success(`No local drift detected from v${lock.version}.`);
  } else {
    p.log.warn(
      `${drifted.length} file(s) differ from the shipped v${lock.version}:\n` +
        drifted.map((f) => `  ${f}`).join('\n')
    );
  }

  const versions = await listVersions();
  const newest = versions.find((v) => !v.prerelease);
  if (newest && newest.version !== lock.version) {
    p.log.info(`A newer version is available: v${newest.version} (installed: v${lock.version}). Run 'toolcrib merge'.`);
  } else {
    p.log.info('You are on the latest release.');
  }

  p.outro('Done.');
}
