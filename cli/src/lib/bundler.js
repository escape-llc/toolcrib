import fs from 'node:fs';
import path from 'node:path';

/**
 * Read-only signals to sniff for each bundler/framework — a config file on
 * disk, or a package.json dependency (checked across both "dependencies"
 * and "devDependencies", since e.g. `vite` is conventionally a devDependency
 * but nothing stops someone declaring it otherwise). Order matters: more
 * specific frameworks (Next.js wraps webpack; CRA wraps webpack) are
 * checked before the generic "webpack" entry so a Next.js project reports
 * as Next.js, not webpack.
 *
 * `note` is doctor-only guidance specific to that tool's actual sharp edge
 * with this toolkit — not a generic "you're using X" announcement. `null`
 * means detection succeeded but there's nothing this toolkit needs to warn
 * about for that tool (e.g. Vite, since the toolkit was built against it
 * and has no outstanding Vite-specific requirement — see safeProps.ts's
 * bundler-agnostic dev-check).
 */
const BUNDLER_SIGNALS = [
  {
    id: 'next',
    label: 'Next.js',
    configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    packageDeps: ['next'],
    note:
      "Next.js's App Router treats components as Server Components by default. Any file that renders " +
      "toolcrib components (they use React state, context, and browser APIs) needs a `'use client'` " +
      'directive at the top — otherwise expect a build/runtime error about hooks in a Server Component.',
  },
  {
    id: 'cra',
    label: 'Create React App',
    configFiles: [],
    packageDeps: ['react-scripts'],
    note:
      "Create React App is unmaintained and its bundled webpack config predates package.json \"imports\" " +
      "subpath resolution — `import { ... } from '#toolcrib'` may fail to resolve at runtime, not just in " +
      'the editor. `npm run eject` (or migrating off CRA) to gain a config you can patch is the usual fix.',
  },
  {
    id: 'vite',
    label: 'Vite',
    configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.mts'],
    packageDeps: ['vite'],
    note: null,
  },
  {
    id: 'webpack',
    label: 'webpack',
    configFiles: ['webpack.config.js', 'webpack.config.cjs', 'webpack.config.mjs'],
    packageDeps: ['webpack'],
    note:
      'webpack 5+ resolves package.json "imports" subpaths natively; earlier major versions do not, and ' +
      "`import { ... } from '#toolcrib'` will fail to resolve at build time on webpack 4 or older.",
  },
  {
    id: 'parcel',
    label: 'Parcel',
    configFiles: ['.parcelrc'],
    packageDeps: ['parcel'],
    note: null,
  },
];

/**
 * Detect the consumer's bundler/framework from signals already on disk —
 * never asked for, matching this CLI's existing preference (see
 * checkImportsCompatibility's tsconfig read) for deriving from real project
 * state over interrogating the user. Returns the first matching entry's
 * `{ id, label, note }`, or `null` if nothing recognizable is present
 * (a legitimate outcome — plenty of projects use a bundler this list
 * doesn't name, or none of these signals happen to be checked into the
 * repo doctor is run from).
 */
export function detectBundler(projectRoot, pkg) {
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };

  for (const signal of BUNDLER_SIGNALS) {
    const hasConfigFile = signal.configFiles.some((f) => fs.existsSync(path.join(projectRoot, f)));
    const hasPackageDep = signal.packageDeps.some((d) => d in deps);
    if (hasConfigFile || hasPackageDep) {
      return { id: signal.id, label: signal.label, note: signal.note };
    }
  }
  return null;
}
