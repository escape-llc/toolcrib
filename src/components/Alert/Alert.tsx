'use client';

import React, { type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { type StyleFreeAttributes } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { resolveColorVariant, type ColorVariant, type Appearance } from '../../theme/colorVariant';
import { ICON_WRAPPER_STYLE } from '../../theme/iconWrapperStyle';
import { resolvePadding } from '../../theme/padding';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { aiBus } from '../../eventBus/eventBus';
import { Button } from '../Form/FormComponents';

/**
 * Props for the `<Alert>` inline callout.
 *
 * Not a dialog: an Alert sits in the page flow next to what it's about and
 * never interrupts. For a blocking confirmation use `<AlertDialog>`; for a
 * transient, self-dismissing notice use a toast.
 */
export interface AlertProps extends StyleFreeAttributes<HTMLDivElement> {
  /** Status color. Falls back to the nearest `<StyleDomainProvider>`'s, then `'info'`. Wins over `variant`. */
  subtheme?: SubthemeName;
  /** Identity color (`primary`/`secondary`) for a branded, non-status callout. Ignored if a subtheme resolves. */
  variant?: ColorVariant;
  /** Visual treatment for the resolved color. @default 'soft' */
  appearance?: Appearance;
  /** Replaces the status icon. `false` hides it. A default icon matches the subtheme (info, success, warning, error); a branded `variant` callout gets the info icon. */
  icon?: ReactNode | false;
  /**
   * Live-region role. `'alert'` (assertive) for error/warning, `'status'`
   * (polite) otherwise, by default -- screen readers announce the content
   * when it appears. `'none'` for a static callout that shouldn't be
   * announced at all.
   */
  role?: 'alert' | 'status' | 'none';
  /** An action rendered after the text, e.g. a `<Button size="sm">`. */
  action?: ReactNode;
  /** Renders a close button; called when it's pressed. The Alert doesn't hide itself -- remove it from the tree in this callback. Emits `alert:dismissed`. */
  onDismiss?: () => void;
}

/** Props for `<Alert.Title>`. */
export interface AlertTitleProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Props for `<Alert.Description>`. */
export interface AlertDescriptionProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

const DEFAULT_ICON: Record<SubthemeName, ReactNode> = {
  info: <Info size="1.125em" />,
  success: <CircleCheck size="1.125em" />,
  warning: <TriangleAlert size="1.125em" />,
  error: <CircleAlert size="1.125em" />,
};

/**
 * @manifest Inline callout (status icon, title, description, optional action and dismiss) with live-region semantics — in the page flow, never blocking
 * @manifestCategory Containers
 * @manifestAntiPatternAvoid Open an `<AlertDialog>`/`<Modal>` for a non-blocking message, or hand-roll a tinted `<div>` with an emoji and no `role`
 * @manifestAntiPatternInstead Use `<Alert>` for a message that belongs next to its content (role `alert`/`status` announces it); `<AlertDialog>` only when the user must decide before continuing
 */
export const Alert: React.FC<AlertProps> & {
  Title: React.FC<AlertTitleProps>;
  Description: React.FC<AlertDescriptionProps>;
} = ({ subtheme: instanceSubtheme, variant, appearance = 'soft', icon, role, action, onDismiss, children, ...props }) => {
  const resolvedSubtheme = useResolvedSubtheme(instanceSubtheme);
  // An identity variant with no subtheme is a branded callout; otherwise a
  // status one, defaulting to info.
  const subtheme: SubthemeName | undefined = resolvedSubtheme ?? (variant ? undefined : 'info');
  const colors = resolveColorVariant({ subtheme, variant, appearance })!;
  const strings = useLocaleStrings().alert;
  const liveRole = role ?? (subtheme === 'error' || subtheme === 'warning' ? 'alert' : 'status');
  const shownIcon = icon === false ? null : icon ?? DEFAULT_ICON[subtheme ?? 'info'];

  const dismiss = () => {
    onDismiss?.();
    aiBus.emit('alert:dismissed', { id: props.id, subtheme });
  };

  return (
    <div
      {...props}
      role={liveRole === 'none' ? undefined : liveRole}
      data-subtheme={subtheme}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        boxSizing: 'border-box',
        padding: resolvePadding(undefined, 'md'),
        borderRadius: 'var(--ai-radius-md, 0.375rem)',
        border: `0.0625rem solid ${colors.border}`,
        background: colors.background,
        color: colors.color,
        fontSize: '0.875rem',
        lineHeight: 'var(--ai-line-height, 1.5)',
      }}
    >
      {shownIcon && <span style={{ ...ICON_WRAPPER_STYLE, paddingTop: '0.125rem', flexShrink: 0 }}>{shownIcon}</span>}
      <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {children}
        {action && <div style={{ marginTop: '0.375rem' }}>{action}</div>}
      </div>
      {onDismiss && (
        <Button variant="ghost" size="sm" icon={<X size="1em" />} aria-label={strings.dismiss} onClick={dismiss} />
      )}
    </div>
  );
};

Alert.Title = ({ children, ...props }) => {
  return (
    <div {...props} style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
      {children}
    </div>
  );
};

Alert.Description = ({ children, ...props }) => {
  // Inherits the Alert's resolved text color; only the weight differs from the title.
  return <div {...props}>{children}</div>;
};

Alert.displayName = 'Alert';
Alert.Title.displayName = 'Alert.Title';
Alert.Description.displayName = 'Alert.Description';
