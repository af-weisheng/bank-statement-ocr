import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../../src/components/Modal';

const noop = () => {};

describe('Modal', () => {
  it('does not render when open is false', () => {
    render(<Modal open={false} onClose={noop}>Content</Modal>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog and children when open is true', () => {
    render(<Modal open={true} onClose={noop}>Hello</Modal>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders the title and links it via aria-labelledby', () => {
    render(
      <Modal open={true} onClose={noop} title="Confirm action">
        Body
      </Modal>,
    );
    expect(screen.getByText('Confirm action')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('renders footer content', () => {
    render(
      <Modal open={true} onClose={noop} footer={<button>OK</button>}>
        Body
      </Modal>,
    );
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('calls onClose when the Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Dialog">
        Body
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Dialog">
        Body
      </Modal>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the overlay is clicked and closeOnOverlay is true', async () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} closeOnOverlay>
        Body
      </Modal>,
    );
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose on overlay click when closeOnOverlay is false', async () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} closeOnOverlay={false}>
        Body
      </Modal>,
    );
    const overlay = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    await userEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sets body overflow to hidden while the modal is open', () => {
    render(<Modal open={true} onClose={noop}>Body</Modal>);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('restores body overflow when the modal is closed', () => {
    const { rerender } = render(<Modal open={true} onClose={noop}>Body</Modal>);
    rerender(<Modal open={false} onClose={noop}>Body</Modal>);
    expect(document.body.style.overflow).toBe('');
  });
});
