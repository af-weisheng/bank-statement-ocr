import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { AdminAuthProvider } from '../../src/contexts/AdminAuthContext';

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  routerProps?: MemoryRouterProps;
  withAdminAuth?: boolean;
}

function Providers({
  children,
  routerProps = {},
  withAdminAuth = false,
}: {
  children: React.ReactNode;
  routerProps?: MemoryRouterProps;
  withAdminAuth?: boolean;
}) {
  return (
    <MemoryRouter {...routerProps}>
      <ToastProvider>
        <AuthProvider>
          {withAdminAuth ? (
            <AdminAuthProvider>{children}</AdminAuthProvider>
          ) : (
            children
          )}
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

/**
 * Custom render that wraps the component under test with the full provider
 * stack (MemoryRouter, ToastProvider, AuthProvider, optionally AdminAuthProvider).
 *
 * @param ui           Component to render.
 * @param routerProps  Forwarded to MemoryRouter (e.g. `{ initialEntries: ['/verify?token=x'] }`).
 * @param withAdminAuth  Include AdminAuthProvider in the tree.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  { routerProps, withAdminAuth, ...renderOptions }: ProviderOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers routerProps={routerProps} withAdminAuth={withAdminAuth}>
        {children}
      </Providers>
    ),
    ...renderOptions,
  });
}
