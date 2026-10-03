import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Meter } from '../components/Meter/Meter';
import { StyleDomainProvider } from '../theme/StyleDomainContext';
import { axe } from './testUtils/axe';

describe('Meter', () => {
  it('is a role="meter" (not a progressbar) carrying value, range and name', async () => {
    render(<Meter aria-label="Disk usage" value={40} min={10} max={80} />);
    const meter = screen.getByRole('meter', { name: 'Disk usage' });
    expect(meter).toHaveAttribute('aria-valuenow', '40');
    expect(meter).toHaveAttribute('aria-valuemin', '10');
    expect(meter).toHaveAttribute('aria-valuemax', '80');
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('clamps an out-of-range value to the range', () => {
    const { rerender } = render(<Meter aria-label="Quota" value={999} max={50} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50');
    rerender(<Meter aria-label="Quota" value={-5} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
  });

  it('names the meter from its visible label and shows the value on request', () => {
    render(<Meter aria-label="Storage" label="Storage used" value={30} showValue />);
    expect(screen.getByText('Storage used')).toBeInTheDocument();
    // Base UI formats as a percent of the range by default.
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('formats the shown value with the format prop', () => {
    render(<Meter aria-label="Spend" value={1500} max={5000} showValue format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} />);
    expect(screen.getByText('$1,500')).toBeInTheDocument();
  });

  describe('bands (the HTML <meter> rule)', () => {
    const band = (props: { value: number; low?: number; high?: number; optimum?: number }) => {
      const { unmount } = render(<Meter aria-label="m" {...props} />);
      const result = screen.getByRole('meter').getAttribute('data-band');
      unmount();
      return result;
    };

    it('has no band until low, high or optimum is set', () => {
      expect(band({ value: 95 })).toBeNull();
    });

    it('a low optimum makes a high reading critical (disk usage)', () => {
      const bands = { low: 50, high: 80, optimum: 20 };
      expect(band({ value: 30, ...bands })).toBe('optimal');
      expect(band({ value: 60, ...bands })).toBe('suboptimal');
      expect(band({ value: 90, ...bands })).toBe('critical');
    });

    it('a high optimum makes a low reading critical (battery, strength)', () => {
      const bands = { low: 20, high: 50, optimum: 90 };
      expect(band({ value: 95, ...bands })).toBe('optimal');
      expect(band({ value: 30, ...bands })).toBe('suboptimal');
      expect(band({ value: 10, ...bands })).toBe('critical');
    });

    it('a mid-range optimum makes both extremes suboptimal', () => {
      const bands = { low: 20, high: 80, optimum: 50 };
      expect(band({ value: 50, ...bands })).toBe('optimal');
      expect(band({ value: 5, ...bands })).toBe('suboptimal');
      expect(band({ value: 95, ...bands })).toBe('suboptimal');
    });

    it('colours the indicator by band, and an explicit subtheme wins over it', () => {
      // No label row here, so root > track > indicator.
      const indicator = () => screen.getByRole('meter').firstElementChild!.firstElementChild as HTMLElement;
      const { rerender } = render(<Meter aria-label="m" value={90} low={50} high={80} optimum={20} />);
      const banded = indicator().style.background;
      expect(banded).toContain('error');

      rerender(<Meter aria-label="m" value={90} low={50} high={80} optimum={20} subtheme="info" />);
      expect(indicator().style.background).toContain('info');
      expect(indicator().style.background).not.toBe(banded);
    });

    it("takes the surrounding StyleDomainProvider's subtheme over a band", () => {
      render(
        <StyleDomainProvider subtheme="info">
          <Meter aria-label="m" value={90} low={50} high={80} optimum={20} />
        </StyleDomainProvider>
      );
      const indicator = screen.getByRole('meter').firstElementChild!.firstElementChild as HTMLElement;
      expect(indicator.style.background).toContain('info');
    });
  });
});
