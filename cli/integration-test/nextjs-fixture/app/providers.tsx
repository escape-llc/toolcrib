'use client';

import type { ReactNode } from 'react';
import { ToolcribProvider, computeServerThemeCSS } from '#toolcrib';

type InitialParameters = Parameters<typeof computeServerThemeCSS>[0];

// The client half of ai-docs/examples/ssr-theme-injection.md's documented
// pattern -- app/layout.tsx computes the same theme as plain CSS text via
// computeServerThemeCSS() for the initial server-rendered HTML, and this
// wraps the real <ToolcribProvider> around the tree so hydration picks up
// live theme state using the exact same initialParameters.
export function Providers({
  children,
  initialParameters,
}: {
  children: ReactNode;
  initialParameters: InitialParameters;
}) {
  return <ToolcribProvider theme={{ initialParameters }}>{children}</ToolcribProvider>;
}
