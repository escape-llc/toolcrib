import React, { ReactNode, Children, isValidElement, cloneElement, ReactElement, useEffect } from 'react';

/**
 * Props for the `<UIGroup>` component.
 *
 * Visually groups adjacent elements (e.g. buttons) by merging their borders
 * and removing internal border-radii so they appear as a single compound control.
 */
export interface UIGroupProps {
  children: ReactNode;
  /**
   * Group layout direction.
   * - `'horizontal'` — Children laid out in a row (default).
   * - `'vertical'` — Children stacked vertically.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /** Override border radius for the outer corners. @default 'var(--ai-radius-md, 0.375rem)' */
  borderRadius?: string;
  className?: string;
  style?: React.CSSProperties;
}

// Inject focus/hover stacking CSS for UIGroup elements
const STYLE_ID = 'toolcrib-group-styles';
function injectUIGroupStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const styleEl = document.createElement('style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    .toolcrib-group > * {
      position: relative;
    }
    .toolcrib-group > *:hover {
      z-index: 1;
    }
    .toolcrib-group > *:focus,
    .toolcrib-group > *:focus-within,
    .toolcrib-group > *:active {
      z-index: 2 !important;
    }
  `;
  document.head.appendChild(styleEl);
}

/** @manifest Merges adjacent elements into a single visual compound control */
export const UIGroup: React.FC<UIGroupProps> = ({
  children,
  orientation = 'horizontal',
  borderRadius = 'var(--ai-radius-md, 0.375rem)',
  className,
  style,
}) => {
  useEffect(() => {
    injectUIGroupStyles();
  }, []);

  const childArray = Children.toArray(children).filter(isValidElement);
  const total = childArray.length;

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={`toolcrib-group ${className || ''}`.trim()}
      role="group"
      style={{
        display: 'inline-flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        alignItems: 'stretch',
        ...style,
      }}
    >
      {childArray.map((child, index) => {
        const isFirst = index === 0;
        const isLast = index === total - 1;

        let topLeft = '0';
        let topRight = '0';
        let bottomLeft = '0';
        let bottomRight = '0';

        if (total === 1) {
          topLeft = borderRadius;
          topRight = borderRadius;
          bottomLeft = borderRadius;
          bottomRight = borderRadius;
        } else if (isHorizontal) {
          if (isFirst) {
            topLeft = borderRadius;
            bottomLeft = borderRadius;
          } else if (isLast) {
            topRight = borderRadius;
            bottomRight = borderRadius;
          }
        } else {
          // Vertical layout
          if (isFirst) {
            topLeft = borderRadius;
            topRight = borderRadius;
          } else if (isLast) {
            bottomLeft = borderRadius;
            bottomRight = borderRadius;
          }
        }

        const element = child as ReactElement<any>;
        const existingStyle = element.props.style || {};

        const allEqual = topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft;
        const radiusShorthand = allEqual ? topLeft : `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;

        return cloneElement(element, {
          key: element.key || index,
          style: {
            alignSelf: 'stretch',
            ...existingStyle,
            borderTopLeftRadius: topLeft,
            borderTopRightRadius: topRight,
            borderBottomLeftRadius: bottomLeft,
            borderBottomRightRadius: bottomRight,
            borderRadius: radiusShorthand,
            ...(isHorizontal && !isFirst ? { marginLeft: '-0.0625rem' } : {}),
            ...(!isHorizontal && !isFirst ? { marginTop: '-0.0625rem' } : {}),
          },
        });
      })}
    </div>
  );
};
