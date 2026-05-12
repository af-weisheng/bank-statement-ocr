import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

const MAX_WIDTH_CLASS = {
  sm:  'max-w-sm',
  md:  'max-w-md',
  lg:  'max-w-lg',
  xl:  'max-w-xl',
  '2xl': 'max-w-2xl',
} as const;

type ModalWidth = keyof typeof MAX_WIDTH_CLASS;

export interface ModalProps {
  /** Controls whether the modal is visible. */
  open: boolean;
  /** Called when the user requests the modal to close. */
  onClose: () => void;
  /** Text rendered in the modal header. */
  title?: string;
  /** Body content. */
  children: React.ReactNode;
  /** Footer content (rendered at the bottom, right-aligned by default). */
  footer?: React.ReactNode;
  /** Max width preset for the modal panel. Defaults to `'md'`. */
  maxWidth?: ModalWidth;
  /** Whether clicking the backdrop closes the modal. Defaults to `true`. */
  closeOnOverlay?: boolean;
}

// ─── Focus trap ───────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), ' +
  '[tabindex]:not([tabindex="-1"])';

function useFocusTrap(panelRef: React.RefObject<HTMLDivElement>, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen || !panelRef.current) return;

    const panel    = panelRef.current;
    const nodes    = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first    = nodes[0];
    const last     = nodes[nodes.length - 1];
    const previous = document.activeElement as HTMLElement | null;

    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (nodes.length === 0) { e.preventDefault(); return; }

      if (e.shiftKey) {
        if (document.activeElement === first || !panel.contains(document.activeElement)) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last || !panel.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [isOpen, panelRef]);
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible dialog with:
 * - backdrop blur overlay
 * - Escape key to close
 * - Focus trap (Tab cycles through focusable elements; focus returns to the
 *   trigger element on close)
 * - Rendered via a portal so it always sits on top of the stacking context
 *
 * @example
 * <Modal open={open} onClose={() => setOpen(false)} title="Confirm deletion">
 *   <p>Are you sure?</p>
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth       = 'md',
  closeOnOverlay = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useFocusTrap(panelRef, open);

  if (!open) return null;

  const titleId = 'modal-title';

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
    >
      {/* Blurred overlay */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden="true"
        onClick={closeOnOverlay ? onClose : undefined}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={title ? titleId : undefined}
        className={[
          'relative w-full rounded-2xl bg-white shadow-xl',
          'flex flex-col max-h-[90vh]',
          MAX_WIDTH_CLASS[maxWidth],
        ].join(' ')}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-gray-900"
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
