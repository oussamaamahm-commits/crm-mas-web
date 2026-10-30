import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useQuickActions } from '../../layout/QuickActions.jsx';
import { useApi, useDebounced, usePersistentState } from '../../lib/hooks.js';
import { date, isDemoLabel, money } from '../../lib/format.js';
import { CLIENT_STATUS } from '../../lib/labels.js';
import { DataTable } from '../../components/DataTable.jsx';
import { Avatar, Badge, Button, Chips, DemoTag, EmptyState, Glass, LabelBadge, PageHeader, SearchInput } from '../../components/ui.jsx';

const FILTERS = [
  { value: '', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'debt', label: 'Con deuda' },
  { value: 'open_projects', label: 'Con proyectos abiertos' },
  { value: 'archived', label: 'Archivados' },
];

export default function ClientsPage() {
  const { can } = useAuth();
  const quick = useQuickActions();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filter, setFilter] = usePersistentState('clients-filter', params.get('filtro') ?? '');
  const [q, setQ] = useState('');
  const [sort, setSort] = usePersistentState('clients-sort', { sort: 'created_at', dir: 'desc' });
  const [page, setPage] = useState(1);
  const search = useDebounced(q, 200);
  const { data, loading, error, reload } = useApi('/clients', { filter, q: search, ...sort, page, pageSize: 20 });

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={data ? `${data.total} ${data.total === 1 ? 'cliente' : 'clientes'} ${filter ? 'en este filtro' : 'en cartera'}` : 'Cartera de clientes y expedientes'}
        actions={
          can('clients.write') && (
            <Button icon={UserPlus} onClick={() => quick.open('client')}>
              Nuevo cliente
            </Button>
          )
        }
      />
      <Glass className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/60 px-5 py-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Buscar por nombre, empresa, email, teléfono o NIF…" className="lg:w-[340px]" />
          <div className="overflow-x-auto">
            <Chips options={FILTERS} value={filter} onChange={(v) => (setFilter(v), setPage(1))} />
          </div>
        </div>
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={sort}
          onSort={(s) => (setSort(s), setPage(1))}
          onRowClick={(r) => navigate(`/clientes/${r.id}`)}
          pagination={data && { page, pageSize: data.pageSize, total: data.total, onPage: setPage }}
          empty={
            q || filter ? (
              <EmptyState compact icon={Users} title="Ningún cliente coincide" description="Prueba con otro término o quita el filtro." />
            ) : (
              <EmptyState
                icon={Users}
                title="Aún no hay clientes"
                description="Crea el primer expediente: contacto, datos fiscales, proyectos, servicios e infraestructura quedarán conectados."
                action={can('clients.write') && <Button icon={UserPlus} onClick={() => quick.open('client')}>Nuevo cliente</Button>}
              />
            )
          }
          columns={[
            {
              key: 'name',
              header: 'Nombre',
              sortKey: 'name',
              render: (r) => (
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.company || r.name} size={34} />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {r.company || r.name}
                      {isDemoLabel(r.name) && <DemoTag />}
                    </p>
                    <p className="truncate text-[12px] text-ink-soft">{r.company ? r.name : r.city ?? ''}</p>
                  </div>
                </div>
              ),
            },
            { key: 'contact', header: 'Contacto', hideBelow: 'xl', render: (r) => <div className="min-w-0 text-[12.5px]"><p className="truncate">{r.email ?? '—'}</p><p className="truncate text-ink-soft">{r.phone ?? ''}</p></div> },
            { key: 'services', header: 'Servicios', hideBelow: 'xl', render: (r) => (r.services_names ? <span className="line-clamp-1 max-w-[200px] text-[12.5px] text-ink-soft">{r.services_names}</span> : <span className="text-ink-faint">—</span>) },
            { key: 'projects', header: 'Proyectos', sortKey: 'projects', align: 'right', hideOnMobile: true, render: (r) => <span className="num">{r.projects_count}{r.open_projects > 0 && <span className="text-ink-soft"> · {r.open_projects} abiertos</span>}</span> },
            { key: 'billed', header: 'Facturado', sortKey: 'billed', align: 'right', render: (r) => <span className="num">{money(r.billed_cents)}</span> },
            { key: 'pending', header: 'Pendiente', sortKey: 'pending', align: 'right', render: (r) => (r.pending_cents > 0 ? <span className="num font-medium text-warn-ink">{money(r.pending_cents)}</span> : <span className="text-ink-faint">—</span>) },
            { key: 'status', header: 'Estado', sortKey: 'status', render: (r) => <LabelBadge set={CLIENT_STATUS} value={r.status} /> },
            { key: 'onboarded', header: 'Alta', sortKey: 'onboarded_at', hideBelow: 'xl', render: (r) => <span className="num text-[12.5px] text-ink-soft">{date(r.onboarded_at)}</span> },
            { key: 'tags', header: '', hideBelow: 'xl', render: (r) => <div className="flex gap-1">{r.tags?.slice(0, 2).map((t) => <Badge key={t}>{t}</Badge>)}</div> },
          ]}
        />
      </Glass>
    </div>
  );
}
