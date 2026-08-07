#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { mergeCommand } from './commands/merge.js';
import { applyCommand } from './commands/apply.js';
import { doctorCommand } from './commands/doctor.js';
import { versionsCommand } from './commands/versions.js';

const program = new Command();

program
  .name('toolcrib')
  .description('Bootstrap and maintain the toolcrib UI toolkit in your project')
  .version('1.0.0');

program
  .command('init')
  .description('Stage installation of the toolkit into the current project (writes patches, does not apply)')
  .option('--version <version>', 'toolkit version to install', 'latest')
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
  // Setting exitCode alone isn't enough here: @clack/prompts' spinner runs
  // on a setInterval that keeps the event loop alive, so an unhandled
  // failure mid-spinner would otherwise hang the process indefinitely
  // instead of exiting with the failure code. Force it explicitly.
  process.exit(1);
}

program.parse();
