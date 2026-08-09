/**
 * Markdown-specific application of lib/fences.js: managed blocks for ai-docs
 * content (CORE.md, NEW_APP.md, REFACTOR_APP.md) merged into the user's own
 * AGENTS.md / CLAUDE.md, so that content can still be round-trip detected
 * and updated on `toolcrib merge`, the same way vendored files under
 * ./toolcrib/ already are.
 */
import { FENCE_STYLES, buildFence, extractFence, upsertFence } from './fences.js';

// doc-id -> source filename under ai-docs/, in the order they should read
// when more than one is present in the same target file.
export const MANAGED_DOCS = {
  core: 'CORE.md',
  'new-app': 'NEW_APP.md',
  'refactor-app': 'REFACTOR_APP.md',
};

// Files the CLI knows to scan for managed blocks. AGENTS.md is preferred
// when proposing a new block and neither file exists yet.
export const KNOWN_TARGET_FILES = ['AGENTS.md', 'CLAUDE.md'];
export const DEFAULT_TARGET_FILE = 'AGENTS.md';

/** Build a complete fenced block (start marker, content, end marker) for a doc. */
export function buildManagedBlock(docId, version, content) {
  return buildFence(FENCE_STYLES.markdown, docId, version, content);
}

/** Find an existing managed block for `docId` in `fileContent`. Returns null if absent. */
export function extractManagedBlock(fileContent, docId) {
  return extractFence(FENCE_STYLES.markdown, fileContent, docId);
}

/**
 * Insert or replace the managed block for `docId` in `fileContent`.
 * If a block for this docId already exists, only that span is replaced —
 * everything else in the file (the user's own instructions, other docIds'
 * blocks) is left untouched. Otherwise the block is appended.
 */
export function upsertManagedBlock(fileContent, docId, version, content) {
  return upsertFence(FENCE_STYLES.markdown, fileContent, docId, version, content);
}

/** List every managed docId present in `fileContent`, with its recorded version and content. */
export function listManagedBlocks(fileContent) {
  return Object.keys(MANAGED_DOCS)
    .map((docId) => {
      const block = extractManagedBlock(fileContent, docId);
      return block ? { docId, ...block } : null;
    })
    .filter(Boolean);
}
