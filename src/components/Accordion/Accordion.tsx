import React, { ReactNode, useRef } from 'react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { AccordionThemeSlice, AccordionSliceState } from './AccordionSlice';
import { useStableId } from '../shared/useStableId';

/** Data shape for each item in a data-driven `<Accordion>`. */
export interface AccordionItemData {
  /** Unique string key identifying this item (used for expand/collapse tracking). */
  value: string;
  /** Content rendered in the clickable header trigger. */
  title: ReactNode;
  /** Content rendered in the collapsible body panel. */
  content: ReactNode;
  /** If true, the item cannot be expanded or collapsed. */
  disabled?: boolean;
}

/**
 * Props for the `<Accordion>` collapsible panel group.
 *
 * Data-driven: pass an `items` array and the component renders all panels.
 * Emits `accordion:opened` / `accordion:closed` events on the event bus.
 */
export interface AccordionProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Array of items to render as accordion panels. */
  items: AccordionItemData[];
  /**
   * `'single'` allows only one panel open at a time. `'multiple'` allows any combination.
   * @default 'single'
   */
  type?: 'single' | 'multiple';
  /** Value of the initially expanded panel (for `type='single'`). */
  defaultValue?: string;
  /** Per-instance overrides for header padding, item gap, variant, and panel animation. */
  overrides?: Partial<AccordionSliceState>;
}

/**
 * @manifest Data-driven collapsible panel group with animations
 * @manifestCategory Data Display
 */
export const Accordion: React.FC<AccordionProps> = ({
  id: propId,
  items,
  type = 'single',
  defaultValue,
  overrides,
}) => {
  const id = useStableId(propId, 'accordion');
  const { vars } = useSliceOverrides(AccordionThemeSlice, overrides);

  // Tracks which item values are currently open so onValueChange can emit
  // one accordion:opened/closed per item that actually changed state —
  // Radix's onValueChange only reports the new value(s) (a single string
  // for type="single", an array for type="multiple"), not a diff, so a
  // naive "truthy = opened, falsy = closed" read can't tell which item
  // closed when switching between single-mode panels or toggling one item
  // in multi-mode while others stay open.
  const previousOpenRef = useRef<Set<string>>(new Set(defaultValue ? [defaultValue] : []));

  return (
    <AccordionPrimitive.Root
      type={type as any}
      defaultValue={defaultValue}
      onValueChange={(val: any) => {
        const nextOpen = new Set<string>(Array.isArray(val) ? val : val ? [val] : []);
        const previousOpen = previousOpenRef.current;

        for (const itemValue of nextOpen) {
          if (!previousOpen.has(itemValue)) {
            aiBus.emit('accordion:opened', { id, itemValue });
          }
        }
        for (const itemValue of previousOpen) {
          if (!nextOpen.has(itemValue)) {
            aiBus.emit('accordion:closed', { id, itemValue });
          }
        }

        previousOpenRef.current = nextOpen;
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ai-accordion-item-gap, 0.375rem)',
        width: '100%',
        ...vars,
      }}
    >
      {items.map((item) => (
        <AccordionPrimitive.Item
          key={item.value}
          value={item.value}
          disabled={item.disabled}
          style={{
            borderRadius: 'var(--ai-accordion-border-radius, var(--ai-radius-md, 0.375rem))',
            border: 'var(--ai-accordion-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
            background: 'var(--ai-bg-surface, #ffffff)',
            overflow: 'hidden',
          }}
        >
          <AccordionPrimitive.Header style={{ margin: 0 }}>
            <AccordionPrimitive.Trigger
              className="ai-accordion-trigger"
              style={{
                all: 'unset',
                width: '100%',
                boxSizing: 'border-box',
                padding: 'var(--ai-accordion-header-padding, 0.875rem 1.125rem)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: 'var(--ai-text-primary, #111827)',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                background: 'var(--ai-bg-container, #f9fafb)',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
            >
              <span>{item.title}</span>
              <span className="ai-accordion-chevron" style={{ fontSize: '0.75rem', color: 'var(--ai-text-secondary, #6b7280)' }}>▼</span>
            </AccordionPrimitive.Trigger>
          </AccordionPrimitive.Header>

          <AccordionPrimitive.Content
            className="ai-accordion-content"
            style={{
              padding: '1rem 1.125rem',
              fontSize: '0.875rem',
              color: 'var(--ai-text-primary, #111827)',
              borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
            }}
          >
            {item.content}
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      ))}
    </AccordionPrimitive.Root>
  );
};
