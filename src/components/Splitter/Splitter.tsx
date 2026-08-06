import React, { useState, useRef, useEffect, ReactNode, ReactElement, isValidElement, cloneElement } from 'react';
import { Z_INDEX } from '../../theme/zIndex';
import { aiBus } from '../../eventBus/eventBus';
import { LayoutDomainProvider } from './LayoutDomainContext';

export type SplitterOrientation = 'horizontal' | 'vertical';

/**
 * Props for the `<Splitter>` resizable panel layout.
 *
 * Requires exactly 2 children (typically `<Splitter.Panel>` components).
 * Automatically creates a layout domain for corner-squaring adjacent children.
 */
export interface SplitterProps {
  /** Unique domain identifier for layout context. Auto-generated if omitted. */
  id?: string;
  /**
   * Split direction. `'vertical'` = top/bottom panels, `'horizontal'` = left/right panels.
   * @default 'vertical'
   */
  orientation?: SplitterOrientation;
  /**
   * Initial percentage allocated to the first (top/left) panel.
   * @default 70
   */
  initialSplit?: number;
  /**
   * Minimum percentage size for either panel to prevent collapsing.
   * @default 15
   */
  minSize?: number;
  /** Exactly two child elements representing the two panels. */
  children: [ReactNode, ReactNode];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Props for `<Splitter.Panel>` wrapper. Manages corner-squaring propagation
 * to its direct children based on the panel's position in the splitter.
 */
export interface SplitterPanelProps {
  children: ReactNode;
  /**
   * Which corners to square off. `'auto'` defers to the layout domain.
   * @default undefined
   */
  squareCorners?: 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'none';
  style?: React.CSSProperties;
  className?: string;
}

export const Splitter: React.FC<SplitterProps> & {
  Panel: React.FC<SplitterPanelProps>;
} = ({
  id: propId,
  orientation = 'vertical',
  initialSplit = 70,
  minSize = 15,
  children,
  className,
  style,
}) => {
  const domainIdRef = useRef<string>(propId || `splitter-domain-${Math.random().toString(36).substring(2, 7)}`);
  const domainId = domainIdRef.current;

  // Validation: Splitter requires exactly 2 children
  const childCount = React.Children.count(children);
  if (childCount !== 2) {
    console.error(
      `[ai-ui] <Splitter> requires exactly 2 children (got ${childCount}). ` +
      `Wrap each panel's content in a <Splitter.Panel> or any single element.`
    );
  }

  const [split, setSplit] = useState<number>(initialSplit);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVertical = orientation === 'vertical'; // vertical split = top/bottom panels

  useEffect(() => {
    aiBus.emit('layout:domain:created', {
      domainId,
      parentId: domainId,
      orientation,
    });

    const firstSquared = isVertical
      ? { bottomLeft: true, bottomRight: true }
      : { topRight: true, bottomRight: true };

    const secondSquared = isVertical
      ? { topLeft: true, topRight: true }
      : { topLeft: true, bottomLeft: true };

    aiBus.emit('layout:corners:squared', {
      domainId,
      slot: 'first',
      orientation,
      squaredCorners: firstSquared,
    });

    aiBus.emit('layout:corners:squared', {
      domainId,
      slot: 'second',
      orientation,
      squaredCorners: secondSquared,
    });
  }, [domainId, orientation, isVertical]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let newPercentage = 50;
      if (isVertical) {
        const offset = e.clientY - rect.top;
        newPercentage = (offset / rect.height) * 100;
      } else {
        const offset = e.clientX - rect.left;
        newPercentage = (offset / rect.width) * 100;
      }

      const clamped = Math.max(minSize, Math.min(100 - minSize, newPercentage));
      setSplit(clamped);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, isVertical, minSize]);

  const onHandleDown = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const [firstPanel, secondPanel] = React.Children.toArray(children);

  const getFirstPanelCornerStyle = (): React.CSSProperties => {
    return isVertical
      ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }
      : { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
  };

  const getSecondPanelCornerStyle = (): React.CSSProperties => {
    return isVertical
      ? { borderTopLeftRadius: 0, borderTopRightRadius: 0 }
      : { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
  };

  const renderPanelWithCornerStyle = (panel: ReactNode, cornerStyle: React.CSSProperties) => {
    if (!isValidElement(panel)) return panel;
    const typedPanel = panel as ReactElement<any>;
    return cloneElement(typedPanel, {
      style: {
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        ...(typedPanel.props.style || {}),
        ...cornerStyle,
      },
    });
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
        userSelect: isDragging ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* First / Top / Left Panel Container */}
      <LayoutDomainProvider domainId={domainId} slot="first" orientation={orientation}>
        <div
          data-ai-layout-domain={domainId}
          data-ai-layout-slot="first"
          data-ai-layout-orientation={orientation}
          style={{
            flex: `0 0 ${split}%`,
            width: '100%',
            height: isVertical ? undefined : '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            ...(isVertical ? {
              '--ai-layout-border-bottom-left-radius': '0rem',
              '--ai-layout-border-bottom-right-radius': '0rem',
            } : {
              '--ai-layout-border-top-right-radius': '0rem',
              '--ai-layout-border-bottom-right-radius': '0rem',
            }) as any,
            ...getFirstPanelCornerStyle(),
          }}
        >
          {renderPanelWithCornerStyle(firstPanel, getFirstPanelCornerStyle())}
        </div>
      </LayoutDomainProvider>

      {/* Resizable Gutter / Handle */}
      <div
        role="separator"
        aria-orientation={orientation}
        onMouseDown={onHandleDown}
        onPointerDown={onHandleDown}
        onDoubleClick={() => setSplit(initialSplit)}
        style={{
          flex: '0 0 0.625rem',
          background: isDragging ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #e5e7eb)',
          cursor: isVertical ? 'row-resize' : 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.15s ease',
          zIndex: Z_INDEX.SPLITTER,
          touchAction: 'none',
          userSelect: 'none',
          alignSelf: 'stretch',
        }}
      >
        <div
          style={{
            width: isVertical ? '2.5rem' : '0.125rem',
            height: isVertical ? '0.125rem' : '2.5rem',
            background: 'var(--ai-text-secondary, #9ca3af)',
            borderRadius: '0.125rem',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Second / Bottom / Right Panel Container */}
      <LayoutDomainProvider domainId={domainId} slot="second" orientation={orientation}>
        <div
          data-ai-layout-domain={domainId}
          data-ai-layout-slot="second"
          data-ai-layout-orientation={orientation}
          style={{
            flex: `1 1 ${100 - split}%`,
            width: '100%',
            height: isVertical ? undefined : '100%',
            boxSizing: 'border-box',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            minWidth: 0,
            ...(isVertical ? {
              '--ai-layout-border-top-left-radius': '0rem',
              '--ai-layout-border-top-right-radius': '0rem',
            } : {
              '--ai-layout-border-top-left-radius': '0rem',
              '--ai-layout-border-bottom-left-radius': '0rem',
            }) as any,
            ...getSecondPanelCornerStyle(),
          }}
        >
          {renderPanelWithCornerStyle(secondPanel, getSecondPanelCornerStyle())}
        </div>
      </LayoutDomainProvider>
    </div>
  );
};

Splitter.Panel = ({ children, squareCorners, style, className }) => {
  const childArray = React.Children.toArray(children);

  const getExplicitSquareStyle = (): React.CSSProperties => {
    if (squareCorners === 'top') return { borderTopLeftRadius: 0, borderTopRightRadius: 0 };
    if (squareCorners === 'bottom') return { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 };
    if (squareCorners === 'left') return { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 };
    if (squareCorners === 'right') return { borderTopRightRadius: 0, borderBottomRightRadius: 0 };
    if (squareCorners === 'none') return {};

    return style ? {
      ...(style.borderTopLeftRadius !== undefined ? { borderTopLeftRadius: style.borderTopLeftRadius } : {}),
      ...(style.borderTopRightRadius !== undefined ? { borderTopRightRadius: style.borderTopRightRadius } : {}),
      ...(style.borderBottomLeftRadius !== undefined ? { borderBottomLeftRadius: style.borderBottomLeftRadius } : {}),
      ...(style.borderBottomRightRadius !== undefined ? { borderBottomRightRadius: style.borderBottomRightRadius } : {}),
    } : {};
  };

  const radiusOverride = getExplicitSquareStyle();
  const hasRadiusOverride = Object.keys(radiusOverride).length > 0;

  // Single-level corner style application (only 1 level down)
  const processDirectChild = (child: ReactNode): ReactNode => {
    if (!isValidElement(child)) return child;
    const typedChild = child as ReactElement<any>;
    const childStyle = typedChild.props.style || {};
    const isReactComponent = typeof typedChild.type !== 'string';
    const childSquareCorners = isReactComponent
      ? (typedChild.props.squareCorners || (squareCorners && squareCorners !== 'auto' ? squareCorners : undefined))
      : undefined;

    return cloneElement(typedChild, {
      ...(childSquareCorners ? { squareCorners: childSquareCorners } : {}),
      style: {
        width: '100%',
        boxSizing: 'border-box',
        ...childStyle,
        ...radiusOverride,
      },
    });
  };

  const renderedContent = hasRadiusOverride
    ? childArray.map(child => processDirectChild(child))
    : children;

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...radiusOverride,
        ...style,
      }}
    >
      {renderedContent}
    </div>
  );
};

Splitter.Panel.displayName = 'Splitter.Panel';
