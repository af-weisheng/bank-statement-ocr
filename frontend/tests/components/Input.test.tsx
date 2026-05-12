import { render, screen } from '@testing-library/react';
import { Input } from '../../src/components/Input';

describe('Input', () => {
  it('renders an input with a label linked via htmlFor', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows the error message and sets aria-invalid', () => {
    render(<Input label="Email" error="Invalid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('links aria-describedby to the error element id', () => {
    render(<Input label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(document.getElementById(describedBy!)).toHaveTextContent('Required');
  });

  it('shows hint text when there is no error', () => {
    render(<Input label="Email" hint="Use your work email" />);
    expect(screen.getByText('Use your work email')).toBeInTheDocument();
  });

  it('hides hint text when an error is present', () => {
    render(<Input label="Email" hint="Use your work email" error="Invalid" />);
    expect(screen.queryByText('Use your work email')).not.toBeInTheDocument();
  });

  it('marks the input as required when required is true', () => {
    render(<Input label="Email" required />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('required');
  });

  it('renders a trailing element inside the input wrapper', () => {
    render(<Input label="Search" trailing={<span data-testid="icon">@</span>} />);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not set aria-invalid when there is no error', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });
});
