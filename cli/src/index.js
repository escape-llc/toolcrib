#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { mergeCommand } from './commands/merge.js';
import { applyCommand } from './commands/apply.js';
import { doctorCommand } from './commands/doctor.js';
import { versionsCommand } from './commands/versions.js';

// Read at runtime instead of a JSON import assertion: `assert { type: 'json' }`
// vs `with { type: 'json' }` differs across the Node 18-22 range this CLI's
// `engines.node >= 18` promises to support, so plain fs avoids picking a
// syntax that breaks on some of those versions.
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

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
  // Commander auto-adds -V/--version at the top level; without a custom
  // description it just says "output the version number" with no
  // indication of WHICH version. This is a real, confirmed source of
  // confusion: an agent runs `toolcrib --version`, gets this CLI package's
  // own npm version (e.g. "0.4.0"), and has no reason to suspect that
  // number is unrelated to the toolkit content release `init`/`merge`'s
  // own --version flag targets (a completely separate, independently-
  // versioned GitHub Release) -- then reuses the wrong number there. The
  // *parsing* collision between these two same-named flags was already
  // fixed via enablePositionalOptions() above; this is the remaining
  // *semantic* one -- disambiguated right in the text an agent actually
  // reads when it checks.
  .version(
    packageJson.version,
    '-V, --version',
    "output this CLI tool's own npm package version -- unrelated to the toolkit content version (see `toolcrib init --version`/`toolcrib versions`)"
  );

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
  .option(
    '--reprint-managed-block [docId]',
    're-print the current managed block(s) to stdout, for re-injecting into an agent session that lost the primer to context compaction; optionally scope to one docId (core/new-app/refactor-app)'
  )
  .action(async (options) => {
    await doctorCommand(options).catch(fail);
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
