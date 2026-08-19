import React, { useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Modal } from '../Overlay/Modal';
import { ViewerContent, ViewerContentProps } from './ViewerContent';

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
 */
export const Viewer: React.FC<ViewerProps> = ({
  id: propId,
  isOpen: externalIsOpen,
  onOpenChange,
  ...contentProps
}) => {
  const id = useStableId(propId, 'viewer');
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    onOpenChange?.(open);
    if (!fromBus) {
      aiBus.emit(open ? 'viewer:shown' : 'viewer:hidden', { id });
    }
  };

  useAIEvent('viewer:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });

  useAIEvent('viewer:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  return (
    <Modal
      id={id}
      isOpen={isOpen}
      onOpenChange={open => handleOpenChange(open)}
      width="90vw"
      height="80vh"
      ariaLabel="Media viewer"
    >
      <ViewerContent id={id} {...contentProps} onClose={() => handleOpenChange(false)} />
    </Modal>
  );
};
