import { useId } from 'react';
import { Select } from '../Form/Select';
import { Tooltip } from '../Tooltip/Tooltip';

/**
 * A `label` + `Select` pairing, optionally with an info tooltip — the
 * building block every slice's own `renderEditorControl` composes its
 * Theme Editor section from. Generates its own `id` via `useId()` rather
 * than requiring one from the caller: with 40+ call sites across every
 * slice file in the codebase, requiring each one to invent and pass a
 * unique id would just be a different flavor of the same repetition this
 * whole slice-consolidation effort exists to eliminate.
 * @barrelExport
 */
export function FieldRow({
  label,
  tooltip,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  tooltip?: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  /** Disables the underlying Select -- e.g. a mode under responsive breakpoint control, where one selected value can't represent every tier. */
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label htmlFor={id} style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.875rem' }}>{label}</label>
        {tooltip && (
          <Tooltip content={tooltip}>
            <span style={{ fontSize: '0.75rem', cursor: 'pointer' }}>ℹ️</span>
          </Tooltip>
        )}
      </div>
      <Select id={id} value={value} onChange={val => onChange(val)} options={options} disabled={disabled} />
    </div>
  );
}
