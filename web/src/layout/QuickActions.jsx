import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, FolderKanban, Repeat, Server, TriangleAlert, UserPlus } from 'lucide-react';
import { FormModal } from '../components/FormModal.jsx';
import { Modal } from '../components/Modal.jsx';
import { Button, Field, Input, Notice, Select, Segmented } from '../components/ui.jsx';
import { api, emitRefresh } from '../lib/api.js';
import { useLookups } from '../lib/hooks.js';
import { useToast } from '../context/ToastContext.jsx';
import { clientFields, incidentFields, paymentFields, projectFields, serverFields } from '../forms.js';
import { PAYMENT_METHOD } from '../lib/labels.js';
import { centsToInput, money, todayIso, toCents } from '../lib/format.js';
import { recurringFields } from '../components/lists.jsx';

const QuickActionsContext = createContext(null);
export const useQuickActions = () => useContext(QuickActionsContext);

/** Registrar un cobro: contra una factura emitida o como pago sin factura. */
function RegisterPaymentModal({ open, onClose, defaults }) {
  const lk = useLookups(['clients', 'projects', 'open_invoices']);
  const toast = useToast();
  const [mode, setMode] = useState('invoice');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(todayIso());
  const [method, setMethod] = useState('transfer');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const invoices = lk.open_invoices ?? [];
  const selected = invoices.find((i) => String(i.id) === String(invoiceId));
  const clientName = (id) => lk.clients?.find((c) => c.id === id)?.label ?? '';

  useEffect(() => {
    if (!open) return;
    setMode(defaults?.mode ?? (lk.open_invoices && !lk.open_invoices.length ? 'standalone' : 'invoice'));
    setInvoiceId('');
    setAmount('');
    setRef('');
    setError(null);
  }, [open, lk.open_invoices, defaults?.mode]);

  const submitInvoice = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/invoices/${invoiceId}/payments`, { amount_cents: toCents(amount), paid_at: paidAt, method, external_ref: ref || null });
      toast.success('Pago registrado', `${money(toCents(amount))} · ${selected?.label}`);
      emitRefresh();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const modeSwitch = (
    <Segmented
      label="Tipo de pago"
      value={mode}
      onChange={setMode}
      options={[
        invoices.length > 0 && { value: 'invoice', label: 'Cobro de factura' },
        { value: 'standalone', label: 'Pago de entrada' },
        { value: 'monthly', label: 'Cuota mensual' },
      ].filter(Boolean)}
    />
  );

  if (mode === 'monthly') {
    return (
      <FormModal
        open={open}
        onClose={onClose}
        title="Registrar pago"
        subtitle="Cuota que el cliente paga cada mes. Los cobros de cada mes se generan solos."
        icon={Repeat}
        fields={recurringFields(lk, { creating: true })}
        initial={{ client_id: defaults?.client_id, first_paid: true }}
        notice={modeSwitch}
        onSubmit={async (values) => {
          await api.post('/recurring', values);
          toast.success('Cuota mensual creada', values.first_paid_at ? 'Primera cuota registrada como cobrada' : undefined);
          emitRefresh();
        }}
        submitLabel="Crear cuota"
      />
    );
  }

  return mode === 'standalone' ? (
    <FormModal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      subtitle="Pago único: anticipo, pago de proyecto o cobro pendiente sin factura"
      icon={CreditCard}
      fields={paymentFields(lk)}
      initial={{ ...defaults, amount_paid_cents: defaults?.amount_paid_cents ?? null }}
      notice={modeSwitch}
      onSubmit={async (values) => {
        const p = await api.post('/payments', values);
        toast.success(p.amount_paid_cents > 0 ? 'Pago registrado' : 'Cobro pendiente registrado', `${money(p.amount_cents)} · ${p.client_company || p.client_name}`);
        emitRefresh();
      }}
      submitLabel="Registrar"
    />
  ) : (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      subtitle="Cobro recibido de una factura emitida"
      icon={CreditCard}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submitInvoice} loading={busy} disabled={!invoiceId || !amount}>
            Registrar pago
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {modeSwitch}
        <Field label="Factura *" error={error?.fields?.invoice_id}>
          <Select
            value={invoiceId}
            onChange={(e) => {
              setInvoiceId(e.target.value);
              const inv = invoices.find((i) => String(i.id) === e.target.value);
              setAmount(inv ? centsToInput(inv.pending_cents) : '');
            }}
            placeholder="Selecciona una factura pendiente…"
            options={invoices.map((i) => ({ value: i.id, label: `${i.label} · ${clientName(i.client_id)} · pendiente ${money(i.pending_cents)}` }))}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importe recibido *" error={error?.fields?.amount_cents} hint={selected ? `Pendiente: ${money(selected.pending_cents)}` : undefined}>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className="num" />
          </Field>
          <Field label="Fecha de cobro *" error={error?.fields?.paid_at}>
            <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field label="Método *">
            <Select value={method} onChange={(e) => setMethod(e.target.value)} options={PAYMENT_METHOD.options} />
          </Field>
          <Field label="Referencia externa">
            <Input value={ref} onChange={(e) => setRef(e.target.value)} className="mono" />
          </Field>
        </div>
        {error && !Object.keys(error.fields ?? {}).length && <Notice tone="danger">{error.message}</Notice>}
      </div>
    </Modal>
  );
}

export function QuickActionsProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();
  const lk = useLookups(['clients', 'projects', 'users', 'servers', 'domains']);
  const close = useCallback(() => setCurrent(null), []);
  const open = useCallback((kind, defaults = {}) => {
    if (kind === 'invoice') return navigate(defaults.client_id ? `/finanzas/facturas/nueva?cliente=${defaults.client_id}` : '/finanzas/facturas/nueva');
    setCurrent({ kind, defaults });
  }, [navigate]);
  const value = useMemo(() => ({ open }), [open]);

  const done = (message, path) => {
    emitRefresh();
    toast.success(message);
    if (path) navigate(path);
  };

  const kind = current?.kind;
  return (
    <QuickActionsContext.Provider value={value}>
      {children}
      <FormModal
        open={kind === 'client'}
        onClose={close}
        title="Nuevo cliente"
        subtitle="Se creará su expediente completo"
        icon={UserPlus}
        size="lg"
        fields={clientFields()}
        initial={current?.defaults}
        submitLabel="Crear cliente"
        onSubmit={async (v) => {
          const c = await api.post('/clients', v);
          done(`Cliente creado: ${c.company || c.name}`, `/clientes/${c.id}`);
        }}
      />
      <FormModal
        open={kind === 'project'}
        onClose={close}
        title="Nuevo proyecto"
        icon={FolderKanban}
        size="lg"
        fields={projectFields(lk)}
        initial={current?.defaults}
        submitLabel="Crear proyecto"
        onSubmit={async (v) => {
          const p = await api.post('/projects', v);
          done(`Proyecto creado: ${p.name}`, `/proyectos/${p.id}`);
        }}
      />
      <FormModal
        open={kind === 'server'}
        onClose={close}
        title="Añadir servidor"
        subtitle="Registro manual. Los VPS de Hostinger se importan desde la integración."
        icon={Server}
        size="lg"
        fields={serverFields(lk)}
        initial={current?.defaults}
        submitLabel="Añadir servidor"
        onSubmit={async (v) => {
          const s = await api.post('/infrastructure/servers', v);
          done(`Servidor añadido: ${s.name}`, `/infraestructura/servidores/${s.id}`);
        }}
      />
      <FormModal
        open={kind === 'incident'}
        onClose={close}
        title="Nueva incidencia"
        icon={TriangleAlert}
        size="lg"
        fields={incidentFields(lk)}
        initial={current?.defaults}
        submitLabel="Crear incidencia"
        onSubmit={async (v) => {
          const i = await api.post('/incidents', v);
          done('Incidencia creada', `/incidencias/${i.id}`);
        }}
      />
      <RegisterPaymentModal open={kind === 'payment'} onClose={close} defaults={current?.defaults} />
    </QuickActionsContext.Provider>
  );
}
