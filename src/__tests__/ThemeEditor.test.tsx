import { ComponentProps } from 'react';
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

  describe('themeManagement lockout prop', () => {
    it('shows every Save & Load Themes command by default', () => {
      renderEditor();

      expect(screen.getByText(/🍋 Lime \(Default\)/)).toBeInTheDocument(); // a bundled preset
      expect(screen.getByPlaceholderText('Theme name...')).toBeInTheDocument(); // the localStorage "save" field
      expect(screen.getByRole('button', { name: /⬇️ Export/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /⬆️ Import/ })).toBeInTheDocument();
    });

    it('hides the entire toolbar when themeManagement={false} — e.g. an app author shipping one fixed bundled theme', () => {
      renderEditor({ themeManagement: false });

      expect(screen.queryByText(/🍋 Lime \(Default\)/)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Theme name...')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /⬇️ Export/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /⬆️ Import/ })).not.toBeInTheDocument();
      // The rest of the editor (category groups) still renders normally.
      expect(screen.getByText(/Global Theme & Color System/)).toBeInTheDocument();
    });

    it('locks out individual commands without affecting the others', () => {
      renderEditor({ themeManagement: { import: false, library: false } });

      expect(screen.getByText(/🍋 Lime \(Default\)/)).toBeInTheDocument(); // presets still shown
      expect(screen.getByRole('button', { name: /⬇️ Export/ })).toBeInTheDocument(); // export still shown
      expect(screen.queryByPlaceholderText('Theme name...')).not.toBeInTheDocument(); // library locked out
      expect(screen.queryByRole('button', { name: /⬆️ Import/ })).not.toBeInTheDocument(); // import locked out
    });
  });
});
