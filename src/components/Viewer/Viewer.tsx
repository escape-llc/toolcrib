'use client';

import React, { useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { pickDataAttributes } from '../../theme/safeProps';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useOwnEmit } from '../../eventBus/useOwnEmit';
import { Modal } from '../Overlay/Modal';
import { ViewerContent, type ViewerContentProps } from './ViewerContent';

/**
 * Props for `<Viewer>` — the fullscreen-lightbox convenience default.
 *
 * Composes `<ViewerContent>` inside `<Modal>`, wiring `Modal`'s own
 * `isOpen`/`onOpenChange` to `ViewerContent`'s `onClose` automatically. One
 * *specific, convenient* hosting choice among several equally-legitimate
 * ones — a consumer who wants a `<Drawer>`-hosted or fully inline variant
 * instead composes `<ViewerContent>` directly themselves rather than
 * reaching for a second component.
 */
export interface ViewerProps extends Omit<ViewerContentProps, 'onClose'> {
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the viewer opens or closes. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * @manifest Fullscreen media lightbox — composes ViewerContent inside Modal
 * @manifestCategory Overlays
 * @manifestAntiPatternAvoid Build a bespoke fullscreen image lightbox, independent of `<Modal>`
 * @manifestAntiPatternInstead Use `<Viewer>` — composes `<ViewerContent>` inside `<Modal>` automatically; nested inside another `<Modal>`, Escape closes only the `<Viewer>`, not the parent
 */
export const Viewer: React.FC<ViewerProps> = ({
  id: propId,
  isOpen: externalIsOpen,
  onOpenChange,
  ...contentProps
}) => {
  const id = useStableId(propId, 'viewer');
  // `data-*` land on the dialog (the Modal), not on the content inside it.
  const dataProps = pickDataAttributes(contentProps);
  const innerProps = Object.fromEntries(Object.entries(contentProps).filter(([key]) => !key.startsWith('data-'))) as typeof contentProps;
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Own emissions are marked so the listeners below skip their echo (#705).
  const { emitOwn, isOwnEcho } = useOwnEmit();
  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
    if (!fromBus) {
      emitOwn(() => aiBus.emit(open ? 'viewer:shown' : 'viewer:hidden', { id }));
    }
  };

  useAIEvent('viewer:shown', e => {
    if (e.id === id && !isOpen && !isOwnEcho()) handleOpenChange(true, true);
  });

  useAIEvent('viewer:hidden', e => {
    if (e.id === id && isOpen && !isOwnEcho()) handleOpenChange(false, true);
  });

  return (
    <Modal
      {...dataProps}
      id={id}
      isOpen={isOpen}
      onOpenChange={open => handleOpenChange(open)}
      width="90vw"
      height="80vh"
      aria-label="Media viewer"
    >
      <ViewerContent id={id} {...innerProps} onClose={() => handleOpenChange(false)} />
    </Modal>
  );
};
