import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ErrorState, Pagination, Skeleton, cx } from './ui.jsx';

const HIDE = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };
const hideClass = (c) => HIDE[c.hideBelow] ?? (c.hideOnMobile ? HIDE.md : null);

/**
 * Tabla con ordenación (servidor o local), estados de carga/vacío/error y paginación.
 * columns: [{ key, header, render(row), sortKey, align, className, hideOnMobile }]
 */
export function DataTable({ columns, rows, loading, error, onRetry, onRowClick, sort, onSort, empty, pagination, rowKey = (r, i) => r.id ?? r.name ?? i, dense = false, rowClassName }) {
  const hasRows = rows && rows.length > 0;
  const toggleSort = (key) => {
    if (!onSort) return;
    onSort(sort?.sort === key ? { sort: key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: 'asc' });
  };

  if (error && !hasRows) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <div className={cx('transition-opacity duration-200', loading && hasRows && 'opacity-60')}>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cx(c.align === 'right' && 'text-right', hideClass(c), c.className)} aria-sort={c.sortKey && sort?.sort === c.sortKey ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortKey && onSort ? (
                    <button className={cx('inline-flex items-center gap-1 uppercase tracking-[0.04em] hover:text-ink', c.align === 'right' && 'flex-row-reverse')} onClick={() => toggleSort(c.sortKey)}>
                      {c.header}
                      {sort?.sort === c.sortKey ? sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !hasRows
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {columns.map((c, j) => (
                      <td key={c.key} className={cx(hideClass(c))}>
                        <Skeleton className={cx('h-3.5', j === 0 ? 'w-40' : 'w-20', c.align === 'right' && 'ml-auto')} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows?.map((row, index) => (
                  <tr
                    key={rowKey(row, index)}
                    className={cx(onRowClick && 'clickable', rowClassName?.(row))}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                  >
                    {columns.map((c) => (
                      <td key={c.key} className={cx(dense && 'py-2', c.align === 'right' && 'text-right', hideClass(c), c.cellClassName)}>
                        {c.render ? c.render(row) : row[c.key] ?? <span className="text-ink-faint">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && !hasRows && empty}
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}

/** Ordenación local para listas pequeñas que no paginan en servidor. */
export function sortRows(rows, sort, accessors = {}) {
  if (!rows || !sort?.sort) return rows ?? [];
  const get = accessors[sort.sort] ?? ((r) => r[sort.sort]);
  const dir = sort.dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb, 'es') : va - vb) * dir;
  });
}
