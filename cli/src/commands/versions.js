import * as p from '@clack/prompts';
import { listVersions } from '../lib/github.js';

export async function versionsCommand() {
  p.intro('toolcrib versions');

  const spinner = p.spinner();
  spinner.start('Fetching release list');
  const versions = await listVersions();
  spinner.stop(`Found ${versions.length} release(s)`);

  for (const v of versions) {
    const date = new Date(v.publishedAt).toLocaleDateString();
    p.log.message(`  v${v.version}${v.prerelease ? ' (prerelease)' : ''}  —  ${date}`);
  }

  p.outro('Use `toolcrib init --version <x.y.z>` to install a specific version.');
}
