import React, { type ReactNode, type ReactElement, useRef, useState, useEffect } from 'react';
import { Breadcrumbs as AriaBreadcrumbs, Breadcrumb as AriaBreadcrumb, Link as AriaLink } from 'react-aria-components/Breadcrumbs';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { DropdownMenu } from '../DropdownMenu/DropdownMenu';
import { getSparseVariables } from '../../theme/slice';
import { BreadcrumbThemeSlice, type BreadcrumbSliceState } from './BreadcrumbSlice';

/** Props for the `<Breadcrumb.Item>` slot. */
export interface BreadcrumbItemProps {
  children: ReactNode;
  /** Href for this crumb's link. Omit for the current page (the last item is automatically non-interactive regardless). */
  href?: string;
  /** Click handler, for a JS-driven crumb instead of a real link. */
  onClick?: () => void;
}

/** Props for the `<Breadcrumb.Separator>` slot -- rendered automatically between items; exported so a custom `separator` prop value can reuse the same visual treatment. */
export interface BreadcrumbSeparatorProps {
  children?: ReactNode;
}

/** Props for the root `<Breadcrumb>` trail. */
export interface BreadcrumbProps {
  /** `<Breadcrumb.Item>` elements, in order from root to current page. */
  children: ReactNode;
  /** Separator rendered between items. @default `<Breadcrumb.Separator />` (a "›" glyph) */
  separator?: ReactNode;
  /** Per-instance override for item gap. */
  overrides?: Partial<BreadcrumbSliceState>;
}

interface CrumbInfo {
  key: string;
  element: ReactElement<BreadcrumbItemProps>;
  isLast: boolean;
}

/**
 * Pure collapse decision, kept separate from the DOM-measurement plumbing
 * that feeds it (same split `usePagination`/`buildPageTokens` used
 * elsewhere in this toolkit) -- exactly the first/…/last shape a real
 * browser layout would need `isOverflowing` to trigger, but directly
 * testable without one. Only collapses when there's something meaningful
 * to hide (at least 2 items between the first and last).
 */
export function computeVisibleCrumbs(crumbs: CrumbInfo[], isOverflowing: boolean): { visible: CrumbInfo[]; collapsed: CrumbInfo[] } {
  if (!isOverflowing || crumbs.length < 4) {
    return { visible: crumbs, collapsed: [] };
  }
  const first = crumbs[0];
  const last = crumbs[crumbs.length - 1];
  const collapsed = crumbs.slice(1, -1);
  return { visible: [first, last], collapsed };
}

/**
 * @manifest Breadcrumb trail built on React Aria Components, collapsing middle items into a `<DropdownMenu>` on overflow
 * @manifestCategory Data Display
 */
export const Breadcrumb: React.FC<BreadcrumbProps> & {
  Item: React.FC<BreadcrumbItemProps>;
  Separator: React.FC<BreadcrumbSeparatorProps>;
} = ({ children, separator, overrides }) => {
  const vars = getSparseVariables(BreadcrumbThemeSlice, overrides ?? {});
  const containerRef = useRef<HTMLDivElement>(null);
  const { width } = useAdaptiveSize(containerRef, { id: 'breadcrumb' });
  const [isOverflowing, setIsOverflowing] = useState(false);

  const crumbs: CrumbInfo[] = React.Children.toArray(children)
    .filter((child): child is ReactElement<BreadcrumbItemProps> => React.isValidElement(child) && child.type === Breadcrumb.Item)
    .map((element, index, arr) => ({ key: String(index), element, isLast: index === arr.length - 1 }));

  // Overflow measurement is the *only* piece a real browser layout has to
  // supply -- comparing scrollWidth to clientWidth on the fully-expanded
  // list is the same technique TabStrip's own filmstrip overflow already
  // uses (see its own checkScroll), reused here rather than a second
  // measurement strategy. `width` (from useAdaptiveSize, the shared
  // singleton ResizeObserver -- never a second `new ResizeObserver` per
  // ground rule 10) is in the dependency array specifically to re-check
  // on every resize, not just on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollWidth > el.clientWidth);
  }, [width, crumbs.length]);

  const { visible, collapsed } = computeVisibleCrumbs(crumbs, isOverflowing);
  const separatorNode = separator ?? <Breadcrumb.Separator />;

  // <AriaBreadcrumbs> is a React Aria "Collection" component: it only
  // recognizes direct <AriaBreadcrumb> children and builds its own
  // internal collection from them -- confirmed directly (a real, not
  // hypothetical, bug caught this exact way) that interspersing separator/
  // dropdown <li> *siblings* between <AriaBreadcrumb> items breaks its
  // collection entirely, silently dropping everything after the first
  // item. The separator has to live *inside* each non-final slot's own
  // <AriaBreadcrumb>, not beside it -- one slot, one direct child, always.
  type Slot = { key: string; content: ReactNode; isLast: boolean };
  const slots: Slot[] = [];
  visible.forEach((crumb, i) => {
    if (i === 1 && collapsed.length > 0) {
      slots.push({
        key: 'collapsed',
        isLast: false,
        content: (
          <DropdownMenu
            trigger={
              <button type="button" aria-label="Show hidden breadcrumb items" style={{ all: 'unset', cursor: 'pointer', color: 'var(--ai-text-secondary, #6b7280)' }}>
                …
              </button>
            }
            items={collapsed.map(c => ({
              value: c.key,
              label: c.element.props.children,
              onClick: c.element.props.onClick,
            }))}
          />
        ),
      });
    }
    slots.push({
      key: crumb.key,
      isLast: crumb.isLast,
      content: crumb.isLast ? (
        <span style={{ color: 'var(--ai-text-primary, #111827)', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          {crumb.element.props.children}
        </span>
      ) : (
        <AriaLink
          href={crumb.element.props.href}
          onPress={crumb.element.props.onClick}
          style={{ color: 'var(--ai-text-secondary, #6b7280)', textDecoration: 'none', cursor: 'pointer' }}
        >
          {crumb.element.props.children}
        </AriaLink>
      ),
    });
  });

  return (
    <div ref={containerRef} style={{ overflow: 'hidden', minWidth: 0 }}>
      <AriaBreadcrumbs
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--ai-breadcrumb-gap, 0.375rem)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          fontSize: '0.875rem',
          flexWrap: isOverflowing ? 'nowrap' : 'wrap',
          ...vars,
        }}
      >
        {slots.map((slot, i) => (
          // No isCurrent prop -- react-aria-components' own useBreadcrumbs
          // determines "current" from DOM position (the last
          // <AriaBreadcrumb> child), which is always this trail's true
          // last slot whether or not the middle is collapsed.
          <AriaBreadcrumb key={slot.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ai-breadcrumb-gap, 0.375rem)' }}>
            {slot.content}
            {i < slots.length - 1 && separatorNode}
          </AriaBreadcrumb>
        ))}
      </AriaBreadcrumbs>
    </div>
  );
};

Breadcrumb.Item = () => null; // marker only -- Breadcrumb reads props directly off the element, never actually renders this

Breadcrumb.Separator = ({ children }) => (
  <span aria-hidden="true" style={{ color: 'var(--ai-text-secondary, #9ca3af)', fontSize: '0.75rem' }}>
    {children ?? '›'}
  </span>
);

Breadcrumb.Item.displayName = 'Breadcrumb.Item';
Breadcrumb.Separator.displayName = 'Breadcrumb.Separator';
