import React, { ReactNode, useState, useRef, useMemo, KeyboardEvent } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { DeferredContent } from '../Layout/DeferredContent';
import { TreeThemeSlice, TreeSliceState } from './TreeSlice';

/** Data shape for each node in a data-driven `<Tree>`. */
export interface TreeItemData {
  /** Unique string key identifying this node. */
  id: string;
  /** Content rendered for this node's row. */
  label: ReactNode;
  /** Nested child nodes. Omit or leave empty for a leaf node. */
  children?: TreeItemData[];
  /** If true, this node cannot be expanded, collapsed, or selected. */
  disabled?: boolean;
}

interface FlatNode {
  item: TreeItemData;
  level: number;
  parentId?: string;
  setSize: number;
  posInSet: number;
}

function flattenVisible(items: TreeItemData[], expanded: Set<string>, level = 0, parentId?: string): FlatNode[] {
  const result: FlatNode[] = [];
  items.forEach((item, index) => {
    result.push({ item, level, parentId, setSize: items.length, posInSet: index + 1 });
    if (item.children && item.children.length > 0 && expanded.has(item.id)) {
      result.push(...flattenVisible(item.children, expanded, level + 1, item.id));
    }
  });
  return result;
}

// Type-ahead only matches plain string/number labels -- a label rendering
// arbitrary JSX (an icon + badge alongside text) has no single reliable
// "the searchable text" without a deep, fragile text-node walk, so this
// intentionally degrades to "doesn't match" rather than guessing.
function nodeText(label: ReactNode): string {
  if (typeof label === 'string') return label;
  if (typeof label === 'number') return String(label);
  return '';
}

export interface TreeProps {
  /** Unique identifier for `tree:expanded`/`tree:collapsed` event bus payloads. Auto-generated if omitted. */
  id?: string;
  /** Root-level nodes. */
  items: TreeItemData[];
  /** Controlled set of expanded node ids. Pass to drive expansion from parent state instead of managing it internally. */
  expandedIds?: string[];
  /** Initial expanded ids when uncontrolled (`expandedIds` omitted). */
  defaultExpandedIds?: string[];
  /** Called whenever a node expands or collapses, whether controlled or uncontrolled. */
  onExpandedChange?: (expandedIds: string[]) => void;
  /** Controlled selected node id. Pass to drive selection from parent state instead of managing it internally. */
  selectedId?: string;
  /** Initial selected id when uncontrolled (`selectedId` omitted). */
  defaultSelectedId?: string;
  /** Called whenever selection changes, whether controlled or uncontrolled. */
  onSelectChange?: (id: string | undefined) => void;
  /** Per-instance overrides for indent and row spacing. */
  overrides?: Partial<TreeSliceState>;
}

/**
 * @manifest Data-driven tree view with expand/collapse, single selection, and full WAI-ARIA Treeview keyboard navigation
 * @manifestConstraints Rendered as a flat, single-level DOM list with `aria-level`/`aria-setsize`/`aria-posinset` conveying hierarchy (not nested `role="group"` elements) — a WAI-ARIA-APG-accepted alternative that keeps each visible row independently wrappable in `<DeferredContent>` for large trees
 * @manifestCategory Data Display
 */
export const Tree: React.FC<TreeProps> = ({
  id: propId,
  items,
  expandedIds: controlledExpandedIds,
  defaultExpandedIds,
  onExpandedChange,
  selectedId: controlledSelectedId,
  defaultSelectedId,
  onSelectChange,
  overrides,
}) => {
  const id = useStableId(propId, 'tree');
  const { vars } = useSliceOverrides(TreeThemeSlice, overrides);

  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => new Set(defaultExpandedIds ?? []));
  const isExpandedControlled = controlledExpandedIds !== undefined;
  const expandedSet = isExpandedControlled ? new Set(controlledExpandedIds) : internalExpanded;

  const [internalSelected, setInternalSelected] = useState<string | undefined>(defaultSelectedId);
  const isSelectedControlled = controlledSelectedId !== undefined;
  const selected = isSelectedControlled ? controlledSelectedId : internalSelected;

  const flatVisible = useMemo(() => flattenVisible(items, expandedSet), [items, expandedSet]);

  const [focusedId, setFocusedId] = useState<string | undefined>(
    () => selected ?? defaultSelectedId ?? flatVisible[0]?.item.id
  );
  // Roving tabindex needs to move real DOM focus, not just React state --
  // but only ever in response to an actual keyboard/click interaction, not
  // on mount or on an unrelated re-render, which a plain
  // useEffect(..., [focusedId]) can't tell apart from a real interaction on
  // its own.
  const hasInteractedRef = useRef(false);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const typeAheadRef = useRef<{ query: string; timer: ReturnType<typeof setTimeout> | null }>({ query: '', timer: null });

  const toggleExpand = (itemId: string, nextExpanded: boolean) => {
    const next = new Set(expandedSet);
    if (nextExpanded) next.add(itemId);
    else next.delete(itemId);
    if (!isExpandedControlled) setInternalExpanded(next);
    onExpandedChange?.(Array.from(next));
    aiBus.emit(nextExpanded ? 'tree:expanded' : 'tree:collapsed', { id, itemId });
  };

  const selectItem = (itemId: string) => {
    if (!isSelectedControlled) setInternalSelected(itemId);
    onSelectChange?.(itemId);
  };

  const focusIndex = (index: number) => {
    const target = flatVisible[index];
    if (!target) return;
    hasInteractedRef.current = true;
    setFocusedId(target.item.id);
    itemRefs.current.get(target.item.id)?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, index: number) => {
    const node = flatVisible[index];
    const hasChildren = !!node.item.children?.length;
    const isExpanded = expandedSet.has(node.item.id);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusIndex(Math.min(index + 1, flatVisible.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusIndex(Math.max(index - 1, 0));
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (hasChildren && !isExpanded) toggleExpand(node.item.id, true);
        else if (hasChildren && isExpanded) focusIndex(index + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (hasChildren && isExpanded) {
          toggleExpand(node.item.id, false);
        } else if (node.parentId) {
          const parentIndex = flatVisible.findIndex(n => n.item.id === node.parentId);
          if (parentIndex >= 0) focusIndex(parentIndex);
        }
        break;
      case 'Home':
        e.preventDefault();
        focusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        focusIndex(flatVisible.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (node.item.disabled) break;
        if (hasChildren) toggleExpand(node.item.id, !isExpanded);
        selectItem(node.item.id);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const buffer = typeAheadRef.current;
          buffer.query += e.key.toLowerCase();
          if (buffer.timer) clearTimeout(buffer.timer);
          buffer.timer = setTimeout(() => {
            buffer.query = '';
          }, 500);

          const n = flatVisible.length;
          for (let offset = 1; offset <= n; offset++) {
            const candidateIndex = (index + offset) % n;
            if (nodeText(flatVisible[candidateIndex].item.label).toLowerCase().startsWith(buffer.query)) {
              focusIndex(candidateIndex);
              break;
            }
          }
        }
    }
  };

  return (
    <div role="tree" aria-label="Tree" style={{ display: 'flex', flexDirection: 'column', ...vars }}>
      {flatVisible.map((node, index) => {
        const hasChildren = !!node.item.children?.length;
        const isExpanded = expandedSet.has(node.item.id);
        const isSelected = selected === node.item.id;
        const isFocused = (focusedId ?? flatVisible[0]?.item.id) === node.item.id;

        return (
          <DeferredContent key={node.item.id} estimatedHeight={32}>
            <div
              ref={el => {
                if (el) itemRefs.current.set(node.item.id, el);
                else itemRefs.current.delete(node.item.id);
              }}
              role="treeitem"
              aria-expanded={hasChildren ? isExpanded : undefined}
              aria-level={node.level + 1}
              aria-setsize={node.setSize}
              aria-posinset={node.posInSet}
              aria-selected={isSelected}
              aria-disabled={node.item.disabled || undefined}
              tabIndex={isFocused ? 0 : -1}
              onKeyDown={e => handleKeyDown(e, index)}
              onClick={() => {
                if (node.item.disabled) return;
                hasInteractedRef.current = true;
                setFocusedId(node.item.id);
                selectItem(node.item.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginLeft: `calc(var(--ai-tree-indent, 1.25rem) * ${node.level})`,
                marginBottom: 'var(--ai-tree-item-gap, 0)',
                padding: '0.25rem 0.5rem',
                borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                cursor: node.item.disabled ? 'not-allowed' : 'pointer',
                opacity: node.item.disabled ? 0.5 : 1,
                background: isSelected ? 'var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.1))' : 'transparent',
                outline: isFocused ? '0.125rem solid var(--ai-color-primary, #3b82f6)' : 'none',
                outlineOffset: '-0.125rem',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.875rem',
              }}
            >
              {hasChildren ? (
                <span
                  onClick={e => {
                    e.stopPropagation();
                    toggleExpand(node.item.id, !isExpanded);
                  }}
                  style={{
                    display: 'inline-flex',
                    width: '1rem',
                    flexShrink: 0,
                    justifyContent: 'center',
                    color: 'var(--ai-text-secondary, #6b7280)',
                    transform: isExpanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  ▶
                </span>
              ) : (
                <span style={{ width: '1rem', flexShrink: 0 }} />
              )}
              {node.item.label}
            </div>
          </DeferredContent>
        );
      })}
    </div>
  );
};
