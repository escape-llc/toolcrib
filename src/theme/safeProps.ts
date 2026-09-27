import { type HTMLAttributes } from 'react';

/**
 * Any props shape with `style`/`className` removed. Every migrated
 * component's Props interface must extend this instead of the raw
 * attributes type (`HTMLAttributes<T>`, `ButtonHTMLAttributes<T>`,
 * `InputHTMLAttributes<T>`, ...) — deleting an interface's own
 * `style?:`/`className?:` declarations alone does nothing, since
 * `extends X` silently reintroduces both regardless of whether the
 * interface redeclares them itself.
 */
/** @barrelExport */
export type StyleFree<P> = Omit<P, 'style' | 'className'>;

/** `StyleFree<HTMLAttributes<T>>` — the common case for a plain DOM element. */
export type StyleFreeAttributes<T> = StyleFree<HTMLAttributes<T>>;

/**
 * Pure decision logic for `isDevBuild()` below, exported for testing. Kept
 * separate because some inputs it needs to handle — `import.meta.env.DEV`
 * genuinely absent, as opposed to explicitly `false` — can't be faithfully
 * simulated by mutating the real `import.meta.env` inside a Vitest run:
 * Vitest's own environment always provides `DEV` as a real boolean, and
 * that object's property descriptors resist reassignment/deletion (it's
 * backed by a proxy, not a plain object). Testing this decision directly,
 * with plain arguments, sidesteps the sandbox entirely.
 */
export function resolveIsDev(metaEnvDev: boolean | undefined, nodeEnv: string | undefined): boolean {
  if (typeof metaEnvDev === 'boolean') return metaEnvDev;
  if (typeof nodeEnv === 'string') return nodeEnv !== 'production';
  return true;
}

/**
 * Best-effort "is this a dev build" check with no bundler assumption.
 * This file is vendored as-is into every consumer project, so it can't
 * lean on any one bundler's ambient types (`import.meta.env.DEV` needs
 * Vite's; `process.env.NODE_ENV` needs Node's) without silently requiring
 * that bundler/toolchain for every consumer, whether they use it or not.
 * `as unknown as` erases the type before reading either property, so
 * neither `vite/client` nor `@types/node` needs to be present for this to
 * compile — only for the corresponding runtime value to actually exist.
 *
 * Checked in order (see resolveIsDev): `import.meta.env.DEV` (Vite, and
 * anything else that follows the same convention), then
 * `process.env.NODE_ENV` (webpack, Next.js, Jest/Vitest under some
 * configs). Defaults to `true` if neither signal is available — a dev-only
 * diagnostic showing up where it wasn't strictly needed is a cheaper
 * mistake than one silently never showing up at all.
 */
export function isDevBuild(): boolean {
  const meta = import.meta as unknown as { env?: { DEV?: boolean } };
  const proc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  return resolveIsDev(meta?.env?.DEV, proc?.env?.NODE_ENV);
}
