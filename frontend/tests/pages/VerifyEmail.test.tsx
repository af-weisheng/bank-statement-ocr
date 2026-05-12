import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../helpers/renderWithProviders';
import VerifyEmail from '../../src/pages/VerifyEmail';

describe('VerifyEmail page', () => {
  beforeEach(() => localStorage.clear());

  it('shows the loading/verifying state immediately', () => {
    // Delay the MSW response so the loading state is visible
    server.use(
      http.post('http://localhost:5000/api/auth/verify', async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return HttpResponse.json({
          success: true,
          data: { token: 'tok', user: { email: 'user@acme.com', domain: 'acme.com' } },
        });
      }),
    );
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify?token=abc123'] },
    });
    expect(screen.getByText(/verifying your email/i)).toBeInTheDocument();
  });

  it('shows an error when no token is present in the URL', async () => {
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify'] },
    });
    expect(await screen.findByText(/no verification token/i)).toBeInTheDocument();
  });

  it('shows the success state after a valid token is verified', async () => {
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify?token=valid-token'] },
    });
    expect(await screen.findByText(/login successful/i)).toBeInTheDocument();
  });

  it('stores the session token in localStorage on success', async () => {
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify?token=valid-token'] },
    });
    await screen.findByText(/login successful/i);
    expect(localStorage.getItem('auth_token')).toBe('mock-session-token');
  });

  it('shows the error state when the API rejects the token', async () => {
    server.use(
      http.post('http://localhost:5000/api/auth/verify', () =>
        HttpResponse.json({ success: false, error: 'Token expired.' }, { status: 400 }),
      ),
    );
    renderWithProviders(<VerifyEmail />, {
      routerProps: { initialEntries: ['/verify?token=bad-token'] },
    });
    expect(await screen.findByText(/verification failed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });
});
