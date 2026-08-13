import React, { useState, useEffect, ReactNode } from 'react';
import { Collapsible as CollapsiblePrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useStableId } from '../shared/useStableId';
import { getSparseVariables } from '../../theme/slice';
import { injectInteractionStyles } from '../../theme/interactionStyles';
import { CollapsibleThemeSlice, CollapsibleSliceState } from './CollapsibleSlice';

/**
 * Props for the `<Collapsible>` single expand/collapse panel.
 *
 * For a data-driven set of multiple panels, use `<Accordion>` instead —
 * this is for a single standalone disclosure (e.g. "Show more options"),
 * controllable via `aiBus` the same way `<Modal>`/`<SlideOut>` are.
 */
export interface CollapsibleProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Clickable header content that toggles the panel. */
  trigger: ReactNode;
  /** Panel content, shown when open. */
  children: ReactNode;
  /** Initial open state (uncontrolled). @default false */
  defaultOpen?: boolean;
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the panel opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** If true, the trigger is non-interactive and the panel can't be toggled. */
  disabled?: boolean;
  /** Per-instance override for header/content padding. */
  overrides?: Partial<CollapsibleSliceState>;
}

/**
 * @manifest Single expand/collapse content panel — see Accordion for a data-driven set of panels
 * @manifestCategory Containers
 */
export const Collapsible: React.FC<CollapsibleProps> = ({
  id: propId,
  trigger,
  children,
  defaultOpen = false,
  isOpen: externalIsOpen,
  onOpenChange,
  disabled = false,
  overrides,
}) => {
  const id = useStableId(propId, 'collapsible');
  const collapsibleVars = getSparseVariables(CollapsibleThemeSlice, overrides ?? {});
  useEffect(() => {
    injectInteractionStyles();
  }, []);
  const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (!fromBus) {
      aiBus.emit(open ? 'collapsible:opened' : 'collapsible:closed', { id });
    }
  };

  useAIEvent('collapsible:opened', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });
  useAIEvent('collapsible:closed', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  return (
    <CollapsiblePrimitive.Root
      open={isOpen}
      onOpenChange={open => handleOpenChange(open)}
      disabled={disabled}
      style={{ width: '100%', ...collapsibleVars }}
    >
      <CollapsiblePrimitive.Trigger
        className="ai-btn"
        style={{
          all: 'unset',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          boxSizing: 'border-box',
          padding: 'var(--ai-collapsible-header-padding, 0.875rem 1.125rem)',
          borderRadius: 'var(--ai-radius-md, 0.375rem)',
          background: 'var(--ai-bg-container, #f9fafb)',
          fontWeight: 'var(--ai-font-weight-semibold, 600)',
          fontSize: '0.9rem',
          color: 'var(--ai-text-primary, #111827)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'background 0.15s ease',
          ['--ai-btn-bg' as string]: 'var(--ai-bg-container, #f9fafb)',
        }}
      >
        <span>{trigger}</span>
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--ai-text-secondary, #6b7280)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease',
          }}
        >
          ▼
        </span>
      </CollapsiblePrimitive.Trigger>

      <CollapsiblePrimitive.Content
        style={{
          padding: 'var(--ai-collapsible-content-padding, 1rem 1.125rem)',
          fontSize: '0.875rem',
          color: 'var(--ai-text-primary, #111827)',
        }}
      >
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
};
