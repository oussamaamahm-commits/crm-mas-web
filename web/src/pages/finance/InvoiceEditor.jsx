import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Info, Plus, Receipt, Save, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext.jsx';
import { api, emitRefresh } from '../../lib/api.js';
import { useApi, useLookups } from '../../lib/hooks.js';
import { centsToInput, money, toCents } from '../../lib/format.js';
import { previewInvoice } from '../../lib/invoiceMath.js';
import { Button, ErrorState, Field, Glass, IconButton, Input, Notice, PageHeader, Select, Skeleton, Textarea, cx } from '../../components/ui.jsx';

const emptyLine = (tax) => ({ key: Math.random().toString(36).slice(2), service_id: '', description: '', quantity: '1', unit_price: '', discount_pct: '0', tax_rate: String(tax ?? 21) });
const num = (v) => Number(String(v ?? '').replace(',', '.')) || 0;

export default function InvoiceEditor() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const lk = useLookups(['clients', 'projects', 'services', 'series']);
  const settings = useApi('/settings');
  const existing = useApi(id ? `/invoices/${id}` : null);
  const invoicing = settings.data?.invoicing;

  const [head, setHead] = useState(null);
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (head || !invoicing) return;
    if (id) {
      if (!existing.data) return;
      const inv = existing.data;
      setHead({
        client_id: String(inv.client_id),
        project_id: inv.project_id ? String(inv.project_id) : '',
        series_id: String(inv.series_id),
        issue_date: inv.issue_date ?? '',
        due_date: inv.due_date ?? '',
        global_discount_pct: String(inv.global_discount_pct ?? 0),
        withholding_pct: String(inv.withholding_pct ?? 0),
        notes: inv.notes ?? '',
        footer: inv.footer ?? '',
        kind: inv.kind,
      });
      setLines(inv.items.map((i) => ({ key: String(i.id), service_id: i.service_id ? String(i.service_id) : '', description: i.description, quantity: String(i.quantity).replace('.', ','), unit_price: centsToInput(i.unit_price_cents), discount_pct: String(i.discount_pct), tax_rate: String(i.tax_rate) })));
    } else {
      setHead({ client_id: search.get('cliente') ?? '', project_id: search.get('proyecto') ?? '', series_id: '', issue_date: '', due_date: '', global_discount_pct: '0', withholding_pct: String(invoicing.default_withholding ?? 0), notes: '', footer: '', kind: 'standard' });
      setLines([emptyLine(invoicing.default_tax_rate)]);
    }
  }, [id, existing.data, invoicing, head, search]);

  const items = useMemo(() => lines.map((l) => ({ quantity: num(l.quantity), unit_price_cents: toCents(l.unit_price) || 0, discount_pct: num(l.discount_pct), tax_rate: num(l.tax_rate) })), [lines]);
  const totals = useMemo(() => previewInvoice(items, { globalDiscountPct: num(head?.global_discount_pct), withholdingPct: num(head?.withholding_pct) }), [items, head]);

  if (existing.error) return <ErrorState error={existing.error} />;
  if (id && existing.data && existing.data.status !== 'draft') {
    return <Notice tone="warn" title="Factura emitida">Las facturas emitidas no se editan. Para corregirla, crea una factura rectificativa desde su ficha.</Notice>;
  }
  if (!head) return <div className="space-y-4"><Skeleton className="h-12 w-72" /><Skeleton className="h-96 rounded-card" /></div>;

  const rectifying = head.kind === 'rectifying';
  const setH = (k, v) => setHead((h) => ({ ...h, [k]: v }));
  const setL = (key, k, v) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: v } : l)));
  const pickService = (key, serviceId) => {
    const s = lk.services?.find((x) => String(x.id) === serviceId);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, service_id: serviceId, description: s ? s.label : l.description, unit_price: s ? centsToInput(s.price_cents) : l.unit_price } : l)));
  };
  const projects = (lk.projects ?? []).filter((p) => !head.client_id || String(p.client_id) === head.client_id);
  const series = (lk.series ?? []).filter((s) => s.kind === (rectifying ? 'rectifying' : 'standard'));
  const taxOptions = (invoicing.tax_rates ?? [21, 10, 4, 0]).map((r) => ({ value: String(r), label: `${r} %` }));

  const save = async () => {
    setBusy(true);
    setErrors({});
    const body = {
      client_id: head.client_id ? Number(head.client_id) : null,
      project_id: head.project_id ? Number(head.project_id) : null,
      series_id: head.series_id ? Number(head.series_id) : null,
      issue_date: head.issue_date || null,
      due_date: head.due_date || null,
      global_discount_pct: num(head.global_discount_pct),
      withholding_pct: num(head.withholding_pct),
      notes: head.notes || null,
      footer: head.footer || null,
      items: lines.map((l, i) => ({ service_id: l.service_id ? Number(l.service_id) : null, description: l.description, quantity: num(l.quantity), unit_price_cents: toCents(l.unit_price) || 0, discount_pct: items[i].discount_pct, tax_rate: items[i].tax_rate })),
    };
    try {
      const inv = id ? await api.put(`/invoices/${id}`, body) : await api.post('/invoices', body);
      toast.success('Borrador guardado', 'La numeración se asignará al emitir la factura.');
      emitRefresh();
      navigate(`/finanzas/facturas/${inv.id}`);
    } catch (err) {
      setErrors(err.fields ?? {});
      toast.error(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        back={{ to: id ? `/finanzas/facturas/${id}` : '/finanzas?tab=facturas', label: id ? 'Factura' : 'Facturas' }}
        title={id ? (rectifying ? 'Editar rectificativa' : 'Editar borrador') : 'Nueva factura'}
        subtitle="Los importes se calculan en el servidor al guardar. El número se asigna al emitir, de forma correlativa por serie."
        actions={<Button icon={Save} loading={busy} onClick={save}>Guardar borrador</Button>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Glass className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Cliente *" error={errors.client_id}>
                <Select value={head.client_id} onChange={(e) => (setH('client_id', e.target.value), setH('project_id', ''))} disabled={rectifying} placeholder="Selecciona un cliente…" options={(lk.clients ?? []).map((c) => ({ value: String(c.id), label: c.label }))} invalid={!!errors.client_id} />
              </Field>
              <Field label="Proyecto">
                <Select value={head.project_id} onChange={(e) => setH('project_id', e.target.value)} placeholder="Sin proyecto" options={projects.map((p) => ({ value: String(p.id), label: p.label }))} />
              </Field>
              <Field label="Serie">
                <Select value={head.series_id} onChange={(e) => setH('series_id', e.target.value)} placeholder="Serie por defecto" options={series.map((s) => ({ value: String(s.id), label: `${s.code} · ${s.label}` }))} />
              </Field>
              <Field label="Fecha de emisión" hint="Vacía = fecha del día en que se emita" error={errors.issue_date}>
                <Input type="date" value={head.issue_date} onChange={(e) => setH('issue_date', e.target.value)} />
              </Field>
              <Field label="Vencimiento" hint={`Vacío = ${invoicing.payment_terms_days} días tras la emisión`} error={errors.due_date}>
                <Input type="date" value={head.due_date} onChange={(e) => setH('due_date', e.target.value)} />
              </Field>
              <Field label="Retención IRPF">
                <Select value={head.withholding_pct} onChange={(e) => setH('withholding_pct', e.target.value)} options={(invoicing.withholding_rates ?? [0, 7, 15]).map((r) => ({ value: String(r), label: r ? `${r} %` : 'Sin retención' }))} />
              </Field>
            </div>
          </Glass>

          <Glass className="overflow-hidden">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <p className="text-[14.5px] font-medium">Conceptos</p>
              {errors.items && <p className="text-[12px] text-danger">{errors.items}</p>}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="min-w-[280px]">Concepto</th>
                    <th className="w-24 text-right">Cantidad</th>
                    <th className="w-32 text-right">Precio</th>
                    <th className="w-24 text-right">Dto. %</th>
                    <th className="w-28">IVA</th>
                    <th className="w-32 text-right">Importe</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.key}>
                      <td className="align-top">
                        <Select className="mb-1.5 py-1.5 text-[12px]" value={l.service_id} onChange={(e) => pickService(l.key, e.target.value)} placeholder="Servicio del catálogo (opcional)" options={(lk.services ?? []).map((s) => ({ value: String(s.id), label: s.label }))} />
                        <Textarea rows={2} value={l.description} onChange={(e) => setL(l.key, 'description', e.target.value)} placeholder="Descripción del concepto" invalid={!!errors[`items.${i}.description`]} />
                      </td>
                      <td className="align-top"><Input className="num text-right" inputMode="decimal" value={l.quantity} onChange={(e) => setL(l.key, 'quantity', e.target.value)} invalid={!!errors[`items.${i}.quantity`]} /></td>
                      <td className="align-top"><Input className="num text-right" inputMode="decimal" value={l.unit_price} onChange={(e) => setL(l.key, 'unit_price', e.target.value)} placeholder="0,00" invalid={!!errors[`items.${i}.unit_price_cents`]} /></td>
                      <td className="align-top"><Input className="num text-right" inputMode="decimal" value={l.discount_pct} onChange={(e) => setL(l.key, 'discount_pct', e.target.value)} /></td>
                      <td className="align-top"><Select value={l.tax_rate} onChange={(e) => setL(l.key, 'tax_rate', e.target.value)} options={taxOptions.some((o) => o.value === l.tax_rate) ? taxOptions : [...taxOptions, { value: l.tax_rate, label: `${l.tax_rate} %` }]} /></td>
                      <td className={cx('num pt-4 text-right align-top font-medium', totals.lines[i]?.net < 0 && 'text-danger')}>{money(totals.lines[i]?.net ?? 0)}</td>
                      <td className="align-top">
                        <IconButton icon={Trash2} label="Quitar línea" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="mt-1 h-8 w-8 disabled:opacity-30" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3">
              <Button variant="ghost" icon={Plus} onClick={() => setLines((ls) => [...ls, emptyLine(invoicing.default_tax_rate)])}>Añadir concepto</Button>
            </div>
          </Glass>

          <Glass className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Notas (aparecen en la factura)">
              <Textarea rows={3} value={head.notes} onChange={(e) => setH('notes', e.target.value)} />
            </Field>
            <Field label="Pie de factura" hint="Vacío = pie configurado en Facturación">
              <Textarea rows={3} value={head.footer} onChange={(e) => setH('footer', e.target.value)} />
            </Field>
          </Glass>
        </div>

        <div>
          <Glass strong className="sticky top-24 p-5">
            <p className="mb-4 flex items-center gap-2 text-[14.5px] font-medium"><Receipt className="h-4 w-4 text-brand" />Totales</p>
            <Field label="Descuento global %" className="mb-4">
              <Input className="num" inputMode="decimal" value={head.global_discount_pct} onChange={(e) => setH('global_discount_pct', e.target.value)} />
            </Field>
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="num">{money(totals.subtotal)}</dd></div>
              {totals.discount !== 0 && <div className="flex justify-between"><dt className="text-ink-soft">Descuentos</dt><dd className="num">−{money(totals.discount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-ink-soft">Base imponible</dt><dd className="num">{money(totals.taxable)}</dd></div>
              {totals.breakdown.map((b) => (
                <div key={b.rate} className="flex justify-between"><dt className="text-ink-soft">IVA {b.rate} %</dt><dd className="num">{money(b.tax)}</dd></div>
              ))}
              {totals.withholding !== 0 && <div className="flex justify-between"><dt className="text-ink-soft">Retención IRPF {head.withholding_pct} %</dt><dd className="num">−{money(totals.withholding)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-3 text-[17px] font-medium"><dt>Total</dt><dd className="num text-brand-deep">{money(totals.total)}</dd></div>
            </dl>
            <Button icon={Save} loading={busy} onClick={save} className="mt-5 w-full">Guardar borrador</Button>
            <p className="mt-3 flex gap-2 text-[11.5px] text-ink-soft"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />Vista previa calculada en el navegador. El servidor recalcula y valida los importes al guardar.</p>
          </Glass>
        </div>
      </div>
    </div>
  );
}
