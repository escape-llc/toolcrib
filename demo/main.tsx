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
    <ToolcribProvider theme={{ initialParameters: { marginMode: { base: 'compact', lg: 'normal' } } }}>
      <App />
    </ToolcribProvider>
  </React.StrictMode>
);
