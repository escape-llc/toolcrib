import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { Rating } from '../components/Rating/Rating';
import { Drawer } from '../components/Overlay/Drawer';
import { CommandPalette } from '../components/CommandPalette/CommandPalette';

// #830: these accessible names and defaults were hard-coded English, so a
// non-English app had no way to translate them (no prop, no locale key).

describe('accessible names and defaults come from the locale layer', () => {
  it('Rating: interactive group, each star, and the read-only display', () => {
    const strings = {
      rating: {
        label: 'Bewertung',
        starCount: (n: number) => `${n} Sterne`,
        outOf: (v: number, m: number) => `${v} von ${m} Sternen`,
      },
    };
    const { unmount } = render(
      <LocaleProvider strings={strings}>
        <Rating defaultValue={2} />
      </LocaleProvider>
    );
    expect(screen.getByRole('radiogroup', { name: 'Bewertung' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3 Sterne' })).toBeInTheDocument();
    unmount();

    render(
      <LocaleProvider strings={strings}>
        <Rating defaultValue={3.5} readOnly />
      </LocaleProvider>
    );
    expect(screen.getByRole('img', { name: '3.5 von 5 Sternen' })).toBeInTheDocument();
  });

  it('Drawer: default title and close button', () => {
    render(
      <LocaleProvider strings={{ drawer: { defaultTitle: 'Seitenleiste', closeDrawer: 'Schließen' } }}>
        <Drawer isOpen>
          <p>Body</p>
        </Drawer>
      </LocaleProvider>
    );
    expect(screen.getByText('Seitenleiste')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
  });

  it('CommandPalette: dialog name, results region, placeholder and empty state', () => {
    render(
      <LocaleProvider
        strings={{
          commandPalette: {
            label: 'Befehlspalette',
            results: 'Ergebnisse',
            commands: 'Befehle',
            placeholder: 'Befehl suchen…',
            noResults: 'Nichts gefunden.',
          },
        }}
      >
        <CommandPalette items={[]} isOpen onOpenChange={() => {}} />
      </LocaleProvider>
    );
    expect(screen.getByPlaceholderText('Befehl suchen…')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ergebnisse' })).toBeInTheDocument();
    expect(screen.getByText('Nichts gefunden.')).toBeInTheDocument();
  });

  it('CommandPalette: an explicit placeholder prop still wins over the locale default', () => {
    render(<CommandPalette items={[]} isOpen onOpenChange={() => {}} placeholder="Custom…" />);
    expect(screen.getByPlaceholderText('Custom…')).toBeInTheDocument();
  });
});
