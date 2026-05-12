import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Definition for a single table column. */
export interface Column<T extends Record<string, unknown>> {
  /** Unique key — passed to `onSort` when the header is clicked. */
  key: string;
  /** Text rendered in the `<th>`. */
  label: string;
  /** When `true` the header becomes a sort button. Defaults to `false`. */
  sortable?: boolean;
  /**
   * Custom cell renderer. Receives the full row object.
   * Falls back to `String(row[key])` when omitted.
   */
  render?: (row: T) => React.ReactNode;
  /** Extra Tailwind classes applied to every `<td>` in this column. */
  tdClass?: string;
  /** Extra Tailwind classes applied to the `<th>`. */
  thClass?: string;
}

export interface TableProps<T extends Record<string, unknown>> {
  /** Column definitions. */
  columns: Column<T>[];
  /** Row data. */
  data: T[];
  /**
   * Returns the React key for a row. Falls back to the row index.
   * Provide this whenever rows have a stable identifier.
   */
  getRowKey?: (row: T, index: number) => React.Key;
  /** Shows a centered spinner instead of rows. */
  loading?: boolean;
  /** Message shown in an empty-state row when `data` is empty. */
  emptyMessage?: string;
  /** Currently active sort column key. */
  sortColumn?: string | null;
  /** Current sort direction. */
  sortDirection?: 'asc' | 'desc';
  /**
   * Called when a sortable column header is clicked.
   * The parent is responsible for toggling the direction.
   */
  onSort?: (column: string) => void;
  /** Extra classes on the wrapping `<div>` (e.g. `max-h-96 overflow-y-auto`). */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic sortable data table. Columns are defined via the `columns` prop;
 * sorting is fully controlled — pass `sortColumn`, `sortDirection`, and
 * `onSort` from the parent, or omit them for a non-sortable table.
 *
 * @example
 * <Table
 *   columns={[
 *     { key: 'name',  label: 'Name',   sortable: true },
 *     { key: 'total', label: 'Total',  sortable: true },
 *     { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
 *   ]}
 *   data={rows}
 *   getRowKey={r => r.id as string}
 *   sortColumn={sort}
 *   sortDirection={dir}
 *   onSort={col => toggleSort(col)}
 * />
 */
export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  getRowKey,
  loading       = false,
  emptyMessage  = 'No data.',
  sortColumn    = null,
  sortDirection = 'asc',
  onSort,
  className     = '',
}: TableProps<T>) {
  const colSpan = columns.length;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm" role="table">

        {/* Header */}
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100 text-left">
            {columns.map(col => {
              const isActive = sortColumn === col.key;
              const ariaSortValue =
                col.sortable && isActive
                  ? sortDirection === 'asc'
                    ? ('ascending'  as const)
                    : ('descending' as const)
                  : col.sortable
                    ? ('none' as const)
                    : undefined;

              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSortValue}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  className={[
                    'px-4 py-3 text-xs font-medium text-secondary-600 whitespace-nowrap select-none',
                    col.sortable && onSort
                      ? 'cursor-pointer hover:text-gray-900 group'
                      : '',
                    col.thClass ?? '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span aria-hidden="true">
                        {isActive ? (
                          sortDirection === 'asc'
                            ? <ChevronUp   className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Body */}
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="px-4 py-12 text-center">
                <Loader2
                  className="w-5 h-5 text-secondary-400 animate-spin mx-auto"
                  aria-label="Loading"
                />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={colSpan}
                className="px-4 py-12 text-center text-sm text-secondary-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={getRowKey ? getRowKey(row, idx) : idx}
                className="hover:bg-gray-50/60 transition-colors"
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={['px-4 py-3 text-gray-700', col.tdClass ?? '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.render
                      ? col.render(row)
                      : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
