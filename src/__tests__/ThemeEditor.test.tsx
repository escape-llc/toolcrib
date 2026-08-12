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

function renderEditor() {
  return render(
    <ThemeProvider>
      <ThemeEditor />
    </ThemeProvider>
  );
}

describe('ThemeEditor', () => {
  it('renders every theme slice section, including Card and Tooltip (regression: previously wired into ThemeProvider/CSS variables with no editor UI)', () => {
    renderEditor();

    expect(screen.getByText(/Appearance & Base Color/)).toBeInTheDocument();
    expect(screen.getByText(/Density, Spacing & Elevation/)).toBeInTheDocument();
    expect(screen.getByText(/Motion, Transitions & Physics/)).toBeInTheDocument();
    expect(screen.getByText(/SlideOut Drawer & Retract Dynamics/)).toBeInTheDocument();
    expect(screen.getByText(/Accordion Header & Gap Spacing/)).toBeInTheDocument();
    expect(screen.getByText(/Card Padding & Header Layout/)).toBeInTheDocument();
    expect(screen.getByText(/Tooltip Styling & Theme/)).toBeInTheDocument();
    expect(screen.getByText(/Tab Group Panels & Variants/)).toBeInTheDocument();
    expect(screen.getByText(/Data Table Layout & Density/)).toBeInTheDocument();
    expect(screen.getByText(/Color Harmony & Typography/)).toBeInTheDocument();
    expect(screen.getByText(/Monochromatic Subthemes/)).toBeInTheDocument();
  });

  it('opening the Card section shows its current padding and header style values', () => {
    renderEditor();

    fireEvent.click(screen.getByText(/Card Padding & Header Layout/));

    // Select here is a custom Radix dropdown (SelectPrimitive), not a
    // native <select> — getByDisplayValue/fireEvent.change don't apply to
    // it. Checking the displayed label matches this suite's own existing
    // convention for this component (see RadixPrimitives.test.tsx's
    // "renders Select component with Radix UI options").
    expect(screen.getByText('Normal (1.25rem 1.5rem)')).toBeInTheDocument();
    expect(screen.getByText('Bordered (Bottom Border)')).toBeInTheDocument();
  });

  it('opening the Tooltip section shows its current theme and size values', () => {
    renderEditor();

    fireEvent.click(screen.getByText(/Tooltip Styling & Theme/));

    expect(screen.getByText('Dark (Default)')).toBeInTheDocument();
    expect(screen.getByText('Medium (Standard Padding & Font)')).toBeInTheDocument();
  });
});
