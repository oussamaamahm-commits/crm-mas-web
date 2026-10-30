import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleCheck, History, Inbox, Plus, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useQuickActions } from '../../layout/QuickActions.jsx';
import { useApi, useDebounced, usePersistentState } from '../../lib/hooks.js';
import { relative } from '../../lib/format.js';
import { INCIDENT_CATEGORY, INCIDENT_STATUS, PRIORITY } from '../../lib/labels.js';
import { DataTable } from '../../components/DataTable.jsx';
import { Avatar, Button, Chips, DemoTag, EmptyState, Glass, LabelBadge, PageHeader, SearchInput, Segmented, Switch, cx } from '../../components/ui.jsx';

export default function IncidentsPage() {
  const { can } = useAuth();
  const quick = useQuickActions();
  const navigate = useNavigate();
  const [view, setView] = usePersistentState('incidents-view', 'inbox');
  const [priority, setPriority] = useState('');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi('/incidents', { view, priority, mine: mine ? '1' : '', q: search, page, pageSize: 20, ...(sort ?? {}) });
  const counts = useApi('/badges');

  return (
    <div>
      <PageHeader
        title="Incidencias"
        subtitle="Problemas técnicos de clientes, proyectos e infraestructura, hasta su resolución"
        actions={can('incidents.write') && <Button icon={Plus} onClick={() => quick.open('incident')}>Crear incidencia</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          label="Vista"
          value={view}
          onChange={(v) => (setView(v), setPage(1), setSort(null))}
          options={[
            { value: 'inbox', label: <span className="inline-flex items-center gap-1.5"><Inbox className="h-3.5 w-3.5" />Bandeja{counts.data?.incidents ? ` · ${counts.data.incidents}` : ''}</span> },
            { value: 'history', label: <span className="inline-flex items-center gap-1.5"><History className="h-3.5 w-3.5" />Historial</span> },
            { value: 'all', label: 'Todas' },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Buscar incidencia, cliente o servidor…" className="lg:w-72" />
        <Chips options={[{ value: '', label: 'Todas las prioridades' }, ...PRIORITY.options.slice().reverse()]} value={priority} onChange={(v) => (setPriority(v), setPage(1))} />
        <div className="lg:ml-auto"><Switch checked={mine} onChange={setMine} label="Solo asignadas a mí" /></div>
      </div>
      <Glass className="overflow-hidden">
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={sort ?? { sort: data?.sort, dir: data?.dir }}
          onSort={setSort}
          onRowClick={(r) => navigate(`/incidencias/${r.id}`)}
          rowClassName={(r) => cx(r.priority === 'critical' && !['resolved', 'closed'].includes(r.status) && 'bg-danger-soft/50 shadow-[inset_3px_0_0_#E5484D]')}
          pagination={data && { page, pageSize: data.pageSize, total: data.total, onPage: setPage }}
          empty={
            view === 'inbox' ? (
              <EmptyState icon={CircleCheck} title="Bandeja limpia" description="No hay incidencias abiertas. Las alertas críticas de infraestructura crean incidencias automáticamente si así lo configuras." />
            ) : (
              <EmptyState compact icon={TriangleAlert} title="Sin incidencias" />
            )
          }
          columns={[
            { key: 'priority', header: 'Prioridad', sortKey: 'priority', render: (r) => <LabelBadge set={PRIORITY} value={r.priority} /> },
            {
              key: 'title',
              header: 'Incidencia',
              render: (r) => (
                <div className="min-w-0 max-w-md">
                  <p className="flex items-center gap-2 truncate font-medium">{r.title}{r.is_demo ? <DemoTag /> : null}</p>
                  <p className="truncate text-[12px] text-ink-soft">{INCIDENT_CATEGORY.label(r.category)}{r.source === 'alert' && ' · desde alerta'}{[r.client_name, r.server_name, r.domain_name].filter(Boolean).length ? ` · ${[r.client_name, r.server_name, r.domain_name].filter(Boolean).join(' · ')}` : ''}</p>
                </div>
              ),
            },
            { key: 'status', header: 'Estado', sortKey: 'status', render: (r) => <LabelBadge set={INCIDENT_STATUS} value={r.status} /> },
            { key: 'assignee', header: 'Responsable', hideOnMobile: true, render: (r) => (r.assignee_name ? <span className="inline-flex items-center gap-2"><Avatar name={r.assignee_name} size={22} />{r.assignee_name}</span> : <span className="text-ink-faint">Sin asignar</span>) },
            { key: 'opened', header: 'Apertura', sortKey: 'opened_at', hideOnMobile: true, render: (r) => <span className="text-[12.5px] text-ink-soft">{relative(r.opened_at)}</span> },
            view !== 'inbox' && { key: 'resolved', header: 'Resolución', sortKey: 'resolved_at', hideOnMobile: true, render: (r) => <span className="text-[12.5px] text-ink-soft">{r.resolved_at ? relative(r.resolved_at) : '—'}</span> },
          ].filter(Boolean)}
        />
      </Glass>
    </div>
  );
}
