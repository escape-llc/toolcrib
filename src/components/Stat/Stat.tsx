'use client';

import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { Card } from '../Card/Card';
import { Badge } from '../Badge/Badge';
import { Text } from '../Text/Text';
import { VStack, HStack } from '../Layout/Stack';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
import { Sparkline } from '../Chart/Sparkline';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { type SubthemeName } from '../../theme/subtheme';

/**
 * Props for the `<Stat>` KPI tile.
 *
 * One metric: its label, its value, how it moved, and optionally the trend
 * behind it. The change is read out in words ("Up 12.4%") as well as shown
 * with an arrow and a colour, so nothing depends on seeing either.
 */
export interface StatProps {
  /** What the metric is, e.g. "Revenue". Shown above the value. */
  label: string;
  /** The current value. A number is formatted with `format` and `locale`; a string is shown as given. */
  value: number | string;
  /** Options for formatting a numeric `value`, e.g. `{ style: 'currency', currency: 'USD' }`. @default plain number */
  format?: Intl.NumberFormatOptions;
  /**
   * How the value changed, in the units of `deltaFormat`. Its sign is the
   * direction (positive up, negative down, zero unchanged). Omit it for a tile
   * with no comparison.
   */
  delta?: number;
  /** Options for formatting `delta`. @default percent with at most one decimal, so `0.124` shows as `+12.4%` */
  deltaFormat?: Intl.NumberFormatOptions;
  /** What the change is measured against, e.g. "vs last week". Shown beside the change and included in its spoken form. */
  deltaLabel?: string;
  /**
   * Whether an increase is good news. Decides the colour of the change: green
   * when it moved the good way, red when it moved the bad way. Set it to
   * `false` for a metric like churn or latency. @default true
   */
  upIsGood?: boolean;
  /** Values behind the metric, oldest first, drawn as a small trend line. */
  trend?: number[];
  /**
   * BCP 47 locale tag for number formatting. Fixed rather than read from the
   * browser, for the same hydration-safety reason as `<NumberField>`.
   * @default 'en-US'
   */
  locale?: string;
}

const DEFAULT_DELTA_FORMAT: Intl.NumberFormatOptions = { style: 'percent', maximumFractionDigits: 1 };

/**
 * @manifest KPI tile: one metric with its value, a change since the last period (read out in words, coloured by whether up is good) and an optional trend line
 * @manifestCategory Data Display
 */
export const Stat: React.FC<StatProps> = ({
  label,
  value,
  format,
  delta,
  deltaFormat = DEFAULT_DELTA_FORMAT,
  deltaLabel,
  upIsGood = true,
  trend,
  locale = 'en-US',
}) => {
  const strings = useLocaleStrings().stat;

  const shownValue = useMemo(
    () => (typeof value === 'number' ? new Intl.NumberFormat(locale, format).format(value) : value),
    [value, format, locale]
  );

  const change = useMemo(() => {
    if (delta === undefined || Number.isNaN(delta)) return undefined;
    const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    // Signed for the eye ("+12.4%"); unsigned for the spoken form, where the
    // word "up" or "down" already says which way.
    const signed = new Intl.NumberFormat(locale, { ...deltaFormat, signDisplay: 'exceptZero' }).format(delta);
    const unsigned = new Intl.NumberFormat(locale, { ...deltaFormat, signDisplay: 'never' }).format(Math.abs(delta));
    const spoken = direction === 'up' ? strings.up(unsigned) : direction === 'down' ? strings.down(unsigned) : strings.unchanged;
    const good = direction === 'flat' ? undefined : (direction === 'up') === upIsGood;
    const subtheme: SubthemeName | undefined = good === undefined ? undefined : good ? 'success' : 'error';
    return { direction, signed, spoken, subtheme } as const;
  }, [delta, deltaFormat, locale, upIsGood, strings]);

  const Arrow = change?.direction === 'up' ? ArrowUp : change?.direction === 'down' ? ArrowDown : Minus;

  return (
    <Card>
      <Card.Content>
        <VStack gap="md">
          <Text size="sm" tone="secondary">{label}</Text>
          <Text as="p" size="xl" weight="semibold">{shownValue}</Text>
          {(change || trend) && (
            <HStack gap="sm" align="center" justify="between">
              {change ? (
                <HStack gap="xs" align="center" wrap>
                  {/* The words below carry the meaning for a screen reader; the
                      badge is its visual twin, so it is hidden from them. */}
                  <Badge subtheme={change.subtheme} size="sm" icon={<Arrow size="0.75rem" aria-hidden="true" />} aria-hidden="true">
                    {change.signed}
                  </Badge>
                  <VisuallyHidden>{deltaLabel ? `${change.spoken} ${deltaLabel}` : change.spoken}</VisuallyHidden>
                  {deltaLabel && (
                    <Text as="span" size="xs" tone="secondary" aria-hidden="true">{deltaLabel}</Text>
                  )}
                </HStack>
              ) : (
                <span />
              )}
              {trend && trend.length > 0 && <Sparkline values={trend} title={strings.trend(label)} />}
            </HStack>
          )}
        </VStack>
      </Card.Content>
    </Card>
  );
};
