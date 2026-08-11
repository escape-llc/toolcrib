import React, { ReactNode } from 'react';
import { Accordion as AccordionPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { AccordionThemeSlice, AccordionSliceState } from './AccordionSlice';

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

/** @manifest Data-driven collapsible panel group with animations */
export const Accordion: React.FC<AccordionProps> = ({
  id = `accordion-${Math.random().toString(36).substring(2, 7)}`,
  items,
  type = 'single',
  defaultValue,
  overrides,
}) => {
  const { vars } = useSliceOverrides(AccordionThemeSlice, overrides);

  return (
    <AccordionPrimitive.Root
      type={type as any}
      defaultValue={defaultValue}
      onValueChange={(val: any) => {
        const itemVal = Array.isArray(val) ? val.join(',') : val;
        if (itemVal) {
          aiBus.emit('accordion:opened', { id, itemValue: itemVal });
        } else {
          aiBus.emit('accordion:closed', { id, itemValue: '' });
        }
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
