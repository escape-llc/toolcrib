import { HTMLAttributes } from 'react';

/**
 * Any props shape with `style`/`className` removed. Every migrated
 * component's Props interface must extend this instead of the raw
 * attributes type (`HTMLAttributes<T>`, `ButtonHTMLAttributes<T>`,
 * `InputHTMLAttributes<T>`, ...) — deleting an interface's own
 * `style?:`/`className?:` declarations alone does nothing, since
 * `extends X` silently reintroduces both regardless of whether the
 * interface redeclares them itself.
 */
export type StyleFree<P> = Omit<P, 'style' | 'className'>;

/** `StyleFree<HTMLAttributes<T>>` — the common case for a plain DOM element. */
export type StyleFreeAttributes<T> = StyleFree<HTMLAttributes<T>>;

/**
 * Dev-mode-only migration-completeness net: TypeScript removing `style`/
 * `className` from a component's Props type doesn't stop a non-TS (or
 * `any`-typed) caller from passing them at runtime — they'd still be
 * silently applied via that component's `{...props}` spread. Call this
 * once per migrated component with its raw incoming props to catch
 * stragglers under the project's existing zero-console-warnings browser
 * verification pass. No-op in production builds.
 */
export function warnIfLegacyStyleProps(props: Record<string, unknown>, componentName: string): void {
  if (!import.meta.env.DEV) return;
  if ('style' in props || 'className' in props) {
    console.warn(
      `[toolcrib] <${componentName}> received a 'style' or 'className' prop, which it no longer accepts. Use 'overrides' instead.`
    );
  }
}
