// Pay ICU's one-time cost here, outside any test's timeout (#1003).
//
// The first Date locale-format call in a process builds the formatter and
// resolves the system time zone. Later calls take microseconds. On a loaded
// 2-core windows-latest runner that first call measured 11-555ms, so whichever
// test made it first (github.test.js's rate-limit message, versions.test.js's
// release dates) took up to 609ms where its neighbours took 1-5ms, and twice
// ran past vitest's 5s default. Top-level code in a setup file isn't timed by
// testTimeout or hookTimeout, so warming it here keeps that cost out of every
// test. Raising testTimeout would only have hidden it.
new Date(0).toLocaleString();
