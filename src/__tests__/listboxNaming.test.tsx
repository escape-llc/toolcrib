import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Select } from '../components/Form/Select';
import { Combobox } from '../components/Form/Combobox';
import { FormField } from '../components/Form/FormComponents';

// Regression (#736): the popup listboxes of Select and Combobox had no
// accessible name. axe only let that pass while an open combobox pointed at
// the listbox through aria-controls; once the popups kept their listbox
// mounted through an exit animation (after the field had dropped
// aria-controls), the unnamed listbox was flagged. A listbox needs its own
// name regardless: the field's name, from aria-label or the FormField label.

const options = [{ label: 'Admin', value: 'admin' }, { label: 'Editor', value: 'editor' }];

describe('popup listboxes are named like their field', () => {
  it('Select, from aria-label', async () => {
    render(<Select value="editor" onChange={() => {}} options={options} aria-label="Role" />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Role' })).toBeInTheDocument());
  });

  it('Select, from its FormField label', async () => {
    render(<FormField name="role" label="Access role"><Select value="editor" onChange={() => {}} options={options} /></FormField>);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Access role' })).toBeInTheDocument());
  });

  it('Combobox, from ariaLabel', async () => {
    render(<Combobox options={options} ariaLabel="Skills" />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Skills' })).toBeInTheDocument());
  });

  it('Combobox, from its FormField label', async () => {
    render(<FormField name="skills" label="Team skills"><Combobox options={options} /></FormField>);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('listbox', { name: 'Team skills' })).toBeInTheDocument());
  });
});
