import {
  computeServerThemeCSS,
  TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID,
  TOOLCRIB_RESPONSIVE_STYLE_ID,
  TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID,
  TOOLCRIB_THEME_TRANSITIONS_STYLE_ID,
} from '#toolcrib';
import { Providers } from './providers';
// app/demo.css is not committed -- copied in from the repo's own demo/
// by run-nextjs-fixture.mjs before this gets built. See this directory's
// README for why.
import './demo.css';

const initialParameters = {
  marginMode: { base: 'compact' as const, lg: 'normal' as const },
};

// A default (Server Component) root layout -- this is deliberately NOT
// marked 'use client', the same shape as the real reproduction that found
// the original 'use client' gap (see AGENTS.md). computeServerThemeCSS()
// renders the theme as plain CSS text here so first paint is already
// themed; Providers (a client component) wraps <ToolcribProvider> around
// the tree for hydration. See ai-docs/examples/ssr-theme-injection.md.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = computeServerThemeCSS(initialParameters);
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: theme.rootVariablesCSS }} />
        <style
          id={TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID}
          dangerouslySetInnerHTML={{ __html: theme.typographyCSS }}
        />
        <style
          id={TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID}
          dangerouslySetInnerHTML={{ __html: theme.keyframesCSS }}
        />
        <style
          id={TOOLCRIB_THEME_TRANSITIONS_STYLE_ID}
          dangerouslySetInnerHTML={{ __html: theme.transitionsCSS }}
        />
        {theme.responsiveCSS && (
          <style
            id={TOOLCRIB_RESPONSIVE_STYLE_ID}
            dangerouslySetInnerHTML={{ __html: theme.responsiveCSS }}
          />
        )}
      </head>
      <body>
        <Providers initialParameters={initialParameters}>{children}</Providers>
      </body>
    </html>
  );
}
