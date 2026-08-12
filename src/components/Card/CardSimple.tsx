import React, { ReactNode } from 'react';
import { Card, CardProps } from './Card';

/**
 * Props for `<CardSimple>` — a shorthand card that eliminates slot boilerplate.
 *
 * Instead of composing `Card.Header`, `Card.Content`, etc., pass `title`, `subtitle`,
 * `footer`, and `actions` as props. The content goes in `children`.
 *
 * @example
 * ```tsx
 * <CardSimple title="Users" subtitle="Manage team members" actions={<Button>Add</Button>}>
 *   <DataTable data={users} columns={columns} />
 * </CardSimple>
 * ```
 *
 * @ai-hint Use `<CardSimple>` for quick single-purpose cards.
 *          Use `<Card>` with slots for complex layouts or when you need
 *          fine-grained control over header/footer rendering.
 */
export interface CardSimpleProps extends Omit<CardProps, 'children' | 'title'> {
  /** Title text rendered in the header. Omit to skip the header entirely. */
  title?: ReactNode;
  /** Secondary text rendered next to the title in the header. */
  subtitle?: ReactNode;
  /** Content rendered in the footer area. Omit to skip the footer. */
  footer?: ReactNode;
  /** Action elements (e.g. buttons) rendered in the footer's right side. */
  actions?: ReactNode;
  /** Main body content. */
  children: ReactNode;
}

/**
 * Generates `Card.Header`, `Card.Content`, `Card.Footer`, and `Card.Actions`
 * automatically from flat props. Passes through all `CardProps` to the root `<Card>`.
 * @manifest Token-saving shorthand for simple cards without slot composition
 * @manifestCategory Containers
 */
export const CardSimple: React.FC<CardSimpleProps> = ({
  title,
  subtitle,
  footer,
  actions,
  children,
  ...cardProps
}) => (
  <Card {...cardProps}>
    {(title || subtitle) && (
      <Card.Header>
        <span>{title}</span>
        {subtitle && (
          <span
            style={{
              fontWeight: 400,
              fontSize: '0.8125rem',
              color: 'var(--ai-text-secondary, #6b7280)',
              marginLeft: '0.75rem',
            }}
          >
            {subtitle}
          </span>
        )}
      </Card.Header>
    )}
    <Card.Content layout={cardProps.layout}>
      {children}
    </Card.Content>
    {(footer || actions) && (
      <Card.Footer>
        <div>{footer}</div>
        {actions && <Card.Actions>{actions}</Card.Actions>}
      </Card.Footer>
    )}
  </Card>
);

CardSimple.displayName = 'CardSimple';
