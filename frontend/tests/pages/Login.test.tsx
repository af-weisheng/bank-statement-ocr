import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderWithProviders } from '../helpers/renderWithProviders';
import Login from '../../src/pages/Login';

describe('Login page', () => {
  beforeEach(() => localStorage.clear());

  it('renders the email form', () => {
    renderWithProviders(<Login />);
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
  });

  it('submit button is disabled when the email field is empty', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: /send login link/i })).toBeDisabled();
  });

  it('shows a validation error for a malformed email', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/work email/i), 'notanemail');
    await user.click(screen.getByRole('button', { name: /send login link/i }));
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
  });

  it('shows the success state after a valid submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/work email/i), 'user@acme.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));
    expect(await screen.findByText(/check your email/i)).toBeInTheDocument();
    // Typed email is echoed in the success copy
    expect(screen.getByText('user@acme.com')).toBeInTheDocument();
  });

  it('shows an error state when the API returns an error', async () => {
    server.use(
      http.post('http://localhost:5000/api/auth/request-login', () =>
        HttpResponse.json({ success: false, error: 'Domain not registered.' }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/work email/i), 'user@unknown.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));
    // Success state should NOT appear
    await waitFor(() => {
      expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument();
    });
    // The form is still visible and the button is re-enabled
    expect(screen.getByRole('button', { name: /send login link/i })).not.toBeDisabled();
  });

  it('resets back to the form when "Use a different email" is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);
    await user.type(screen.getByLabelText(/work email/i), 'user@acme.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));
    await screen.findByText(/check your email/i);

    await user.click(screen.getByRole('button', { name: /use a different email/i }));
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
  });
});
