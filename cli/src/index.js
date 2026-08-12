#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { mergeCommand } from './commands/merge.js';
import { applyCommand } from './commands/apply.js';
import { doctorCommand } from './commands/doctor.js';
import { versionsCommand } from './commands/versions.js';

const program = new Command();

// Without this, commander resolves `--version` anywhere in argv against the
// root program's own auto `-V, --version` flag before it ever reaches a
// subcommand — so `toolcrib init --version 1.2.3` silently printed the CLI's
// own version and exited instead of running init. Positional mode scopes an
// option to whichever command it's written after, letting `init`'s own
// `--version <version>` (a different thing: the toolkit version to install)
// coexist with the root flag.
program.enablePositionalOptions();

program
  .name('toolcrib')
  .description('Bootstrap and maintain the toolcrib UI toolkit in your project')
  .version('1.0.0');

program
  .command('init')
  .description('Stage installation of the toolkit into the current project (writes patches, does not apply)')
  .option('--version <version>', 'toolkit version to install', 'latest')
  .option(
    '--situation <situation>',
    'also stage the matching AGENTS.md/CLAUDE.md doc block: "new" (greenfield project) or "refactor" (adopting into an existing app)'
  )
  .action(async (options) => {
    await initCommand(options).catch(fail);
  });

program
  .command('merge')
  .description('Stage an update from the currently installed version to another version')
  .option('--version <version>', 'target toolkit version', 'latest')
  .action(async (options) => {
    await mergeCommand(options).catch(fail);
  });

program
  .command('apply')
  .description('Apply all staged patches in ./toolcrib-patches/')
  .action(async () => {
    await applyCommand().catch(fail);
  });

program
  .command('doctor')
  .description('Check installed files for local drift and available updates (read-only)')
  .action(async () => {
    await doctorCommand().catch(fail);
  });

program
  .command('versions')
  .description('List available toolkit releases')
  .action(async () => {
    await versionsCommand().catch(fail);
  });

function fail(err) {
  console.error(`\nError: ${err.message}`);
  process.exitCode = 1;
  // Setting exitCode alone isn't always enough: a codepath that leaves a
  // spinner's setInterval running (rather than stopping it before the
  // error propagates — see each command's own try/catch around its
  // fetchRelease() calls) would otherwise hang the process indefinitely.
  // But calling process.exit() immediately is worse: it force-closes every
  // libuv handle synchronously, and on Windows this crashes with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" whenever a
  // handle — concretely, the global fetch()/undici socket every command
  // here uses to hit the GitHub API — is still mid-close from a normal
  // failure a moment earlier. An unref'd, delayed force-exit gives normal
  // handles time to close on their own first: if nothing else is pending,
  // Node exits on its own before the timer ever fires; if something truly
  // is stuck, the timer (which doesn't itself keep the process alive)
  // still guarantees termination.
  const forceExit = setTimeout(() => process.exit(1), 2000);
  forceExit.unref();
}

program.parse();
