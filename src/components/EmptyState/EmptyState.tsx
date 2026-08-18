import React, { ReactNode } from 'react';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/** Props for the root `<EmptyState>` container. */
export interface EmptyStateProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Props for the `<EmptyState.Icon>` slot. */
export interface EmptyStateIconProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Props for the `<EmptyState.Title>` slot. */
export interface EmptyStateTitleProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Props for the `<EmptyState.Description>` slot. */
export interface EmptyStateDescriptionProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** Props for the `<EmptyState.Action>` slot. */
export interface EmptyStateActionProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
}

/**
 * @manifest Slot-based placeholder for an empty list/search/error state — same compositional pattern as `<Card>`
 * @manifestConstraints Only `<EmptyState.Title>` is expected — Icon/Description/Action are all optional
 * @manifestCategory Data Display
 */
export const EmptyState: React.FC<EmptyStateProps> & {
  Icon: React.FC<EmptyStateIconProps>;
  Title: React.FC<EmptyStateTitleProps>;
  Description: React.FC<EmptyStateDescriptionProps>;
  Action: React.FC<EmptyStateActionProps>;
} = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'EmptyState');
  return (
    <div
      {...props}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '0.5rem',
        padding: 'var(--ai-padding-lg, 2.5rem 1.5rem)',
      }}
    >
      {children}
    </div>
  );
};

EmptyState.Icon = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'EmptyState.Icon');
  return (
    <div
      {...props}
      style={{
        fontSize: '2.5rem',
        lineHeight: 1,
        color: 'var(--ai-text-secondary, #9ca3af)',
        marginBottom: '0.5rem',
      }}
    >
      {children}
    </div>
  );
};

EmptyState.Title = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'EmptyState.Title');
  return (
    <div
      {...props}
      style={{
        fontWeight: 'var(--ai-font-weight-bold, 700)',
        fontSize: '1rem',
        color: 'var(--ai-text-primary, #111827)',
      }}
    >
      {children}
    </div>
  );
};

EmptyState.Description = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'EmptyState.Description');
  return (
    <div
      {...props}
      style={{
        fontSize: '0.875rem',
        color: 'var(--ai-text-secondary, #6b7280)',
        maxWidth: '24rem',
      }}
    >
      {children}
    </div>
  );
};

EmptyState.Action = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'EmptyState.Action');
  return (
    <div
      {...props}
      style={{
        marginTop: '0.75rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
};

EmptyState.Icon.displayName = 'EmptyState.Icon';
EmptyState.Title.displayName = 'EmptyState.Title';
EmptyState.Description.displayName = 'EmptyState.Description';
EmptyState.Action.displayName = 'EmptyState.Action';
