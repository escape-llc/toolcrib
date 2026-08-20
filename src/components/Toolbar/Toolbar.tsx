import React, { type ReactNode, createContext, useContext } from 'react';
import { Toolbar as ToolbarPrimitive } from 'radix-ui';
import { type PaddingMode, resolvePadding } from '../../theme/padding';
import { type MarginMode } from '../../theme/margin';
import { type CornerRadiusMode, resolveRadius } from '../../theme/radius';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { getSparseVariables } from '../../theme/slice';
import { ToolbarThemeSlice, type ToolbarSliceState } from './ToolbarSlice';
import { Button, type ButtonProps } from '../Form/FormComponents';

/**
 * Not exported — purely internal plumbing so `Toolbar.Left`/`.Center`/
 * `.Right`/`.Separator` (each its own component, rendered as arbitrary
 * `children` rather than known to `Toolbar` by literal type) can read the
 * orientation their parent `<Toolbar>` was given, the same "no prop-drilling"
 * shape `StyleDomainContext`/`LayoutDomainContext` already use elsewhere in
 * the toolkit for this exact kind of parent-configures-descendants need.
 */
const ToolbarOrientationContext = createContext<'horizontal' | 'vertical'>('horizontal');

/**
 * Props for the `<Toolbar>` horizontal container.
 *
 * Slot sub-components: `Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`.
 * Opt-in sub-components for arrow-key roving navigation between actions:
 * `Toolbar.Button`, `Toolbar.Separator`.
 */
// `dir` omitted: Radix's Toolbar.Root narrows it to its own `Direction`
// ('ltr' | 'rtl') type for the roving-focus group, incompatible with the
// plain `string` that HTMLAttributes' own `dir` allows — and toolcrib has
// no RTL story elsewhere to make exposing it meaningful yet.
export interface ToolbarProps extends Omit<StyleFreeAttributes<HTMLDivElement>, 'dir'> {
  children: ReactNode;
  /** Override padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
  /** Override margin using the theme margin token scale (unused, reserved). */
  marginMode?: MarginMode;
  /** Override corner radius using the theme radius token scale. */
  cornerRadiusMode?: CornerRadiusMode;
  /**
   * Arrow-key axis for the roving-tabindex group Radix's own `Toolbar.Root`
   * establishes. Only affects children rendered via `<Toolbar.Button>` —
   * arbitrary children (a plain `<Button>`, a `<Select>`, a `<Tooltip>`
   * trigger) never joined the group in the first place, so they keep normal
   * tab order regardless of this setting.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical';
  /** Per-instance override for the gap within each slot (`Toolbar.Left`/`.Center`/`.Right`). */
  overrides?: Partial<ToolbarSliceState>;
}

/** Props for Toolbar slot sub-components (`Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right`). */
export interface ToolbarSlotProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * @manifest Horizontal action bar with left/center/right slot areas
 * @manifestCategory Layout Primitives
 * @manifestChildren Toolbar.Left, Toolbar.Center, Toolbar.Right, Toolbar.Button, Toolbar.Separator
 */
export const Toolbar: React.FC<ToolbarProps> & {
  Left: React.FC<ToolbarSlotProps>;
  Center: React.FC<ToolbarSlotProps>;
  Right: React.FC<ToolbarSlotProps>;
  Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
  Separator: React.FC<{}>;
} = ({ children, paddingMode, marginMode, cornerRadiusMode, orientation = 'horizontal', overrides, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar');
  const toolbarVars = getSparseVariables(ToolbarThemeSlice, overrides ?? {});
  return (
    // Radix's Toolbar.Root: a plain div with role="toolbar" plus the
    // RovingFocusGroup context that `Toolbar.Button` below participates in.
    // Existing arbitrary children (this component's whole point — a plain
    // Button, a Select, a Tooltip-wrapped trigger, a bare <span>) never
    // register with that group, so they're entirely unaffected; only
    // children explicitly authored as `<Toolbar.Button>` get roving nav.
    <ToolbarPrimitive.Root
      orientation={orientation}
      {...props}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        boxSizing: 'border-box',
        gap: 'var(--ai-margin-gap, 0.875rem)',
        padding: paddingMode ? resolvePadding(paddingMode, 'sm') : undefined,
        borderRadius: cornerRadiusMode ? resolveRadius(cornerRadiusMode) : undefined,
        ...toolbarVars,
      }}
    >
      <ToolbarOrientationContext.Provider value={orientation}>{children}</ToolbarOrientationContext.Provider>
    </ToolbarPrimitive.Root>
  );
};

Toolbar.Left = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Left');
  const orientation = useContext(ToolbarOrientationContext);
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        gap: 'var(--ai-toolbar-slot-gap, 0.5rem)',
        justifyContent: 'flex-start',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Center = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Center');
  const orientation = useContext(ToolbarOrientationContext);
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        gap: 'var(--ai-toolbar-slot-gap, 0.5rem)',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      {children}
    </div>
  );
};

Toolbar.Right = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'Toolbar.Right');
  const orientation = useContext(ToolbarOrientationContext);
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        gap: 'var(--ai-toolbar-slot-gap, 0.5rem)',
        justifyContent: 'flex-end',
        flexShrink: 0,
        // 'auto' margin consumes leftover space along the flex container's
        // MAIN axis, which flips with flexDirection — marginLeft pushes to
        // the end of a row, but does nothing useful in a column (that's the
        // cross axis there); marginTop is the column equivalent.
        marginLeft: orientation === 'vertical' ? undefined : 'auto',
        marginTop: orientation === 'vertical' ? 'auto' : undefined,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Opt-in `<Button>` that joins the toolbar's roving-tabindex group — arrow
 * keys move focus between every `<Toolbar.Button>` in the bar instead of
 * each one taking its own Tab stop. Composed via Radix's own `asChild`
 * (same pattern as `AlertDialog.Cancel`/`.Action`), so it's toolcrib's
 * actual `<Button>` underneath — same variants/sizes/icons, not a
 * reimplementation — with Radix's roving-focus behavior layered on top.
 *
 * forwardRef, not a plain function component — a very natural composition
 * is wrapping this in `<Tooltip>` for an icon-only toolbar action, and
 * Tooltip's own `asChild` trigger needs a ref-forwarding child to clone
 * (same requirement, same reasoning, as `Button`'s own forwardRef above).
 * Radix's Slot (`ToolbarPrimitive.Button`'s own `asChild` below) composes
 * this forwarded ref with its own internal one automatically, so both the
 * outer Tooltip and the roving-focus group get a working ref to the same
 * real `<button>` DOM node.
 */
Toolbar.Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ children, ...buttonProps }, ref) => (
  <ToolbarPrimitive.Button asChild>
    <Button ref={ref} {...buttonProps}>{children}</Button>
  </ToolbarPrimitive.Button>
));

/**
 * Divider between toolbar sections — a vertical line in a horizontal
 * toolbar, a horizontal line in a vertical one. Skipped automatically by
 * roving arrow-key navigation. Thickness reads `--ai-separator-thickness`,
 * not a hardcoded value, so it responds to the same Theme Editor control
 * (and any instance/domain override) the standalone `<Separator>` does —
 * Radix's own `ToolbarPrimitive.Separator` is still required over reusing
 * `<Separator>` directly (it participates in the roving-focus group's
 * skip-on-navigate behavior), but that's a structural reason, not a reason
 * for the thickness *value* to diverge from the rest of the toolkit.
 */
Toolbar.Separator = () => {
  const orientation = useContext(ToolbarOrientationContext);
  const thickness = 'var(--ai-separator-thickness, 0.0625rem)';
  return (
    <ToolbarPrimitive.Separator
      style={
        orientation === 'vertical'
          ? { height: thickness, width: '100%', background: 'var(--ai-border, #e5e7eb)', margin: '0.125rem 0', flexShrink: 0 }
          : { width: thickness, alignSelf: 'stretch', background: 'var(--ai-border, #e5e7eb)', margin: '0 0.125rem', flexShrink: 0 }
      }
    />
  );
};

Toolbar.Left.displayName = 'Toolbar.Left';
Toolbar.Center.displayName = 'Toolbar.Center';
Toolbar.Right.displayName = 'Toolbar.Right';
Toolbar.Button.displayName = 'Toolbar.Button';
Toolbar.Separator.displayName = 'Toolbar.Separator';
