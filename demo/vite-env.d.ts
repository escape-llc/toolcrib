/// <reference types="vite/client" />

// __COMMIT_HASH__'s own ambient declaration deliberately does NOT live
// here -- see demo/App.tsx's own comment on it for why (cli/integration-
// test/run-nextjs-fixture.mjs copies App.tsx raw into a real Next.js
// project; this file never travels with it, so a declaration only here
// would leave that copy with an unresolved identifier at both type-check
// and runtime).
