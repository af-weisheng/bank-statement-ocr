import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  AlertCircle, CheckCircle, ChevronLeft, ChevronRight,
  Download, FileText, FilePlus, Loader2, LogOut,
  RefreshCw, Upload, XCircle,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
]);
const MAX_SIZE_MB    = 10;
const HISTORY_LIMIT  = 20;

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadResult {
  csv:               string;
  bankType?:         string;
  transactionCount?: number;
}

interface HistoryItem {
  file_name:     string;
  status:        string;
  processed_at:  string;
  error_message: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-SG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerCSVDownload(csv: string, originalName: string): void {
  const stem     = originalName.replace(/\.[^.]+$/, '');
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const anchor   = document.createElement('a');
  anchor.href     = url;
  anchor.download = `${stem}-transactions.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const ok = status === 'completed';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
        ok
          ? 'bg-success-50 text-success-700 border-success-200'
          : 'bg-error-50   text-error-700   border-error-200'
      }`}
    >
      {ok
        ? <CheckCircle className="w-3 h-3" />
        : <XCircle     className="w-3 h-3" />}
      {ok ? 'Completed' : 'Failed'}
    </span>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  // ── Upload ────────────────────────────────────────────────────────────────
  const [file,         setFile]         = useState<File | null>(null);
  const [fileError,    setFileError]    = useState('');
  const [isDragOver,   setIsDragOver]   = useState(false);
  const [uploadState,  setUploadState]  = useState<UploadState>('idle');
  const [result,       setResult]       = useState<UploadResult | null>(null);
  const [uploadError,  setUploadError]  = useState('');

  // ── History ───────────────────────────────────────────────────────────────
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [historyTotal,   setHistoryTotal]   = useState(0);
  const [historyOffset,  setHistoryOffset]  = useState(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedRow,    setExpandedRow]    = useState<string | null>(null);

  const fileInputRef     = useRef<HTMLInputElement>(null);
  const dragCounter      = useRef(0);
  const lastUploadedName = useRef('');

  // ── Fetch history ─────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async (offset: number) => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get<{
        success: boolean;
        data: { items: HistoryItem[]; total: number };
      }>(`/process/history?limit=${HISTORY_LIMIT}&offset=${offset}`);

      if (data.success) {
        setHistory(data.data.items);
        setHistoryTotal(data.data.total);
        setHistoryOffset(offset);
      }
    } catch {
      // keep previous rows visible on transient error
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHistory(0); }, [fetchHistory]);

  // ── File validation ───────────────────────────────────────────────────────

  function handleFileSelect(f: File) {
    if (!ALLOWED_TYPES.has(f.type)) {
      setFileError('Only PDF, PNG, and JPEG files are accepted.');
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds the ${MAX_SIZE_MB} MB size limit.`);
      return;
    }
    setFileError('');
    setFile(f);
    setUploadState('idle');
    setResult(null);
    setUploadError('');
  }

  // ── Drag events ───────────────────────────────────────────────────────────

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    setIsDragOver(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    if (--dragCounter.current === 0) setIsDragOver(false);
  }
  function onDragOver(e: React.DragEvent)  { e.preventDefault(); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return;

    lastUploadedName.current = file.name;
    setUploadState('uploading');
    setUploadError('');

    const form = new FormData();
    form.append('statement', file);

    try {
      const { data } = await api.post<{
        success: boolean;
        data:    UploadResult;
        error?:  string;
      }>('/process/upload', form);

      if (!data.success) throw new Error(data.error ?? 'Processing failed.');

      setResult(data.data);
      setUploadState('success');
      triggerCSVDownload(data.data.csv, file.name);
      void fetchHistory(0);
    } catch (err: unknown) {
      let msg = 'Upload failed. Please try again.';
      if (axios.isAxiosError(err)) {
        msg = (err.response?.data as { error?: string })?.error ?? msg;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setUploadError(msg);
      setUploadState('error');
      void fetchHistory(0);
    }
  }

  function resetUpload() {
    setFile(null);
    setFileError('');
    setUploadState('idle');
    setResult(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  // ── Pagination helpers ────────────────────────────────────────────────────

  const totalPages  = Math.ceil(historyTotal / HISTORY_LIMIT);
  const currentPage = Math.floor(historyOffset / HISTORY_LIMIT) + 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gray-900">Bank Statement OCR</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-secondary-600 truncate max-w-[220px]">
              {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm
                         text-secondary-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Upload card ──────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            Upload Bank Statement
          </h2>

          {/* Success state */}
          {uploadState === 'success' && result ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-success-100 mb-4">
                <CheckCircle className="w-7 h-7 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Statement processed successfully!
              </h3>

              {(result.bankType || result.transactionCount !== undefined) && (
                <div className="mt-2 flex items-center justify-center gap-4 text-sm text-secondary-600 flex-wrap">
                  {result.bankType && (
                    <span>Bank: <strong className="text-gray-800">{result.bankType}</strong></span>
                  )}
                  {result.transactionCount !== undefined && (
                    <span>Transactions: <strong className="text-gray-800">{result.transactionCount}</strong></span>
                  )}
                </div>
              )}

              <p className="mt-3 text-sm text-secondary-500">
                Your CSV has been downloaded automatically.
              </p>

              <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => triggerCSVDownload(result.csv, lastUploadedName.current)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             border border-gray-300 text-sm font-medium text-gray-700
                             hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
                <button
                  onClick={resetUpload}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                             bg-primary-600 text-white text-sm font-medium
                             hover:bg-primary-700 transition-colors"
                >
                  <FilePlus className="w-4 h-4" />
                  Process Another
                </button>
              </div>
            </div>
          ) : (
            /* Upload / idle / error states */
            <>
              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                className={`
                  cursor-pointer rounded-xl border-2 border-dashed select-none
                  flex flex-col items-center justify-center gap-3 py-12 px-6
                  text-center transition-colors
                  ${isDragOver
                    ? 'border-primary-500 bg-primary-50'
                    : file
                      ? 'border-success-400 bg-success-50'
                      : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50/40'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                {file ? (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-success-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-success-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm break-all">{file.name}</p>
                      <p className="text-xs text-secondary-500 mt-0.5">{formatBytes(file.size)}</p>
                    </div>
                    <p className="text-xs text-secondary-400">Click or drop to replace</p>
                  </>
                ) : (
                  <>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      isDragOver ? 'bg-primary-100' : 'bg-gray-100'
                    }`}>
                      <Upload className={`w-6 h-6 transition-colors ${
                        isDragOver ? 'text-primary-600' : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 text-sm">
                        {isDragOver ? 'Drop to upload' : 'Drag PDF or image here'}
                      </p>
                      {!isDragOver && (
                        <p className="text-xs text-secondary-500 mt-0.5">or click to browse</p>
                      )}
                    </div>
                    <p className="text-xs text-secondary-400">
                      PDF, PNG, JPG — max {MAX_SIZE_MB} MB
                    </p>
                  </>
                )}
              </div>

              {/* File validation error */}
              {fileError && (
                <div className="mt-3 flex items-center gap-2.5 p-3 rounded-lg bg-error-50 border border-error-200">
                  <AlertCircle className="w-4 h-4 text-error-600 shrink-0" />
                  <p className="text-sm text-error-700">{fileError}</p>
                </div>
              )}

              {/* Upload API error */}
              {uploadState === 'error' && uploadError && (
                <div className="mt-3 flex items-start gap-2.5 p-3 rounded-lg bg-error-50 border border-error-200">
                  <XCircle className="w-4 h-4 text-error-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-error-700">{uploadError}</p>
                </div>
              )}

              {/* Action button */}
              <button
                onClick={handleUpload}
                disabled={!file || !!fileError || uploadState === 'uploading'}
                className="
                  mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5
                  rounded-lg bg-primary-600 text-white text-sm font-medium
                  transition-colors hover:bg-primary-700
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                {uploadState === 'uploading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing your statement…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Process Statement
                  </>
                )}
              </button>
            </>
          )}
        </section>

        {/* ── History card ─────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

          {/* Card header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Uploads</h2>
            <button
              onClick={() => void fetchHistory(historyOffset)}
              disabled={historyLoading}
              title="Refresh"
              className="p-2 rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-gray-700
                         transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-6 py-3 font-medium text-secondary-600 whitespace-nowrap">Date</th>
                  <th className="px-6 py-3 font-medium text-secondary-600">Filename</th>
                  <th className="px-6 py-3 font-medium text-secondary-600">Status</th>
                  <th className="px-6 py-3 font-medium text-secondary-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyLoading && history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-14 text-center">
                      <Loader2 className="w-6 h-6 text-secondary-400 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-secondary-400">
                        <Upload className="w-8 h-8" />
                        <p className="font-medium text-sm">No uploads yet</p>
                        <p className="text-xs">Upload a bank statement above to get started.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  history.map((item, idx) => {
                    const rowKey    = `${item.processed_at}-${idx}`;
                    const isExpanded = expandedRow === rowKey;
                    const hasFailed  = item.status !== 'completed' && !!item.error_message;

                    return (
                      <Fragment key={rowKey}>
                        <tr
                          onClick={() => hasFailed && setExpandedRow(isExpanded ? null : rowKey)}
                          className={`transition-colors hover:bg-gray-50/60 ${
                            hasFailed ? 'cursor-pointer' : ''
                          }`}
                        >
                          <td className="px-6 py-3.5 text-secondary-600 whitespace-nowrap">
                            {formatDate(item.processed_at)}
                          </td>
                          <td className="px-6 py-3.5 text-gray-900 max-w-[180px] truncate">
                            {item.file_name}
                          </td>
                          <td className="px-6 py-3.5">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="px-6 py-3.5">
                            {hasFailed && (
                              <span className="text-xs text-error-600 underline decoration-dotted cursor-pointer">
                                {isExpanded ? 'Hide error' : 'Show error'}
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Expanded error row */}
                        {isExpanded && item.error_message && (
                          <tr>
                            <td colSpan={4} className="px-6 py-3 bg-error-50 border-b border-error-100">
                              <div className="flex items-start gap-2 text-sm text-error-700">
                                <AlertCircle className="w-4 h-4 text-error-500 shrink-0 mt-0.5" />
                                <span>{item.error_message}</span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {historyTotal > HISTORY_LIMIT && (
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between text-sm text-secondary-600">
              <span>
                {historyOffset + 1}–{Math.min(historyOffset + HISTORY_LIMIT, historyTotal)}{' '}
                of {historyTotal}
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={historyOffset === 0}
                  onClick={() => void fetchHistory(historyOffset - HISTORY_LIMIT)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 tabular-nums select-none">
                  {currentPage} / {totalPages}
                </span>
                <button
                  disabled={historyOffset + HISTORY_LIMIT >= historyTotal}
                  onClick={() => void fetchHistory(historyOffset + HISTORY_LIMIT)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors
                             disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
