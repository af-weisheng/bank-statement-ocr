import { useRef, useState } from 'react';
import { AlertCircle, FileText, Upload } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileUploadProps {
  /** Accepted MIME types. Defaults to PDF + common images. */
  accept?: string[];
  /** Maximum file size in megabytes. Defaults to 10. */
  maxSizeMB?: number;
  /** Called with the validated File when the user selects one. */
  onFileSelect: (file: File) => void;
  /** Called with a human-readable message when validation fails. */
  onError?: (message: string) => void;
  /** Currently selected file (controlled). Pass `null` to clear. */
  value?: File | null;
  /** Prevents interaction when true. */
  disabled?: boolean;
  /** Extra classes applied to the outer wrapper. */
  className?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  return bytes < 1_048_576
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const DEFAULT_ACCEPT = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Drag-and-drop file upload zone with client-side MIME type and size
 * validation. The component is controlled — pass `value` to show the
 * currently selected file and `null` to clear it.
 *
 * @example
 * <FileUpload
 *   accept={['application/pdf']}
 *   maxSizeMB={10}
 *   value={file}
 *   onFileSelect={setFile}
 *   onError={msg => showToast('error', msg)}
 * />
 */
export function FileUpload({
  accept     = DEFAULT_ACCEPT,
  maxSizeMB  = 10,
  onFileSelect,
  onError,
  value,
  disabled   = false,
  className  = '',
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState('');
  const inputRef    = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate(file: File): string | null {
    if (!accept.includes(file.type)) {
      const exts = accept
        .map(m => m.split('/')[1].toUpperCase())
        .join(', ');
      return `Only ${exts} files are accepted.`;
    }
    if (file.size > maxSizeMB * 1_048_576) {
      return `File exceeds the ${maxSizeMB} MB size limit.`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) {
      setLocalError(err);
      onError?.(err);
      return;
    }
    setLocalError('');
    onFileSelect(file);
  }

  // ── Drag events ─────────────────────────────────────────────────────────────
  // dragCounter prevents flickering when the cursor moves over child elements.

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (disabled) return;
    dragCounter.current++;
    setIsDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    if (--dragCounter.current === 0) setIsDragOver(false);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Zone appearance ─────────────────────────────────────────────────────────

  const zoneBase =
    'relative rounded-xl border-2 border-dashed flex flex-col items-center ' +
    'justify-center gap-3 py-10 px-6 text-center transition-colors select-none';

  let zoneColor = 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/40';
  if (disabled)  zoneColor = 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60';
  else if (isDragOver) zoneColor = 'border-primary-500 bg-primary-50';
  else if (value)      zoneColor = 'border-success-400 bg-success-50';

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="File upload drop zone"
        aria-disabled={disabled}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={e => !disabled && e.key === 'Enter' && inputRef.current?.click()}
        className={`${zoneBase} ${zoneColor} ${!disabled ? 'cursor-pointer' : ''}`}
      >
        {/* Hidden native input */}
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            // Reset so the same file can be re-selected
            e.target.value = '';
          }}
        />

        {value ? (
          /* ── File selected ─────────────────────────────────────────── */
          <>
            <div className="w-11 h-11 rounded-xl bg-success-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-success-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 break-all">{value.name}</p>
              <p className="text-xs text-secondary-500 mt-0.5">{formatBytes(value.size)}</p>
            </div>
            {!disabled && (
              <p className="text-xs text-secondary-400">Click or drop to replace</p>
            )}
          </>
        ) : (
          /* ── Empty state ───────────────────────────────────────────── */
          <>
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                isDragOver ? 'bg-primary-100' : 'bg-gray-100'
              }`}
            >
              <Upload
                className={`w-5 h-5 transition-colors ${
                  isDragOver ? 'text-primary-600' : 'text-gray-400'
                }`}
                aria-hidden="true"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                {isDragOver ? 'Drop to upload' : 'Drag file here'}
              </p>
              {!isDragOver && (
                <p className="text-xs text-secondary-500 mt-0.5">or click to browse</p>
              )}
            </div>
            <p className="text-xs text-secondary-400">
              {accept
                .map(m => m.split('/')[1].toUpperCase())
                .join(', ')}{' '}
              — max {maxSizeMB} MB
            </p>
          </>
        )}
      </div>

      {/* Validation error */}
      {localError && (
        <p
          role="alert"
          className="mt-2 flex items-center gap-1.5 text-xs text-error-600"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {localError}
        </p>
      )}
    </div>
  );
}
