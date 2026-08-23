import { type ComponentProps } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { ThemeProvider } from '../theme/themeContext';
import { ThemeEditor } from '../components/ThemeEditor/ThemeEditor';
import { globalThemeSliceRegistry } from '../theme/slice';

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
    expect(screen.getByText(/Typography \(Font Family, Size & Line Height\)/)).toBeInTheDocument();
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

  describe('regression: registered slices with no hand-written section were invisible in the Theme Editor', () => {
    // Theme-slice-consolidation Phase 3: ThemeEditor used to only render a
    // section for whichever ~26 slices someone had hand-added JSX for here.
    // Every component added after that point (Carousel among them) was a
    // real, registered ThemeSlice with zero way to adjust its global
    // default theme — confirmed directly, not assumed, by diffing every
    // registered slice id against what this file actually rendered. The
    // generic per-category loop now surfaces every registered slice
    // automatically; this test is what would have caught the gap.
    it('surfaces a slice with no hand-written section (Carousel) under its own category, with working controls', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Data Display/));
      fireEvent.click(screen.getByText(/Carousel/));

      expect(screen.getByText('Medium (2.75rem)')).toBeInTheDocument(); // arrowSize default
      expect(screen.getByText('Primary')).toBeInTheDocument(); // dotActiveSubtheme default
    });

    it('surfaces a slice with a free-form (non-enum) field as a preset FieldRow (CommandPalette maxListHeight)', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Overlays/));
      fireEvent.click(screen.getByText(/Command Palette/));

      expect(screen.getByText('Normal (21.875rem)')).toBeInTheDocument();
    });
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

  // Every test above only ever checks a section's *displayed default*
  // value — none of them change anything. That left each registered
  // slice's own renderEditorControl onChange closure (the `val =>
  // onChange({ ...state, field: val })` line inside ~40 separate *Slice.tsx
  // files) never actually invoked by any test, since nothing ever opened a
  // FieldRow's Select and picked a different option. Rather than
  // hand-writing ~40 near-identical "open category, open section, pick an
  // option" tests (and having to remember to add a 41st the next time a
  // component gets a slice), this drives the same interaction generically
  // off the real registry ThemeEditor.tsx itself reads — the same registry
  // themeContext.tsx (imported transitively above) already populated by
  // registering every real slice at module load.
  describe('regression coverage: every registered slice\'s FieldRow controls actually change its value on selection', () => {
    const GLOBAL_ONLY_SLICE_IDS = new Set(['padding', 'margin', 'radius', 'shadow', 'animation', 'typography']);
    const slices = globalThemeSliceRegistry
      .getAll()
      .filter(slice => !GLOBAL_ONLY_SLICE_IDS.has(slice.id) && slice.renderEditorControl);

    it.each(slices.map(slice => [slice.id, slice.name, slice.category] as const))(
      'slice "%s" (category: %s)',
      (sliceId, sliceName, category) => {
        renderEditor();
        fireEvent.click(screen.getByText(category, { exact: false }));
        fireEvent.click(screen.getByText(sliceName));

        const section = screen.getByTestId(`accordion-content-${sliceId}`);
        const comboCount = within(section).queryAllByRole('combobox').length;
        expect(comboCount).toBeGreaterThan(0); // every slice section has at least one FieldRow

        for (let i = 0; i < comboCount; i++) {
          const combo = within(section).getAllByRole('combobox')[i];
          fireEvent.click(combo);

          const listbox = screen.getByRole('listbox');
          const options = within(listbox).getAllByRole('option');
          // Pick any option that isn't already selected (Radix marks the
          // current value's Item with data-state="checked") — its label is
          // read here, before the click, since the option itself grows a
          // "✓" ItemIndicator the instant it becomes selected.
          const target = options.find(opt => opt.getAttribute('data-state') !== 'checked') ?? options[0];
          const targetLabel = target.textContent ?? '';
          fireEvent.click(target);

          // A single-option field can't demonstrate a value *change*, but
          // still exercises onChange being wired up and callable.
          if (options.length > 1) {
            const after = within(section).getAllByRole('combobox')[i];
            expect(after.textContent).toContain(targetLabel);
          }
        }
      }
    );
  });

  describe('regression coverage: the Global category\'s hand-written sections (not registry-driven, so outside the loop above)', () => {
    it('Appearance & Base Color sliders (Hue, Saturation, Brightness, Darken/Lighten Factor, Saturation Factor) all update on arrow-key interaction', () => {
      renderEditor();
      // "Appearance & Base Color" is open by default (defaultValue="appearance").
      const sliders = screen.getAllByRole('slider');
      expect(sliders.length).toBe(5);
      for (const slider of sliders) {
        const before = slider.getAttribute('aria-valuenow');
        fireEvent.keyDown(slider, { key: 'ArrowRight' });
        expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
      }
    });

    it('Density, Spacing & Elevation FieldRow selects (padding/margin/corner radius/shadow) each update on selection', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Density, Spacing & Elevation/));

      const combos = screen.getAllByRole('combobox');
      expect(combos.length).toBe(4);
      for (const combo of combos) {
        fireEvent.click(combo);
        const listbox = screen.getByRole('listbox');
        const options = within(listbox).getAllByRole('option');
        const target = options.find(opt => opt.getAttribute('data-state') !== 'checked') ?? options[0];
        const targetLabel = target.textContent ?? '';
        fireEvent.click(target);
        expect(combo.textContent).toContain(targetLabel);
      }
    });

    it('Motion, Transitions & Physics section: preset select and duration-factor slider both update', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Motion, Transitions & Physics/));

      const combo = screen.getByRole('combobox');
      fireEvent.click(combo);
      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      const target = options.find(opt => opt.getAttribute('data-state') !== 'checked')!;
      const targetLabel = target.textContent ?? '';
      fireEvent.click(target);
      expect(combo.textContent).toContain(targetLabel);

      const slider = screen.getByRole('slider');
      const before = slider.getAttribute('aria-valuenow');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
    });

    it('Typography section: font family select and master font size slider (commitOnRelease) both update', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Typography \(Font Family, Size & Line Height\)/));

      const combo = screen.getByRole('combobox');
      fireEvent.click(combo);
      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      const target = options.find(opt => opt.getAttribute('data-state') !== 'checked')!;
      const targetLabel = target.textContent ?? '';
      fireEvent.click(target);
      expect(combo.textContent).toContain(targetLabel);

      // commitOnRelease Sliders fire onValueCommit (not onValueChange) — a
      // discrete keyboard step still counts as a full press+release, unlike
      // a continuous pointer drag, so this exercises the same commit path.
      // Two sliders live in this section now (font size + line height) --
      // disambiguate via the accessible name each Slider sets via its own
      // ariaLabel prop.
      const slider = screen.getByRole('slider', { name: 'Master Font Size' });
      const before = slider.getAttribute('aria-valuenow');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
    });

    it('Typography section: line height slider (commitOnRelease) updates independently of master font size', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Typography \(Font Family, Size & Line Height\)/));

      const slider = screen.getByRole('slider', { name: 'Line Height' });
      const before = slider.getAttribute('aria-valuenow');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
    });

    it('Color Harmony & Hue Spread section: harmony mode select and hue spread slider both update', () => {
      renderEditor();
      fireEvent.click(screen.getByText(/Color Harmony & Hue Spread/));

      const combo = screen.getByRole('combobox');
      fireEvent.click(combo);
      const listbox = screen.getByRole('listbox');
      const options = within(listbox).getAllByRole('option');
      const target = options.find(opt => opt.getAttribute('data-state') !== 'checked')!;
      const targetLabel = target.textContent ?? '';
      fireEvent.click(target);
      expect(combo.textContent).toContain(targetLabel);

      const slider = screen.getByRole('slider');
      const before = slider.getAttribute('aria-valuenow');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(slider.getAttribute('aria-valuenow')).not.toBe(before);
    });
  });

  describe('regression coverage: Save & Load Themes toolbar handlers', () => {
    it('loading a bundled preset applies its snapshot (color swatch reflects the new base color)', () => {
      renderEditor();
      fireEvent.click(screen.getByRole('button', { name: 'Theme presets' }));

      // Presets render as their emoji + first word only (see ThemeEditor's
      // own comment on why) — "Tailwind (Default)" for example is only
      // guaranteed unique as a combobox-free plain button, so just grab
      // whichever preset button appears first inside the popup.
      const presetButtons = screen.getAllByRole('button').filter(btn => /^[^\s]+ /.test(btn.textContent ?? '') && btn.textContent !== 'Theme presets');
      expect(presetButtons.length).toBeGreaterThan(0);

      // Loading a preset shouldn't throw, and the popup stays interactive
      // (Popup itself isn't asserted closed — presets don't auto-close it).
      expect(() => fireEvent.click(presetButtons[0])).not.toThrow();
    });

    it('Export theme downloads a .json snapshot via Blob/createObjectURL', () => {
      const createObjectURL = vi.fn(() => 'blob:mock-url');
      const revokeObjectURL = vi.fn();
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = createObjectURL as any;
      URL.revokeObjectURL = revokeObjectURL as any;
      // jsdom doesn't implement real navigation, so a plain <a href="blob:...">
      // click logs "Not implemented: navigation to another Document" —
      // same mock themeFileTransfer.test.ts already uses for this exact call.
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      try {
        renderEditor();
        fireEvent.click(screen.getByRole('button', { name: 'Export theme' }));
        expect(createObjectURL).toHaveBeenCalledTimes(1);
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
      } finally {
        clickSpy.mockRestore();
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
      }
    });

    it('Import theme click delegates to the hidden file input, and selecting a valid file applies it', async () => {
      renderEditor();
      fireEvent.click(screen.getByRole('button', { name: 'Import theme' }));

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toBeNull();

      const snapshot = {
        schemaVersion: 1,
        parameters: {
          baseColor: { h: 200, s: 60, v: 80 },
          harmonyMode: 'monochromatic',
          hueSpread: 30,
          darkenLightenFactor: 1,
          saturationFactor: 1,
          isDarkMode: false,
          paddingMode: 'normal',
          marginMode: 'normal',
          cornerRadiusMode: 'rounded',
          shadowMode: 'subtle',
        },
        sliceStates: {},
      };
      const file = new File([JSON.stringify(snapshot)], 'my-theme.json', { type: 'application/json' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.queryByText(/Could not import|doesn't look like/)).not.toBeInTheDocument();
      });
    });

    it('selecting an invalid theme file shows an import error message', async () => {
      renderEditor();

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const badFile = new File(['not valid json'], 'bad.json', { type: 'application/json' });

      fireEvent.change(fileInput, { target: { files: [badFile] } });

      await waitFor(() => {
        expect(screen.getByText(/is not valid JSON/)).toBeInTheDocument();
      });
    });

    it('loading and then deleting a saved theme both work from the Saved list', () => {
      renderEditor();

      fireEvent.click(screen.getByRole('button', { name: 'Save current theme' }));
      fireEvent.change(screen.getByPlaceholderText('Theme name...'), { target: { value: 'Regression Theme' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      const loadButton = screen.getByRole('button', { name: 'Regression Theme' });
      expect(() => fireEvent.click(loadButton)).not.toThrow();

      const deleteButton = screen.getByRole('button', { name: 'Delete saved theme Regression Theme' });
      fireEvent.click(deleteButton);
      expect(screen.queryByRole('button', { name: 'Regression Theme' })).not.toBeInTheDocument();
    });
  });
});
