import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, Fingerprint, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { useApi, useDebounced, useLookups } from '../lib/hooks.js';
import { dateTime } from '../lib/format.js';
import { ACCESS_EVENT } from '../lib/labels.js';
import { DataTable } from '../components/DataTable.jsx';
import { Button, EmptyState, Input, LabelBadge, Notice, PageHeader, Pagination, SearchInput, Section, Select, Tabs } from '../components/ui.jsx';
import { Timeline } from '../components/Timeline.jsx';

const ENTITY_TYPES = [
  ['client', 'Clientes'], ['project', 'Proyectos'], ['task', 'Tareas'], ['invoice', 'Facturas'], ['payment', 'Cobros'], ['expense', 'Gastos'], ['recurring', 'Recurrentes'],
  ['server', 'Servidores'], ['domain', 'Dominios'], ['database', 'Bases de datos'], ['application', 'Aplicaciones'], ['incident', 'Incidencias'], ['alert', 'Alertas'],
  ['integration', 'Integraciones'], ['document', 'Documentos'], ['secret', 'Credenciales'], ['testimonial', 'Testimonios'], ['user', 'Usuarios'], ['settings', 'Configuración'],
].map(([value, label]) => ({ value, label }));

function ActivityTab() {
  const lk = useLookups(['users']);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [user, setUser] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, loading } = useApi('/activity', { q: search, entity_type: type, user_id: user, from, to, page, pageSize: 30 });
  return (
    <Section title="Registro cronológico" subtitle="Inmutable: ningún usuario puede editar ni borrar entradas" icon={Activity} flush>
      <div className="grid gap-3 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-5">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Buscar en la actividad…" className="lg:col-span-2" />
        <Select value={type} onChange={(e) => (setType(e.target.value), setPage(1))} placeholder="Todas las entidades" options={ENTITY_TYPES} />
        <Select value={user} onChange={(e) => (setUser(e.target.value), setPage(1))} placeholder="Todos los usuarios" options={(lk.users ?? []).map((u) => ({ value: u.id, label: u.label }))} />
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} aria-label="Desde" />
          <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} aria-label="Hasta" />
        </div>
      </div>
      <div className="px-5 pb-2">
        {data?.items?.length === 0 ? <EmptyState compact icon={Activity} title="Sin actividad para estos filtros" /> : <Timeline items={data?.items} loading={loading} />}
      </div>
      {data && <Pagination page={page} pageSize={data.pageSize} total={data.total} onPage={setPage} />}
    </Section>
  );
}

function AuditTab() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const search = useDebounced(q);
  const { data, loading } = useApi('/audit', { page, pageSize: 30, q: search });
  const [verify, setVerify] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Notice tone="brand" icon={Fingerprint}>
        Cada entrada de auditoría incluye la huella SHA-256 de la anterior. Si alguien alterase una fila directamente en la base de datos, la verificación de integridad lo detectaría.
      </Notice>
      <Section
        title="Auditoría técnica"
        icon={Fingerprint}
        flush
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={ShieldCheck}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                setVerify(await api.get('/audit/verify'));
              } catch (err) {
                toast.error(err);
              } finally {
                setBusy(false);
              }
            }}
          >
            Verificar integridad
          </Button>
        }
      >
        {verify && (
          <Notice tone={verify.ok ? 'ok' : 'danger'} className="mx-5 mb-4">
            {verify.ok ? `Cadena íntegra: ${verify.count} registros verificados.` : `Integridad comprometida en el registro #${verify.brokenAt}. Revisa los accesos al servidor y restaura una copia si es necesario.`}
          </Notice>
        )}
        <div className="px-5 pb-3"><SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Filtrar por acción, entidad o usuario…" className="max-w-sm" /></div>
        <DataTable
          rows={data?.items}
          loading={loading}
          dense
          pagination={data && { page, pageSize: data.pageSize, total: data.total, onPage: setPage }}
          empty={<EmptyState compact icon={Fingerprint} title="Sin registros" />}
          columns={[
            { key: 'time', header: 'Fecha', render: (r) => <span className="num whitespace-nowrap text-[12px]">{dateTime(r.created_at)}</span> },
            { key: 'user', header: 'Usuario', render: (r) => r.user_name ?? <span className="text-ink-soft">Sistema</span> },
            { key: 'action', header: 'Acción', render: (r) => <span className="mono text-[12px]">{r.action}</span> },
            { key: 'entity', header: 'Entidad', hideOnMobile: true, render: (r) => <span className="mono text-[12px] text-ink-soft">{r.entity_type ? `${r.entity_type}${r.entity_id ? ` #${r.entity_id}` : ''}` : '—'}</span> },
            { key: 'ip', header: 'IP', hideOnMobile: true, render: (r) => <span className="mono text-[12px] text-ink-soft">{r.ip ?? '—'}</span> },
            { key: 'hash', header: 'Huella', hideOnMobile: true, render: (r) => <span className="mono text-[11px] text-ink-faint" title={r.hash}>{r.hash.slice(0, 12)}…</span> },
          ]}
        />
      </Section>
    </div>
  );
}

function AccessTab() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi('/access-logs', { page, pageSize: 30 });
  return (
    <Section title="Registro de accesos" subtitle="Inicios de sesión, intentos fallidos, bloqueos y cambios de contraseña" icon={LogIn} flush>
      <DataTable
        rows={data?.items}
        loading={loading}
        dense
        pagination={data && { page, pageSize: data.pageSize, total: data.total, onPage: setPage }}
        empty={<EmptyState compact icon={LogIn} title="Sin accesos registrados" />}
        columns={[
          { key: 'time', header: 'Fecha', render: (r) => <span className="num whitespace-nowrap text-[12px]">{dateTime(r.created_at)}</span> },
          { key: 'event', header: 'Evento', render: (r) => <LabelBadge set={ACCESS_EVENT} value={r.event} /> },
          { key: 'email', header: 'Cuenta', render: (r) => r.user_name ?? r.email ?? '—' },
          { key: 'ip', header: 'IP', render: (r) => <span className="mono text-[12px]">{r.ip ?? '—'}</span> },
          { key: 'ua', header: 'Navegador', hideOnMobile: true, render: (r) => <span className="line-clamp-1 max-w-[320px] text-[11.5px] text-ink-soft">{r.user_agent ?? '—'}</span> },
        ]}
      />
    </Section>
  );
}

export default function ActivityPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'actividad';
  const tabs = [
    { key: 'actividad', label: 'Actividad', icon: Activity },
    can('audit.read') && { key: 'auditoria', label: 'Auditoría', icon: Fingerprint },
    can('audit.read') && { key: 'accesos', label: 'Accesos', icon: LogIn },
  ].filter(Boolean);
  return (
    <div>
      <PageHeader title="Actividad" subtitle="Registro auditable de las operaciones importantes de Web Pulsar" />
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} className="mb-6" />
      {tab === 'actividad' && <ActivityTab />}
      {tab === 'auditoria' && can('audit.read') && <AuditTab />}
      {tab === 'accesos' && can('audit.read') && <AccessTab />}
    </div>
  );
}
