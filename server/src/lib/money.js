// Cálculo de importes de factura en céntimos enteros (redondeo comercial por línea).

const round = (n) => Math.round(n + Number.EPSILON * Math.sign(n));

/**
 * Calcula cada línea y los totales.
 * Descuento de línea y descuento global se aplican sobre la base antes de impuestos;
 * la retención (IRPF) se calcula sobre la base imponible total.
 */
export function computeInvoice(items, { globalDiscountPct = 0, withholdingPct = 0 } = {}) {
  const lines = items.map((item, index) => {
    const base = round(Number(item.quantity) * Number(item.unit_price_cents));
    const lineDiscount = round((base * Number(item.discount_pct || 0)) / 100);
    const afterLine = base - lineDiscount;
    const globalDiscount = round((afterLine * Number(globalDiscountPct || 0)) / 100);
    const net = afterLine - globalDiscount;
    const tax = round((net * Number(item.tax_rate || 0)) / 100);
    return {
      ...item,
      position: index,
      base_cents: base,
      discount_cents: lineDiscount + globalDiscount,
      tax_cents: tax,
      total_cents: net + tax,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.base_cents, 0);
  const discount = lines.reduce((s, l) => s + l.discount_cents, 0);
  const tax = lines.reduce((s, l) => s + l.tax_cents, 0);
  const taxable = subtotal - discount;
  const withholding = round((taxable * Number(withholdingPct || 0)) / 100);

  const taxBreakdown = {};
  for (const l of lines) {
    const key = String(Number(l.tax_rate));
    taxBreakdown[key] ??= { rate: Number(l.tax_rate), base_cents: 0, tax_cents: 0 };
    taxBreakdown[key].base_cents += l.base_cents - l.discount_cents;
    taxBreakdown[key].tax_cents += l.tax_cents;
  }

  return {
    lines,
    totals: {
      subtotal_cents: subtotal,
      discount_cents: discount,
      taxable_cents: taxable,
      tax_cents: tax,
      withholding_cents: withholding,
      total_cents: taxable + tax - withholding,
      tax_breakdown: Object.values(taxBreakdown).sort((a, b) => b.rate - a.rate),
    },
  };
}

/** Formatea el número de factura según el patrón de la serie. */
export function formatInvoiceNumber(series, year, sequence) {
  const num = String(sequence).padStart(series.padding, '0');
  return series.format
    .replaceAll('{PREFIX}', series.prefix)
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{YY}', String(year).slice(-2))
    .replaceAll('{NUM}', num);
}

export function paymentStatus({ amount_cents, amount_paid_cents, due_date, status }, todayIso) {
  if (status === 'cancelled' || status === 'refunded') return status;
  if (amount_paid_cents >= amount_cents) return 'paid';
  if (due_date && due_date < todayIso) return 'overdue';
  if (amount_paid_cents > 0) return 'partially_paid';
  return 'pending';
}

export function invoiceStatus({ status, total_cents, paid_cents, due_date }, todayIso) {
  if (status === 'draft' || status === 'cancelled') return status;
  if (total_cents <= 0 || paid_cents >= total_cents) return 'paid';
  if (due_date && due_date < todayIso) return 'overdue';
  if (paid_cents > 0) return 'partially_paid';
  return 'issued';
}
