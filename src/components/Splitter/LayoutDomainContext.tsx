'use client';

import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useAIEvent } from '../../eventBus/useAIEvent';

/** @barrelExport */
export interface SquaredCornersState {
  topLeft?: boolean;
  topRight?: boolean;
  bottomLeft?: boolean;
  bottomRight?: boolean;
}

export interface LayoutDomainInfo {
  domainId: string;
  slot: 'first' | 'second';
  orientation: 'horizontal' | 'vertical';
}

export const LayoutDomainContext = createContext<LayoutDomainInfo | null>(null);

export interface LayoutDomainProviderProps {
  domainId: string;
  slot: 'first' | 'second';
  orientation: 'horizontal' | 'vertical';
  children: ReactNode;
}

/**
 * LayoutDomainProvider wraps subpanel children in a layout domain,
 * allowing containers like <Splitter> to coordinate with deep child components via the Event Bus.
 */
export const LayoutDomainProvider: React.FC<LayoutDomainProviderProps> = ({
  domainId,
  slot,
  orientation,
  children,
}) => {
  return (
    <LayoutDomainContext.Provider value={{ domainId, slot, orientation }}>
      {children}
    </LayoutDomainContext.Provider>
  );
};

/**
 * useLayoutDomain Hook
 * Subscribes to layout domain context to identify parent container domain and slot positioning.
 */
export function useLayoutDomain(): LayoutDomainInfo | null {
  return useContext(LayoutDomainContext);
}

/**
 * useCornerSquaring Hook
 * Automatically communicates with parent layout containers (e.g. Splitter) via the Event Bus
 * to compute and return squared border-radius CSS overrides when a component is flexing (layout="auto").
 */
export function useCornerSquaring(isAuto: boolean = true): {
  squaredCorners: SquaredCornersState;
  style: React.CSSProperties;
} {
  const domainInfo = useLayoutDomain();
  const [squaredCorners, setSquaredCorners] = useState<SquaredCornersState>(() => {
    if (!domainInfo || !isAuto) return {};
    const { slot, orientation } = domainInfo;
    if (orientation === 'vertical') {
      // Horizontal handle between top (first) and bottom (second)
      return slot === 'first'
        ? { bottomLeft: true, bottomRight: true }
        : { topLeft: true, topRight: true };
    } else {
      // Vertical handle between left (first) and right (second)
      return slot === 'first'
        ? { topRight: true, bottomRight: true }
        : { topLeft: true, bottomLeft: true };
    }
  });

  useAIEvent('layout:corners:squared', (event) => {
    if (domainInfo && isAuto && event.domainId === domainInfo.domainId && event.slot === domainInfo.slot) {
      setSquaredCorners(event.squaredCorners);
    }
  });

  const style: React.CSSProperties = {
    ...(squaredCorners.topLeft ? { borderTopLeftRadius: '0rem' } : {}),
    ...(squaredCorners.topRight ? { borderTopRightRadius: '0rem' } : {}),
    ...(squaredCorners.bottomLeft ? { borderBottomLeftRadius: '0rem' } : {}),
    ...(squaredCorners.bottomRight ? { borderBottomRightRadius: '0rem' } : {}),
  };

  return { squaredCorners, style };
}
