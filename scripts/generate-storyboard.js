#!/usr/bin/env node
/**
 * Generates a curated visual storyboard of the demo app — one screenshot
 * per meaningful section (each `<Card.Header>` across the eight `main-demo`
 * tabs), plus a browsable `storyboard/index.html` gallery grouping them by
 * tab.
 *
 * Deliberately NOT a pixel-diff visual regression suite (no baseline
 * comparison, no pass/fail, nothing wired into `npm test`/CI) — see the
 * discussion this came out of: automated screenshot diffing is a real
 * maintenance tax (flaky across font-rendering/OS/GPU, needs review on every
 * *intentional* visual change) that's disproportionate for a component
 * library whose actual correctness contract is almost entirely behavioral
 * (does a prop change layout, does an event fire) — exactly what
 * `src/__tests__/` and `e2e/` already assert directly. This is a lighter
 * weight, human-reviewed artifact: run it on demand (before a release, or
 * when eyeballing a visual change), open `storyboard/index.html`, look.
 *
 * The checkpoint list below is curated by hand, not derived from the DOM —
 * `<Card>` has no stable per-instance selector to auto-discover section
 * boundaries by (its only data-attribute, `data-ai-layout-auto`, describes
 * layout mode, not identity). Add a new component's demo section to the
 * relevant tab's list below when it's added to demo/App.tsx; nothing
 * enforces the two staying in sync automatically.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'storyboard');
const DEV_URL = 'http://localhost:5173';

/** @type {{ tab: string, slug: string, shots: string[] }[]} */
const CHECKPOINTS = [
  {
    tab: '🚀 Overview & Architecture',
    slug: 'overview',
    shots: [
      '🛡️ Why Toolcrib?',
      '⚡ Why Use Radix UI Primitives Underneath?',
      '🧩 Why Use Common Layout Idioms & Theme Slices?',
      '📐 AI Schema, Color Theory & WCAG Enforcement',
    ],
  },
  {
    tab: '📝 Form & Zod Engine',
    slug: 'form',
    shots: ['User Profile Form (Zod 4 Validated Engine)', 'Form Architecture & Validation Features'],
  },
  {
    tab: '🪟 Overlays (Popup / Drawer / Modal)',
    slug: 'overlays',
    shots: ['Popup Container (Popover)', 'Drawer', 'Modal Dialog (Focus Trap)'],
  },
  {
    tab: '🔔 Toast Subsystem',
    slug: 'toasts',
    shots: ['Toast Subsystem Controls'],
  },
  {
    tab: '📊 Virtualized Data Table',
    slug: 'datatable',
    shots: [], // Card.Header here is a Toolbar, not plain text — top-of-tab capture only.
  },
  {
    tab: '📐 Common Layout Idioms',
    slug: 'layout',
    shots: [
      'Vertical & Horizontal Stacks',
      'Multi-Column Responsive Grids',
      'Action Toolbars with Slot Architecture',
    ],
  },
  {
    tab: '🖼️ Wireframe Gallery',
    slug: 'wireframes',
    shots: [], // Dynamic, per-wireframe cards — top-of-tab capture only.
  },
  {
    tab: '🧩 Component Showcase',
    slug: 'showcase',
    shots: [
      'Button Subsystem',
      'Token-Saving Card Shorthand',
      'Per-Instance Override',
      'Style Domain',
      'Adaptive Card',
      'Connected Toolbars & Groups',
      'Radix UI Primitives (Accordion, Dropdown Menu, Tooltip & Slider)',
      'Newer Primitives (AlertDialog, Progress, Separator, Avatar, Toggle, ContextMenu & Collapsible)',
      'Combobox: Async Search & Multi-Select',
      'Drag-and-Drop File Upload',
      'Resilience & Off-Screen Rendering',
      'Accessibility, Scroll & Preview Utilities',
    ],
  },
];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function killProcessTree(pid) {
  if (process.platform === 'win32') {
    // /t (tree) is what actually reaches vite — plain taskkill /pid only
    // hits the npm wrapper, same gap as devServer.kill() alone.
    spawn('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    // Negative pid targets the whole process group spawn() created via
    // detached: true above.
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // Group may already be gone — fine.
    }
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Not up yet — keep polling.
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  let devServer = null;
  let alreadyRunning = await fetch(DEV_URL).then(r => r.ok).catch(() => false);
  if (!alreadyRunning) {
    console.log('Starting dev server...');
    // Single command STRING + shell: true, not spawn('npm', ['run','dev']):
    // Windows needs 'npm' resolved to the npm.cmd shim, which only a real
    // shell does automatically (see AGENTS.md's own note — bare spawn()
    // without a shell won't find it via PATHEXT the way an interactive
    // shell would). shell: true + a separate argv array trips Node's own
    // deprecation warning (unescaped concatenation) — passing the whole,
    // already-fully-trusted command as ONE string instead sidesteps that,
    // since there's no argv array being concatenated into it. This is also
    // just the option confirmed to actually work: passing 'npm'/'npm.cmd'
    // as argv[0] with a separate args array (with or without `detached`)
    // hit a Windows-only `spawn EINVAL` here for reasons that didn't
    // reduce cleanly to any single flag.
    const isWin = process.platform === 'win32';
    // detached: true (POSIX only) — `npm run dev` spawns vite as its OWN
    // child process; killing just the npm wrapper (devServer.kill() alone)
    // does not propagate to vite, since npm never forwards the signal to
    // what it spawned. Running detached puts npm (and the vite it spawns)
    // in their own process group so killProcessTree() below can take the
    // whole group down via a negative pid. Not needed on Windows — the
    // `taskkill /t` in killProcessTree() below already walks the real
    // Windows process tree regardless of detached state.
    const spawnOpts = { cwd: rootDir, stdio: 'ignore', shell: true };
    if (!isWin) spawnOpts.detached = true;
    devServer = spawn('npm run dev', spawnOpts);
    const ready = await waitForServer(DEV_URL, 30_000);
    if (!ready) {
      devServer.kill();
      throw new Error('Dev server did not become ready within 30s');
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  /** @type {{ slug: string, tab: string, heading: string, file: string }[]} */
  const captured = [];

  try {
    await page.goto(DEV_URL, { waitUntil: 'networkidle' });

    for (const section of CHECKPOINTS) {
      await page.getByText(section.tab, { exact: true }).click();
      await page.waitForTimeout(200);
      fs.mkdirSync(path.join(outDir, section.slug), { recursive: true });

      if (section.shots.length === 0) {
        const file = `${section.slug}/00-top.png`;
        await page.screenshot({ path: path.join(outDir, file) });
        captured.push({ slug: section.slug, tab: section.tab, heading: '(top of tab)', file });
        continue;
      }

      for (let i = 0; i < section.shots.length; i++) {
        const heading = section.shots[i];
        const locator = page.getByText(heading, { exact: false }).first();
        try {
          await locator.scrollIntoViewIfNeeded({ timeout: 5000 });
        } catch {
          console.warn(`  ! could not find "${heading}" in ${section.slug} — skipping`);
          continue;
        }
        await page.waitForTimeout(150);
        const file = `${section.slug}/${String(i).padStart(2, '0')}-${slugify(heading)}.png`;
        await page.screenshot({ path: path.join(outDir, file) });
        captured.push({ slug: section.slug, tab: section.tab, heading, file });
      }
    }
  } finally {
    await browser.close();
    if (devServer) killProcessTree(devServer.pid);
  }

  writeIndex(captured);
  console.log(`\nCaptured ${captured.length} screenshots → storyboard/index.html`);
}

function writeIndex(captured) {
  const bySlug = new Map();
  for (const shot of captured) {
    if (!bySlug.has(shot.slug)) bySlug.set(shot.slug, { tab: shot.tab, shots: [] });
    bySlug.get(shot.slug).shots.push(shot);
  }

  const sections = [...bySlug.values()]
    .map(
      ({ tab, shots }) => `
    <section>
      <h2>${escapeHtml(tab)}</h2>
      <div class="grid">
        ${shots
          .map(
            s => `
        <figure>
          <img src="${s.file}" loading="lazy" alt="${escapeHtml(s.heading)}" />
          <figcaption>${escapeHtml(s.heading)}</figcaption>
        </figure>`
          )
          .join('')}
      </div>
    </section>`
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Toolcrib Storyboard</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 1.5rem 2rem; background: #f3f4f6; color: #111827; }
  h1 { margin: 0 0 0.25rem; }
  p.meta { color: #6b7280; margin: 0 0 2rem; font-size: 0.875rem; }
  h2 { margin: 2rem 0 1rem; padding-bottom: 0.5rem; border-bottom: 0.0625rem solid #d1d5db; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr)); gap: 1rem; }
  figure { margin: 0; background: #fff; border: 0.0625rem solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; }
  figure img { width: 100%; display: block; border-bottom: 0.0625rem solid #e5e7eb; }
  figcaption { padding: 0.5rem 0.75rem; font-size: 0.8125rem; color: #374151; }
</style>
</head>
<body>
  <h1>Toolcrib Storyboard</h1>
  <p class="meta">Generated by <code>npm run generate-storyboard</code> — a curated visual reference, not a pixel-diff regression suite. Regenerate on demand.</p>
  ${sections}
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
