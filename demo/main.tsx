import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToolcribProvider } from '#toolcrib';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* marginMode is responsive here on purpose -- dogfoods the theme
        engine's responsive-breakpoint framework (see src/theme/responsive.ts)
        in the toolkit's own real showcase, not just in isolated tests.
        Tighter gaps below `lg` (1024px), the existing default above it. */}
    {/* nonce is a fixed demo value, not a real per-request CSP nonce (that
        needs server cooperation this static demo doesn't have) -- dogfoods
        the wiring itself (every <style> tag toolcrib injects should carry
        this value) so e2e/nonce.spec.ts can verify it against a real DOM,
        not just that the code compiles. See CORE.md's CSP note. */}
    <ToolcribProvider theme={{ initialParameters: { marginMode: { base: 'compact', lg: 'normal' } }, nonce: 'demo-csp-nonce' }}>
      <App />
    </ToolcribProvider>
  </React.StrictMode>
);
