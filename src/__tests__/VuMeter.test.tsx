// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { VuMeter } from '../components/VuMeter/VuMeter';
import { StyleDomainProvider } from '../theme/StyleDomainContext';
import { getVuMeterVariables, VUMETER_THICKNESS_MAX, VUMETER_THICKNESS_MIN } from '../components/VuMeter/VuMeterSlice';

const part = (c: HTMLElement, name: string) => c.querySelector<HTMLElement>(`[data-vumeter-part="${name}"]`);

describe('VuMeter', () => {
  it('is a named meter whose value is the clamped level', () => {
    const { getByRole, rerender } = render(<VuMeter label="Input level" level={0.42} title="42% of capacity" />);
    const meter = getByRole('meter', { name: 'Input level' });
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('1');
    expect(meter.getAttribute('aria-valuenow')).toBe('0.42');
    expect(meter.getAttribute('aria-valuetext')).toBe('42% of capacity');
    rerender(<VuMeter label="Input level" level={7} valueText="over" title="t" />);
    expect(meter.getAttribute('aria-valuenow')).toBe('1');
    expect(meter.getAttribute('aria-valuetext')).toBe('over');
    rerender(<VuMeter label="Input level" level={-3} />);
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
  });

  it('clips the fill to the level and draws only the parts that were asked for', () => {
    const { container, rerender } = render(<VuMeter label="L" level={0.25} />);
    expect(part(container, 'fill')!.getAttribute('data-level')).toBe('25.0%');
    expect(part(container, 'fill')!.style.clipPath).toContain('75');
    for (const p of ['mark', 'peak', 'pressure', 'led', 'num']) expect(part(container, p)).toBeNull();

    rerender(<VuMeter label="L" level={0.25} mark={0.8} pressure={0.5} led value="1.2k/s" holdPeak />);
    expect(part(container, 'mark')!.style.left).toContain('80');
    expect(part(container, 'pressure')!.style.transform).toContain('scaleX(0.5');
    expect(part(container, 'led')!.getAttribute('data-on')).toBe('true');
    expect(part(container, 'led')!.getAttribute('aria-hidden')).toBe('true');
    expect(part(container, 'num')!.textContent).toBe('1.2k/s');
    expect(part(container, 'peak')).not.toBeNull();

    rerender(<VuMeter label="L" level={0.25} led={false} scale={false} />);
    expect(part(container, 'scale')).toBeNull();
    expect(part(container, 'led')!.getAttribute('data-on')).toBe('false');
  });

  it('holds the highest level as the peak while the level falls', () => {
    const { container, rerender } = render(<VuMeter label="L" level={0.9} holdPeak />);
    expect(part(container, 'peak')!.style.left).toContain('90');
    rerender(<VuMeter label="L" level={0.3} holdPeak />);
    expect(part(container, 'fill')!.getAttribute('data-level')).toBe('30.0%');
    expect(part(container, 'peak')!.style.left).toContain('90');
  });

  it('exposes size, kind, zone and live as data attributes; frames itself unless told not to', () => {
    const { getByRole, rerender } = render(<VuMeter label="L" level={0.5} size="sm" kind="share" zone="error" live />);
    const meter = getByRole('meter');
    expect(meter.dataset.size).toBe('sm');
    expect(meter.dataset.kind).toBe('share');
    expect(meter.dataset.zone).toBe('error');
    expect(meter.dataset.live).toBe('true');
    expect(meter.style.borderRadius).toBe('var(--ai-radius-md)');
    expect(meter.style.padding).not.toBe('0px');
    rerender(<VuMeter label="L" level={0.5} framed={false} fill dimmed />);
    expect(meter.style.padding).toBe('0px');
    expect(meter.style.display).toBe('flex');
    expect(meter.style.opacity).toBe('0.4');
    expect(meter.dataset.live).toBeUndefined();
  });

  it('takes a per-instance thickness override', () => {
    const { getByRole } = render(<VuMeter label="L" level={0.5} overrides={{ thickness: 3 }} />);
    expect(getByRole('meter').style.getPropertyValue('--ai-vumeter-thickness')).toBe('3');
  });
});

describe('VuMeter motion, font and slice plumbing', () => {
  it('animates with the kit transition tokens, not a hardcoded duration', () => {
    const { container } = render(<VuMeter label="L" level={0.5} live holdPeak pressure={0.3} />);
    for (const p of ['fill', 'peak', 'pressure']) {
      const t = part(container, p)!.style.transition;
      expect(t).toContain('--ai-transition-duration-normal');
      expect(t).toContain('--ai-transition-easing');
      expect(t).not.toContain('0.35s');
    }
  });

  it('reads the readout font from the Text slice variable', () => {
    const { container } = render(<VuMeter label="L" level={0.5} value="1" />);
    expect(part(container, 'num')!.style.fontFamily).toBe('var(--ai-text-font-mono, monospace)');
  });

  it('resolves its slice through useSliceOverrides, so a style domain does not break it', () => {
    const { getByRole } = render(
      <StyleDomainProvider subtheme="success">
        <VuMeter label="L" level={0.5} overrides={{ thickness: 2 }} />
      </StyleDomainProvider>,
    );
    expect(getByRole('meter').style.getPropertyValue('--ai-vumeter-thickness')).toBe('2');
  });
});

describe('VuMeter theme slice', () => {
  it('clamps the thickness to its range and falls back to the default for a bad value', () => {
    expect(getVuMeterVariables()['--ai-vumeter-thickness']).toBe('1.75');
    expect(getVuMeterVariables({ thickness: 99 })['--ai-vumeter-thickness']).toBe(String(VUMETER_THICKNESS_MAX));
    expect(getVuMeterVariables({ thickness: 0 })['--ai-vumeter-thickness']).toBe(String(VUMETER_THICKNESS_MIN));
    expect(getVuMeterVariables({ thickness: Number.NaN })['--ai-vumeter-thickness']).toBe('1.75');
  });
});
