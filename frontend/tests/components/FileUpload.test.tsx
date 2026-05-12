import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileUpload } from '../../src/components/FileUpload';

function getFileInput() {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('FileUpload', () => {
  it('shows the empty / idle state by default', () => {
    render(<FileUpload onFileSelect={vi.fn()} />);
    expect(screen.getByLabelText(/file upload drop zone/i)).toBeInTheDocument();
    expect(screen.getByText(/drag file here/i)).toBeInTheDocument();
  });

  it('shows the selected file name and size when value is provided', () => {
    const file = new File(['content'], 'statement.pdf', { type: 'application/pdf' });
    render(<FileUpload onFileSelect={vi.fn()} value={file} />);
    expect(screen.getByText('statement.pdf')).toBeInTheDocument();
  });

  it('calls onFileSelect with the valid file', async () => {
    const onFileSelect = vi.fn();
    render(
      <FileUpload accept={['application/pdf']} onFileSelect={onFileSelect} />,
    );
    const file = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    await userEvent.upload(getFileInput(), file);
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('rejects a file with the wrong MIME type and shows an error', async () => {
    const onFileSelect = vi.fn();
    const onError = vi.fn();
    render(
      <FileUpload
        accept={['application/pdf']}
        onFileSelect={onFileSelect}
        onError={onError}
      />,
    );
    const file = new File(['hello'], 'doc.txt', { type: 'text/plain' });
    await userEvent.upload(getFileInput(), file);
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/only pdf/i);
  });

  it('rejects a file that exceeds the size limit and shows an error', async () => {
    const onFileSelect = vi.fn();
    // maxSizeMB of 0.000001 MB ≈ 1 byte — any real file will exceed it
    render(
      <FileUpload
        accept={['application/pdf']}
        maxSizeMB={0.000001}
        onFileSelect={onFileSelect}
      />,
    );
    const file = new File(['PDF content'], 'big.pdf', { type: 'application/pdf' });
    await userEvent.upload(getFileInput(), file);
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/size limit/i);
  });

  it('is non-interactive when disabled', () => {
    render(<FileUpload onFileSelect={vi.fn()} disabled />);
    const zone = screen.getByLabelText(/file upload drop zone/i);
    expect(zone).toHaveAttribute('aria-disabled', 'true');
    expect(zone).toHaveAttribute('tabindex', '-1');
  });

  it('shows accepted types and size limit in the empty state', () => {
    render(
      <FileUpload
        accept={['application/pdf']}
        maxSizeMB={5}
        onFileSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/5 mb/i)).toBeInTheDocument();
  });
});
