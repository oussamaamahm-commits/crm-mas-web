import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MoreHorizontal, Package, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api, emitRefresh } from '../lib/api.js';
import { useApi, useDebounced } from '../lib/hooks.js';
import { date, isDemoLabel, money } from '../lib/format.js';
import { BILLING_PERIOD, CS_STATUS, SERVICE_CATEGORY, SERVICE_MODALITY } from '../lib/labels.js';
import { serviceFields } from '../forms.js';
import { DataTable } from '../components/DataTable.jsx';
import { FormModal } from '../components/FormModal.jsx';
import { ConfirmDialog } from '../components/Modal.jsx';
import { Badge, Button, Chips, DemoTag, EmptyState, Glass, IconButton, LabelBadge, Menu, PageHeader, SearchInput, Section } from '../components/ui.jsx';

export default function ServicesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ sort: 'name', dir: 'asc' });
  const search = useDebounced(q);
  const { data, loading, error, reload } = useApi('/services', { category, q: search, ...sort, pageSize: 200 });
  const contracts = useApi('/client-services', { status: 'active' });
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);

  return (
    <div>
      <PageHeader
        title="Servicios"
        subtitle="Catálogo de servicios de Web Pulsar y su contratación por clientes"
        actions={can('services.write') && <Button icon={Plus} onClick={() => setForm({})}>Nuevo servicio</Button>}
      />
      <Glass className="mb-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line/60 px-5 py-4 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar servicio…" className="lg:w-72" />
          <div className="overflow-x-auto"><Chips options={[{ value: '', label: 'Todas' }, ...SERVICE_CATEGORY.options]} value={category} onChange={setCategory} /></div>
        </div>
        <DataTable
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={sort}
          onSort={setSort}
          empty={
            <EmptyState
              icon={Package}
              title={q || category ? 'Ningún servicio coincide' : 'El catálogo está vacío'}
              description="Define diseño web, desarrollo, CRM, hosting, mantenimiento, automatizaciones o consultoría con su precio y periodicidad."
              action={can('services.write') && !q && !category && <Button icon={Plus} onClick={() => setForm({})}>Crear el primer servicio</Button>}
            />
          }
          columns={[
            { key: 'name', header: 'Servicio', sortKey: 'name', render: (r) => <div className="max-w-md"><p className="flex items-center gap-2 font-medium">{r.name}{isDemoLabel(r.name) && <DemoTag />}</p>{r.description && <p className="line-clamp-1 text-[12px] text-ink-soft">{r.description}</p>}</div> },
            { key: 'category', header: 'Categoría', sortKey: 'category', hideOnMobile: true, render: (r) => <Badge tone="brand">{SERVICE_CATEGORY.label(r.category)}</Badge> },
            { key: 'price', header: 'Precio', sortKey: 'price', align: 'right', render: (r) => <span className="num font-medium">{money(r.price_cents)}</span> },
            { key: 'modality', header: 'Modalidad', hideOnMobile: true, render: (r) => <span className="text-ink-soft">{SERVICE_MODALITY.label(r.modality)} · {BILLING_PERIOD.label(r.billing_period)}</span> },
            { key: 'margin', header: 'Margen', align: 'right', hideOnMobile: true, render: (r) => (r.internal_cost_cents != null && r.price_cents > 0 ? <span className="num text-ink-soft">{Math.round(((r.price_cents - r.internal_cost_cents) / r.price_cents) * 100)} %</span> : <span className="text-ink-faint">—</span>) },
            { key: 'clients', header: 'Clientes', sortKey: 'clients', align: 'right', render: (r) => <span className="num inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-ink-soft" />{r.active_clients}</span> },
            { key: 'status', header: 'Estado', render: (r) => <Badge tone={r.status === 'active' ? 'ok' : 'mute'} dot>{r.status === 'active' ? 'Activo' : 'Inactivo'}</Badge> },
            can('services.write') && {
              key: 'actions',
              header: '',
              align: 'right',
              render: (r) => (
                <Menu trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="Acciones" onClick={toggle} className="h-8 w-8" />} items={[{ label: 'Editar', icon: Pencil, onClick: () => setForm(r) }, { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(r) }]} />
              ),
            },
          ].filter(Boolean)}
        />
      </Glass>

      <Section title="Contrataciones activas" subtitle="Servicios asignados a clientes. Se gestionan desde la ficha de cada cliente." icon={Users} flush>
        <DataTable
          rows={contracts.data}
          loading={contracts.loading}
          empty={<EmptyState compact icon={Users} title="Ningún servicio contratado todavía" />}
          columns={[
            { key: 'client', header: 'Cliente', render: (r) => <Link to={`/clientes/${r.client_id}?tab=servicios`} className="font-medium hover:text-brand">{r.client_company || r.client_name}</Link> },
            { key: 'service', header: 'Servicio', render: (r) => r.service_name },
            { key: 'project', header: 'Proyecto', hideOnMobile: true, render: (r) => r.project_name ?? <span className="text-ink-faint">—</span> },
            { key: 'price', header: 'Precio', align: 'right', render: (r) => <span className="num">{money(r.price_cents)}</span> },
            { key: 'period', header: 'Periodicidad', hideOnMobile: true, render: (r) => BILLING_PERIOD.label(r.billing_period) },
            { key: 'since', header: 'Desde', hideOnMobile: true, render: (r) => <span className="num text-ink-soft">{date(r.start_date)}</span> },
            { key: 'status', header: 'Estado', render: (r) => <LabelBadge set={CS_STATUS} value={r.status} /> },
          ]}
        />
      </Section>

      <FormModal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar servicio' : 'Nuevo servicio'}
        icon={Package}
        fields={serviceFields()}
        initial={form}
        onSubmit={async (v) => {
          if (form.id) await api.patch(`/services/${form.id}`, v);
          else await api.post('/services', v);
          toast.success('Servicio guardado');
          emitRefresh();
        }}
      />
      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Eliminar servicio"
        message="Solo se pueden eliminar servicios que nunca se han contratado ni facturado. En otro caso, márcalo como inactivo."
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={async () => {
          await api.del(`/services/${remove.id}`);
          toast.success('Servicio eliminado');
          emitRefresh();
        }}
      />
    </div>
  );
}
