import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { buildServer } from '../server.js';

export function parseArgs(argv) {
  const args = { root: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') {
      args.root = argv[i + 1];
      i++;
    }
  }
  return args;
}

/**
 * Builds and connects the server, catching a build failure (most likely: no
 * vendored install found) into a clean stderr message + exit code instead of
 * an uncaught-exception stack trace. Kept separate from `index.js` (the bin
 * entry, unconditionally invoking this at the top level) so it's directly
 * unit-testable without needing an import-time self-invocation guard.
 *
 * `transport` is injectable (defaults to the real stdio one) so a unit test
 * can pass an in-memory transport instead — connecting the real
 * `StdioServerTransport` would attach to the test process's own actual
 * stdin/stdout, which is unsafe to do from inside a test run.
 */
export async function run(argv, { log = console.error, transport = new StdioServerTransport() } = {}) {
  const { root } = parseArgs(argv);

  let server;
  try {
    server = buildServer({ root });
  } catch (err) {
    // stderr, not stdout -- stdout is the MCP protocol channel itself once
    // a transport connects, and must never carry anything else.
    log(err.message);
    return 1;
  }

  await server.connect(transport);
  log('toolcrib-mcp: ready.');
  return 0;
}
