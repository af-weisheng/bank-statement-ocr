import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Table, Column } from '../../src/components/Table';

type Row = Record<string, unknown> & { id: string; name: string; total: number };

const columns: Column<Row>[] = [
  { key: 'name',  label: 'Name',  sortable: true },
  { key: 'total', label: 'Total', sortable: true },
  {
    key: 'badge',
    label: 'Badge',
    render: (row) => <span data-testid="badge">{String(row.name)}</span>,
  },
];

const data: Row[] = [
  { id: '1', name: 'Alice', total: 10 },
  { id: '2', name: 'Bob',   total: 20 },
];

describe('Table', () => {
  it('renders all column headers', () => {
    render(<Table columns={columns} data={[]} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('renders row data using default string serialisation', () => {
    render(<Table columns={columns} data={data} getRowKey={r => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders cells via a custom render function', () => {
    render(<Table columns={columns} data={data} />);
    const badges = screen.getAllByTestId('badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('Alice');
  });

  it('shows the empty message when data is empty', () => {
    render(<Table columns={columns} data={[]} emptyMessage="Nothing found." />);
    expect(screen.getByText('Nothing found.')).toBeInTheDocument();
  });

  it('shows a loading spinner when loading is true', () => {
    render(<Table columns={columns} data={[]} loading />);
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('calls onSort with the column key when a sortable header is clicked', async () => {
    const onSort = vi.fn();
    render(
      <Table
        columns={columns}
        data={data}
        onSort={onSort}
        sortColumn={null}
        sortDirection="asc"
      />,
    );
    await userEvent.click(screen.getByText('Name'));
    expect(onSort).toHaveBeenCalledWith('name');
  });

  it('sets aria-sort="ascending" on the active sorted column', () => {
    render(
      <Table
        columns={columns}
        data={data}
        sortColumn="name"
        sortDirection="asc"
        onSort={vi.fn()}
      />,
    );
    const th = screen.getByText('Name').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  it('sets aria-sort="descending" on the active sorted column', () => {
    render(
      <Table
        columns={columns}
        data={data}
        sortColumn="total"
        sortDirection="desc"
        onSort={vi.fn()}
      />,
    );
    const th = screen.getByText('Total').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  it('sets aria-sort="none" on inactive sortable columns', () => {
    render(
      <Table
        columns={columns}
        data={data}
        sortColumn="name"
        sortDirection="asc"
        onSort={vi.fn()}
      />,
    );
    const th = screen.getByText('Total').closest('th');
    expect(th).toHaveAttribute('aria-sort', 'none');
  });
});
