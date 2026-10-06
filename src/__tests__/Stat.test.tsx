import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stat } from '../components/Stat/Stat';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { axe } from './testUtils/axe';

/** The visible change badge: the one aria-hidden element holding the signed text. */
const badge = (text: string) => screen.getByText(text).closest('span[aria-hidden="true"]') as HTMLElement;

describe('Stat', () => {
  it('shows the label and a string value as given', () => {
    render(<Stat label="Plan" value="Pro" />);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('formats a numeric value with format and locale', () => {
    const { rerender } = render(<Stat label="Revenue" value={2020000} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} />);
    expect(screen.getByText('$2,020,000')).toBeInTheDocument();
    rerender(<Stat label="Gewicht" value={1234.5} locale="de-DE" />);
    expect(screen.getByText('1.234,5')).toBeInTheDocument();
  });

  describe('the change', () => {
    it('is shown signed and read out in words, with the comparison', () => {
      render(<Stat label="Revenue" value={100} delta={0.124} deltaLabel="vs last week" />);
      expect(screen.getByText('+12.4%')).toBeInTheDocument();
      // The spoken form: direction in words, unsigned size, then what it is measured against.
      expect(screen.getByText('Up 12.4% vs last week')).toBeInTheDocument();
    });

    it('says "Down" for a decrease and "No change" for zero', () => {
      const { rerender } = render(<Stat label="Churn" value={2} delta={-0.005} />);
      expect(screen.getByText('-0.5%')).toBeInTheDocument();
      expect(screen.getByText('Down 0.5%')).toBeInTheDocument();
      rerender(<Stat label="Churn" value={2} delta={0} />);
      expect(screen.getByText('No change')).toBeInTheDocument();
    });

    it('hides the visual badge from assistive tech so the change is not read twice', () => {
      render(<Stat label="Revenue" value={100} delta={0.124} />);
      expect(badge('+12.4%')).toHaveAttribute('aria-hidden', 'true');
    });

    it('formats with deltaFormat, e.g. an absolute change', () => {
      render(<Stat label="Users" value={8420} delta={380} deltaFormat={{ maximumFractionDigits: 0 }} />);
      expect(screen.getByText('+380')).toBeInTheDocument();
      expect(screen.getByText('Up 380')).toBeInTheDocument();
    });

    it('is omitted entirely without a delta', () => {
      render(<Stat label="Plan" value="Pro" />);
      expect(screen.queryByText(/Up |Down |No change/)).not.toBeInTheDocument();
    });

    // Colour is the only place goodness shows, so check the two directions
    // swap when upIsGood flips, and that zero is neither.
    it('colours by whether the move was the good way, and upIsGood flips it', () => {
      const bg = (ui: React.ReactElement) => {
        const { unmount } = render(ui);
        // The signed badge text ("+10%", "-10%", "0%"), not the spoken "Up 10%".
        const b = badge(screen.getByText(/^[+-]?\d+(\.\d+)?%$/).textContent!).style.background;
        unmount();
        return b;
      };
      const upGood = bg(<Stat label="a" value={1} delta={0.1} />);
      const upBad = bg(<Stat label="a" value={1} delta={0.1} upIsGood={false} />);
      const downBad = bg(<Stat label="a" value={1} delta={-0.1} />);
      const downGood = bg(<Stat label="a" value={1} delta={-0.1} upIsGood={false} />);
      const flat = bg(<Stat label="a" value={1} delta={0} />);
      expect(upGood).toBe(downGood);
      expect(upBad).toBe(downBad);
      expect(upGood).not.toBe(upBad);
      expect(flat).not.toBe(upGood);
      expect(flat).not.toBe(upBad);
    });
  });

  describe('the trend', () => {
    it('draws a sparkline named after the stat', () => {
      render(<Stat label="Revenue" value={100} trend={[1, 2, 3]} />);
      expect(screen.getByRole('img', { name: 'Revenue trend' })).toBeInTheDocument();
    });

    it('draws nothing for an empty trend', () => {
      render(<Stat label="Revenue" value={100} trend={[]} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  it('takes its spoken strings from the locale', () => {
    render(
      <LocaleProvider strings={{ stat: { up: change => `Hoch ${change}`, trend: label => `Verlauf ${label}` } }}>
        <Stat label="Umsatz" value={1} delta={0.1} trend={[1, 2]} />
      </LocaleProvider>
    );
    expect(screen.getByText('Hoch 10%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Verlauf Umsatz' })).toBeInTheDocument();
  });

  it('passes the standing axe scan', async () => {
    render(<Stat label="Revenue" value={2020000} delta={0.124} deltaLabel="vs last week" trend={[1, 2, 3, 4]} />);
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
