import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck, CircleCheck, HeartPulse, MoreHorizontal, Pause, Pencil, Play, Plus, RefreshCw, Settings, Trash2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api, emitRefresh } from '../../lib/api.js';
import { useApi, useLookups } from '../../lib/hooks.js';
import { relative } from '../../lib/format.js';
import { ALERT_SEVERITY, ALERT_STATUS, CHECK_STATUS, CHECK_TYPE } from '../../lib/labels.js';
import { FormModal } from '../../components/FormModal.jsx';
import { ConfirmDialog } from '../../components/Modal.jsx';
import { Badge, Button, EmptyState, IconButton, LabelBadge, Menu, Notice, Section, Segmented, Skeleton, cx } from '../../components/ui.jsx';
import { UptimeBars } from '../../components/charts.jsx';

const ENTITY_OPTS = [
  { value: 'server', label: 'Servidor' },
  { value: 'domain', label: 'Dominio' },
  { value: 'database', label: 'Base de datos' },
  { value: 'application', label: 'Aplicación' },
];

export const checkFields = (lk, { editing = false } = {}) => [
  { name: 'name', label: 'Nombre', required: true, span: 2 },
  { name: 'type', label: 'Tipo de comprobación', type: 'select', required: true, default: 'http', disabled: editing, readOnly: editing, options: CHECK_TYPE.options.filter((o) => o.value !== 'heartbeat') },
  { name: 'target', label: 'Destino', mono: true, show: (v) => ['http', 'tcp', 'ssl_expiry', 'integration'].includes(v.type), hint: 'HTTP: URL completa · TCP: host:puerto · SSL: dominio · Integración: hostinger o cloudflare' },
  { name: 'entity_type', label: 'Recurso asociado', type: 'select', options: ENTITY_OPTS, required: false },
  { name: 'entity_id', label: 'Recurso', type: 'select', numeric: true, options: (v) => (({ server: lk.servers, domain: lk.domains, database: lk.databases, application: lk.applications })[v.entity_type] ?? []).map((x) => ({ value: x.id, label: x.label })) },
  { name: 'interval_s', label: 'Intervalo (segundos)', type: 'number', placeholder: '300' },
  { name: 'failure_threshold', label: 'Fallos seguidos para alertar', type: 'number', placeholder: '3' },
  { name: 'timeout_ms', label: 'Tiempo máximo (ms)', type: 'number', default: 10000 },
  { name: 'latency_warn_ms', label: 'Aviso de latencia (ms)', type: 'number', show: (v) => v.type === 'http' },
  { name: 'expected_status', label: 'Códigos HTTP esperados', default: '200-399', mono: true, show: (v) => v.type === 'http' },
  { name: 'keyword', label: 'Texto que debe aparecer', show: (v) => v.type === 'http', hint: 'Opcional: verifica el contenido además del código' },
  { name: 'enabled', label: 'Activa', type: 'switch', switchLabel: 'Comprobación activa', default: true, span: 2 },
];

export function MonitoringPanel() {
  const { can } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const lk = useLookups(['servers', 'domains', 'databases', 'applications']);
  const checks = useApi('/monitoring/checks');
  const [alertFilter, setAlertFilter] = useState('open');
  const alerts = useApi('/monitoring/alerts', { status: alertFilter });
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [running, setRunning] = useState(null);

  const act = async (fn, msg) => {
    try {
      const res = await fn();
      if (msg) toast.success(msg);
      emitRefresh();
      return res;
    } catch (err) {
      toast.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <Notice tone="brand" icon={HeartPulse}>
        Cada comprobación verifica exactamente lo que indica: una respuesta HTTP correcta confirma ese endpoint, no la salud completa del servidor ni de su base de datos. Los servidores se verifican con el agente (heartbeat y métricas) y las bases D1 con una consulta real.
        {can('settings.manage') && <Link to="/configuracion?tab=monitorizacion" className="ml-1 font-medium underline">Configurar umbrales</Link>}
      </Notice>

      <Section
        title="Alertas"
        icon={TriangleAlert}
        flush
        actions={<Segmented label="Estado de alertas" value={alertFilter} onChange={setAlertFilter} options={[{ value: 'open', label: 'Activas' }, { value: 'resolved', label: 'Resueltas' }, { value: 'all', label: 'Todas' }]} />}
      >
        {alerts.loading && !alerts.data ? (
          <div className="px-5 pb-5"><Skeleton className="h-16" /></div>
        ) : !alerts.data?.length ? (
          <EmptyState compact icon={CircleCheck} title={alertFilter === 'open' ? 'Sin alertas activas' : 'Sin alertas'} description="Las alertas aparecen cuando una comprobación falla repetidamente, un dominio se acerca a su caducidad o una integración pierde autorización." />
        ) : (
          <ul className="divide-y divide-line/60 pb-2">
            {alerts.data.map((a) => (
              <li key={a.id} className={cx('flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center', a.severity === 'critical' && a.status !== 'resolved' && 'bg-danger-soft/40')}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LabelBadge set={ALERT_SEVERITY} value={a.severity} />
                    <p className="text-[13.5px] font-medium">{a.title}</p>
                    {a.occurrences > 1 && <Badge>×{a.occurrences}</Badge>}
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-soft">{a.message}</p>
                  <p className="mt-1 text-[11.5px] text-ink-faint">
                    Abierta {relative(a.opened_at)} · última vez {relative(a.last_seen_at)}
                    {a.acknowledged_by_name && ` · reconocida por ${a.acknowledged_by_name}`}
                    {a.resolved_at && ` · resuelta ${relative(a.resolved_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <LabelBadge set={ALERT_STATUS} value={a.status} />
                  {a.incident_id ? (
                    <Link to={`/incidencias/${a.incident_id}`} className="btn-secondary btn-sm">Ver incidencia</Link>
                  ) : (
                    can('incidents.write') && a.status !== 'resolved' && (
                      <Button size="sm" variant="secondary" onClick={() => act(() => api.post(`/monitoring/alerts/${a.id}/incident`), 'Incidencia creada').then((r) => r && navigate(`/incidencias/${r.incident_id}`))}>
                        Crear incidencia
                      </Button>
                    )
                  )}
                  {can('monitoring.write') && a.status === 'open' && <IconButton icon={BellOff} label="Reconocer" onClick={() => act(() => api.post(`/monitoring/alerts/${a.id}/ack`), 'Alerta reconocida')} />}
                  {can('monitoring.write') && a.status !== 'resolved' && <IconButton icon={CheckCheck} label="Cerrar alerta" onClick={() => act(() => api.post(`/monitoring/alerts/${a.id}/resolve`), 'Alerta cerrada')} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Comprobaciones"
        subtitle="Disponibilidad, tiempo de respuesta, último resultado e histórico de 48 h"
        icon={HeartPulse}
        flush
        actions={can('monitoring.write') && <Button size="sm" icon={Plus} onClick={() => setForm({})}>Nueva comprobación</Button>}
      >
        {checks.loading && !checks.data ? (
          <div className="px-5 pb-5"><Skeleton className="h-24" /></div>
        ) : !checks.data?.length ? (
          <EmptyState compact icon={HeartPulse} title="Sin comprobaciones" description="Crea comprobaciones HTTP, de puertos, certificados SSL, caducidad de dominios o consultas D1. Al añadir un dominio puedes generarlas automáticamente." />
        ) : (
          <ul className="divide-y divide-line/60 pb-2">
            {checks.data.map((c) => (
              <li key={c.id} className={cx('grid gap-3 px-5 py-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center', !c.enabled && 'opacity-60')}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <LabelBadge set={CHECK_STATUS} value={c.last_status} />
                    <p className="truncate text-[13.5px] font-medium">{c.name}</p>
                    {!c.enabled && <Badge>Pausada</Badge>}
                  </div>
                  <p className="mono mt-1 truncate text-[11.5px] text-ink-soft">
                    {CHECK_TYPE.label(c.type)}
                    {c.target && ` · ${c.target}`}
                    {c.entity_name && ` · ${c.entity_name}`}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] text-ink-soft">{c.last_message ?? 'Pendiente de la primera ejecución'} · {c.last_checked_at ? relative(c.last_checked_at) : 'nunca'}</p>
                </div>
                <div className="min-w-0">
                  <UptimeBars bars={c.bars} />
                  <div className="mt-1.5 flex gap-4 text-[11.5px] text-ink-soft">
                    <span>24 h <span className="num font-medium text-ink">{c.uptime_24h.pct == null ? '—' : `${c.uptime_24h.pct} %`}</span></span>
                    <span>7 d <span className="num font-medium text-ink">{c.uptime_7d.pct == null ? '—' : `${c.uptime_7d.pct} %`}</span></span>
                    <span>30 d <span className="num font-medium text-ink">{c.uptime_30d.pct == null ? '—' : `${c.uptime_30d.pct} %`}</span></span>
                    {c.uptime_24h.avg_latency_ms != null && <span>media <span className="num font-medium text-ink">{c.uptime_24h.avg_latency_ms} ms</span></span>}
                  </div>
                </div>
                {can('monitoring.write') && (
                  <div className="flex justify-end gap-1">
                    <IconButton
                      icon={RefreshCw}
                      label="Ejecutar ahora"
                      className={running === c.id ? 'animate-spin' : ''}
                      onClick={async () => {
                        setRunning(c.id);
                        const r = await act(() => api.post(`/monitoring/checks/${c.id}/run`));
                        setRunning(null);
                        if (r) toast.info(`${c.name}: ${CHECK_STATUS.label(r.result.status)}`, r.result.message);
                      }}
                    />
                    <Menu
                      trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="Acciones" onClick={toggle} />}
                      items={[
                        c.type !== 'heartbeat' && { label: 'Editar', icon: Pencil, onClick: () => setForm(c) },
                        c.enabled ? { label: 'Pausar', icon: Pause, onClick: () => act(() => api.patch(`/monitoring/checks/${c.id}`, { enabled: false }), 'Comprobación pausada') } : { label: 'Reanudar', icon: Play, onClick: () => act(() => api.patch(`/monitoring/checks/${c.id}`, { enabled: true }), 'Comprobación reanudada') },
                        { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(c) },
                      ]}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      {can('settings.manage') && (
        <div className="flex justify-end">
          <Link to="/configuracion?tab=monitorizacion" className="btn-ghost"><Settings className="h-4 w-4" /> Umbrales y automatizaciones</Link>
        </div>
      )}

      <FormModal
        open={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Editar comprobación' : 'Nueva comprobación'}
        icon={HeartPulse}
        fields={checkFields(lk, { editing: !!form?.id })}
        initial={form}
        onSubmit={async (v) => {
          if (!v.entity_type) v.entity_id = null;
          for (const k of ['interval_s', 'failure_threshold', 'timeout_ms']) if (v[k] == null || Number.isNaN(v[k])) delete v[k];
          if (form.id) {
            delete v.type;
            await api.patch(`/monitoring/checks/${form.id}`, v);
          } else await api.post('/monitoring/checks', v);
          toast.success(form.id ? 'Comprobación actualizada' : 'Comprobación creada y ejecutada');
          emitRefresh();
        }}
      />
      <ConfirmDialog
        open={!!remove}
        onClose={() => setRemove(null)}
        title="Eliminar comprobación"
        message={remove && `«${remove.name}» y su histórico se eliminarán. Sus alertas activas se cerrarán.`}
        tone="danger"
        confirmLabel="Eliminar"
        onConfirm={async () => {
          await api.del(`/monitoring/checks/${remove.id}`);
          toast.success('Comprobación eliminada');
          emitRefresh();
        }}
      />
    </div>
  );
}
