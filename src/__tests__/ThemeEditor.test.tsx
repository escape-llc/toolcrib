import { type ComponentProps } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../theme/themeContext';
import { ThemeEditor } from '../components/ThemeEditor/ThemeEditor';

// ThemeEditor renders <Accordion>, which (via Radix) uses ResizeObserver —
// not implemented in jsdom. Same polyfill pattern already used in
// RadixPrimitives.test.tsx and eventBusTraffic.test.tsx for the same reason.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

function renderEditor(props?: ComponentProps<typeof ThemeEditor>) {
  return render(
    <ThemeProvider>
      <ThemeEditor {...props} />
    </ThemeProvider>
  );
}

describe('ThemeEditor', () => {
  it('renders the top-level category groups, and the Global group (open by default) shows its sections', () => {
    renderEditor();

    // Top-level categories, mirroring ThemeSliceCategory — each is its own
    // outer Accordion item whose content is a nested per-component Accordion.
    expect(screen.getByText(/Global Theme & Color System/)).toBeInTheDocument();
    expect(screen.getByText(/Layout Primitives/)).toBeInTheDocument();
    expect(screen.getByText(/Containers/)).toBeInTheDocument();
    expect(screen.getByText(/Overlays/)).toBeInTheDocument();
    expect(screen.getByText(/Data Display/)).toBeInTheDocument();
    expect(screen.getByText(/Form Controls/)).toBeInTheDocument();

    // The "Global" category is open by default, so its nested Accordion's
    // item triggers (not necessarily their panel content) are already in
    // the DOM without needing an extra click.
    expect(screen.getByText(/Appearance & Base Color/)).toBeInTheDocument();
    expect(screen.getByText(/Typography \(Font Family & Size\)/)).toBeInTheDocument();
    expect(screen.getByText(/Density, Spacing & Elevation/)).toBeInTheDocument();
    expect(screen.getByText(/Motion, Transitions & Physics/)).toBeInTheDocument();
    expect(screen.getByText(/Color Harmony & Hue Spread/)).toBeInTheDocument();
    expect(screen.getByText(/Monochromatic Subthemes/)).toBeInTheDocument();
  });

  it('opening the Containers category then the Card section shows its current padding and header style values', () => {
    renderEditor();

    // Radix Accordion.Content isn't mounted while its item is closed, so
    // the Containers category (not open by default) must be expanded
    // before its nested Card/Collapsible/App Shell items exist to click.
    fireEvent.click(screen.getByText(/Containers/));
    fireEvent.click(screen.getByText(/🃏 Card/));

    // Select here is a custom Radix dropdown (SelectPrimitive), not a
    // native <select> — getByDisplayValue/fireEvent.change don't apply to
    // it. Checking the displayed label matches this suite's own existing
    // convention for this component (see RadixPrimitives.test.tsx's
    // "renders Select component with Radix UI options").
    expect(screen.getByText('Normal (1.25rem 1.5rem)')).toBeInTheDocument();
    expect(screen.getByText('Bordered (Bottom Border)')).toBeInTheDocument();
  });

  it('opening the Overlays category then the Tooltip section shows its current theme and size values', () => {
    renderEditor();

    fireEvent.click(screen.getByText(/Overlays/));
    fireEvent.click(screen.getByText(/💬 Tooltip/));

    expect(screen.getByText('Dark (Default)')).toBeInTheDocument();
    expect(screen.getByText('Medium (Standard Padding & Font)')).toBeInTheDocument();
  });

  it('regression: FieldRow labels are associated with their Select via a matching htmlFor/id (previously unassociated)', () => {
    // FieldRow rendered a bare <label> with no htmlFor next to a Select
    // with no id — every one of its ~50 call sites across this file had no
    // programmatic label association at all. useId() inside FieldRow now
    // generates a shared id for both, with no per-call-site change needed.
    renderEditor();
    fireEvent.click(screen.getByText(/Density, Spacing & Elevation/));

    const label = screen.getByText('Global Padding Mode');
    const labelFor = label.getAttribute('for');
    expect(labelFor).toBeTruthy();

    const associatedControl = document.getElementById(labelFor!);
    expect(associatedControl).not.toBeNull();
    expect(associatedControl).toHaveAttribute('role', 'combobox');
  });

  describe('themeManagement lockout prop', () => {
    it('shows every Save & Load Themes command by default', () => {
      renderEditor();

      // Presets live behind a Popup trigger now (see ThemeEditor's own
      // comment on why — UIGroup density), not shown as visible text
      // directly; the trigger's own accessible name is what's checked.
      expect(screen.getByRole('button', { name: 'Theme presets' })).toBeInTheDocument();
      // The name field/OK/Cancel live inside the "Save current theme"
      // Popup now, not inline in the toolbar — only the trigger is visible
      // until it's opened (see the dedicated describe block below).
      expect(screen.getByRole('button', { name: 'Save current theme' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Export theme' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Import theme' })).toBeInTheDocument();
    });

    it('hides the entire toolbar when themeManagement={false} — e.g. an app author shipping one fixed bundled theme', () => {
      renderEditor({ themeManagement: false });

      expect(screen.queryByRole('button', { name: 'Theme presets' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save current theme' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Export theme' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Import theme' })).not.toBeInTheDocument();
      // The rest of the editor (category groups) still renders normally.
      expect(screen.getByText(/Global Theme & Color System/)).toBeInTheDocument();
    });

    it('locks out individual commands without affecting the others', () => {
      renderEditor({ themeManagement: { import: false, library: false } });

      expect(screen.getByRole('button', { name: 'Theme presets' })).toBeInTheDocument(); // presets still shown
      expect(screen.getByRole('button', { name: 'Export theme' })).toBeInTheDocument(); // export still shown
      expect(screen.queryByRole('button', { name: 'Save current theme' })).not.toBeInTheDocument(); // library locked out
      expect(screen.queryByRole('button', { name: 'Import theme' })).not.toBeInTheDocument(); // import locked out
    });
  });

  describe('"Save current theme" popup', () => {
    it('opens on trigger click, saves via OK, and closes itself afterward', () => {
      renderEditor();

      expect(screen.queryByPlaceholderText('Theme name...')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Save current theme' }));
      expect(screen.getByPlaceholderText('Theme name...')).toBeInTheDocument();

      // OK stays disabled until a non-empty name is entered — same
      // guard the old inline Save button had.
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText('Theme name...'), { target: { value: 'My Saved Theme' } });
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.queryByPlaceholderText('Theme name...')).not.toBeInTheDocument(); // popup closed itself
      expect(screen.getByRole('button', { name: 'My Saved Theme' })).toBeInTheDocument(); // now in the Saved list
    });

    it('discards the typed name and closes on Cancel, without saving anything', () => {
      renderEditor();

      fireEvent.click(screen.getByRole('button', { name: 'Save current theme' }));
      fireEvent.change(screen.getByPlaceholderText('Theme name...'), { target: { value: 'Abandoned Theme' } });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByPlaceholderText('Theme name...')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Abandoned Theme' })).not.toBeInTheDocument();

      // Reopening starts fresh — Cancel cleared the name, not just hid the popup.
      fireEvent.click(screen.getByRole('button', { name: 'Save current theme' }));
      expect(screen.getByPlaceholderText('Theme name...')).toHaveValue('');
    });
  });

  describe('themeManagementSlot', () => {
    it('replaces the entire built-in toolbar with custom content, ignoring themeManagement', () => {
      renderEditor({
        // Given alongside themeManagement to confirm the slot wins outright
        // rather than merging with it.
        themeManagement: { presets: false },
        themeManagementSlot: <button>My Custom Theme Picker</button>,
      });

      expect(screen.getByText('My Custom Theme Picker')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Theme presets' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Save current theme' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Export theme' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Import theme' })).not.toBeInTheDocument();
      // The rest of the editor still renders normally around the slot.
      expect(screen.getByText(/Global Theme & Color System/)).toBeInTheDocument();
    });

    it('still renders the header wrapper for a slot even when themeManagement={false}', () => {
      // themeManagementSlot takes precedence over the boolean lockout too —
      // false alone hides the toolbar, but a slot means the caller wants
      // *something* shown here regardless.
      renderEditor({ themeManagement: false, themeManagementSlot: <span>Custom UI</span> });

      expect(screen.getByText('Custom UI')).toBeInTheDocument();
    });

    it('hides the toolbar entirely for themeManagementSlot={null}, instead of falling back to the built-in toolbar', () => {
      // Regression test: showThemeToolbar used to check `!== undefined`
      // while the render site used `??` (null-or-undefined). A consumer
      // conditionally passing `themeManagementSlot={condition ? <X/> : null}`
      // — a natural conditional-slot idiom — got a bordered, empty toolbar
      // box: showThemeToolbar counted `null` as "a slot was given" (true),
      // but `null ?? defaultThemeManagementContent` then rendered the
      // built-in toolbar anyway, matching neither the caller's slot content
      // nor a hidden toolbar.
      renderEditor({ themeManagement: false, themeManagementSlot: null });

      expect(screen.queryByTestId('theme-editor-toolbar')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Theme presets' })).not.toBeInTheDocument();
    });
  });
});
