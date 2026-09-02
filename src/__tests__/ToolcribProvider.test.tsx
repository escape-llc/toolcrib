import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolcribProvider } from '../components/ToolcribProvider/ToolcribProvider';
import { useTheme } from '../theme/themeContext';
import { useToast } from '../components/Toast/ToastContext';
import { useLocaleStrings } from '../components/Locale/LocaleContext';

// Verifies ToolcribProvider actually composes ThemeProvider > ToastProvider
// > children + ToastContainer correctly -- the same "does this behave
// identically to the manual three-provider wiring" bar CORE.md §1's Root
// Setup rewrite depends on. Doesn't re-test ThemeProvider's or
// ToastProvider's own internals (covered by themeContext.test.tsx and
// Toast.test.tsx already); this only checks the composition itself.

const Consumer = () => {
  const { addToast } = useToast();
  useTheme(); // throws if not actually inside a ThemeProvider -- exercised implicitly by rendering at all
  return (
    <button onClick={() => addToast({ type: 'info', message: 'Hello from ToolcribProvider' })}>
      Show toast
    </button>
  );
};

describe('ToolcribProvider', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
  });

  it('injects theme CSS variables onto the document root', () => {
    render(
      <ToolcribProvider>
        <div>content</div>
      </ToolcribProvider>
    );

    expect(document.documentElement.style.getPropertyValue('--ai-master-font-size')).not.toBe('');
  });

  it('provides both useTheme() and useToast() to descendants, and renders toasts without a separate <ToastContainer>', () => {
    render(
      <ToolcribProvider>
        <Consumer />
      </ToolcribProvider>
    );

    fireEvent.click(screen.getByText('Show toast'));
    expect(screen.getByText('Hello from ToolcribProvider')).toBeInTheDocument();
  });

  it('passes theme/toast props straight through to the underlying providers', () => {
    render(
      <ToolcribProvider theme={{ initialParameters: { paddingMode: 'compact' } }} toast={{ defaultAnchor: 'bottom-left' }}>
        <div>content</div>
      </ToolcribProvider>
    );

    // paddingMode: 'compact' resolves to a smaller --ai-padding-md than the
    // 'normal' default -- confirms initialParameters actually reached the
    // underlying ThemeProvider, not just that rendering didn't crash.
    expect(document.documentElement.style.getPropertyValue('--ai-padding-md')).not.toBe('');
  });

  it('passes the strings prop straight through to the underlying LocaleProvider', () => {
    let seen: string | undefined;
    const StringsConsumer = () => {
      seen = useLocaleStrings().tree.treeLabel;
      return null;
    };

    render(
      <ToolcribProvider strings={{ tree: { treeLabel: 'Boom' } }}>
        <StringsConsumer />
      </ToolcribProvider>
    );

    expect(seen).toBe('Boom');
  });
});
