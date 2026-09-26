import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Alert } from '../components/Alert/Alert';
import { StyleDomainProvider } from '../theme/StyleDomainContext';
import { LocaleProvider } from '../components/Locale/LocaleContext';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

describe('Alert', () => {
  it('renders its title and description slots', () => {
    render(
      <Alert>
        <Alert.Title>Heads up</Alert.Title>
        <Alert.Description>Your trial ends in 3 days.</Alert.Description>
      </Alert>
    );
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Your trial ends in 3 days.')).toBeInTheDocument();
  });

  describe('live-region role', () => {
    it.each([
      ['error', 'alert'],
      ['warning', 'alert'],
      ['success', 'status'],
      ['info', 'status'],
    ] as const)('%s -> role="%s"', (subtheme, role) => {
      render(<Alert subtheme={subtheme}>Message</Alert>);
      expect(screen.getByRole(role)).toHaveTextContent('Message');
    });

    it('defaults to an info/status alert when no subtheme or variant is given', () => {
      render(<Alert>Message</Alert>);
      expect(screen.getByRole('status')).toHaveAttribute('data-subtheme', 'info');
    });

    it('takes its subtheme from the nearest StyleDomainProvider', () => {
      render(
        <StyleDomainProvider subtheme="error">
          <Alert>Message</Alert>
        </StyleDomainProvider>
      );
      expect(screen.getByRole('alert')).toHaveAttribute('data-subtheme', 'error');
    });

    it('lets role be overridden, including "none" for a static callout', () => {
      const { rerender } = render(<Alert subtheme="error" role="status">Message</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
      rerender(<Alert subtheme="error" role="none">Message</Alert>);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('icon', () => {
    it('shows a decorative default icon for the subtheme', () => {
      const { container } = render(<Alert subtheme="warning">Message</Alert>);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('can be replaced or hidden', () => {
      const { container, rerender } = render(<Alert icon={<span data-testid="custom">!</span>}>Message</Alert>);
      expect(screen.getByTestId('custom')).toBeInTheDocument();
      expect(container.querySelector('svg')).not.toBeInTheDocument();
      rerender(<Alert icon={false}>Message</Alert>);
      expect(container.querySelector('svg')).not.toBeInTheDocument();
    });
  });

  describe('dismiss', () => {
    it('renders no close button without onDismiss', () => {
      render(<Alert>Message</Alert>);
      expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    });

    it('calls onDismiss and emits alert:dismissed when the close button is pressed', () => {
      const onDismiss = vi.fn();
      const handler = vi.fn();
      const unsub = aiBus.on('alert:dismissed', handler);
      render(
        <Alert id="trial-alert" subtheme="warning" onDismiss={onDismiss}>
          Message
        </Alert>
      );
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ id: 'trial-alert', subtheme: 'warning' });
      unsub();
    });

    it('localizes the close button name', () => {
      render(
        <LocaleProvider strings={{ alert: { dismiss: 'Schließen' } }}>
          <Alert onDismiss={() => {}}>Message</Alert>
        </LocaleProvider>
      );
      expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
    });
  });

  it('renders an action after the text', () => {
    render(<Alert action={<button>Upgrade</button>}>Message</Alert>);
    expect(screen.getByRole('button', { name: 'Upgrade' })).toBeInTheDocument();
  });

  // Compile-time contract, like every toolcrib component: no runtime
  // warning or stripping (#652). tsc fails this file if either becomes a prop.
  it('rejects style/className at compile time', () => {
    // @ts-expect-error -- style is not an Alert prop
    const withStyle = <Alert style={{ color: 'hotpink' }}>Message</Alert>;
    // @ts-expect-error -- className is not an Alert prop
    const withClassName = <Alert className="x">Message</Alert>;
    expect([withStyle, withClassName]).toHaveLength(2);
  });

  it('has no axe violations, with slots, an action and a dismiss button', async () => {
    const { container } = render(
      <div>
        <Alert subtheme="error" onDismiss={() => {}} action={<button>Retry</button>}>
          <Alert.Title>Upload failed</Alert.Title>
          <Alert.Description>The file was larger than 2 MB.</Alert.Description>
        </Alert>
        <Alert variant="primary">Branded callout</Alert>
      </div>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
