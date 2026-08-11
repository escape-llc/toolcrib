import React from 'react';
import { createPortal } from 'react-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StyleDomainProvider, useStyleDomain } from '../theme/StyleDomainContext';

const DomainReader: React.FC = () => {
  const domain = useStyleDomain();
  return <span>subtheme:{domain?.subtheme ?? 'none'}</span>;
};

describe('StyleDomainContext', () => {
  it('returns null outside any provider', () => {
    render(<DomainReader />);
    expect(screen.getByText('subtheme:none')).toBeInTheDocument();
  });

  it('provides the nearest ancestor subtheme to a descendant', () => {
    render(
      <StyleDomainProvider subtheme="error">
        <DomainReader />
      </StyleDomainProvider>
    );
    expect(screen.getByText('subtheme:error')).toBeInTheDocument();
  });

  it('the nearest provider wins when nested', () => {
    render(
      <StyleDomainProvider subtheme="error">
        <StyleDomainProvider subtheme="success">
          <DomainReader />
        </StyleDomainProvider>
      </StyleDomainProvider>
    );
    expect(screen.getByText('subtheme:success')).toBeInTheDocument();
  });

  it('reaches content rendered through a portal, unlike CSS custom property inheritance', () => {
    const portalTarget = document.createElement('div');
    document.body.appendChild(portalTarget);

    const Portaled: React.FC = () => createPortal(<DomainReader />, portalTarget);

    render(
      <StyleDomainProvider subtheme="warning">
        <Portaled />
      </StyleDomainProvider>
    );

    expect(screen.getByText('subtheme:warning')).toBeInTheDocument();
    document.body.removeChild(portalTarget);
  });
});
