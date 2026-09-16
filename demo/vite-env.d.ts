/// <reference types="vite/client" />

// Replaced with a real string literal at build/dev time by vite.config.ts's
// `define` -- a short git commit hash, or 'unknown' in a gitless
// environment. Exists so the deployed GitHub Pages demo (which has no
// local git checkout to compare against) can show which commit is
// currently live, closing the "did I actually refresh to the latest
// deploy" gap a local dev server doesn't have (there, `git status` already
// answers that).
declare const __COMMIT_HASH__: string;
