// Vista previa en el navegador. El servidor recalcula siempre con la misma fórmula (server/src/lib/money.js).
const round = (n) => Math.round(n + Number.EPSILON * Math.sign(n));

export function previewInvoice(items, { globalDiscountPct = 0, withholdingPct = 0 } = {}) {
  let subtotal = 0;
  let discount = 0;
  let tax = 0;
  const breakdown = {};
  const lines = items.map((item) => {
    const base = round(Number(item.quantity || 0) * Number(item.unit_price_cents || 0));
    const lineDiscount = round((base * Number(item.discount_pct || 0)) / 100);
    const afterLine = base - lineDiscount;
    const globalDiscount = round((afterLine * Number(globalDiscountPct || 0)) / 100);
    const net = afterLine - globalDiscount;
    const lineTax = round((net * Number(item.tax_rate || 0)) / 100);
    subtotal += base;
    discount += lineDiscount + globalDiscount;
    tax += lineTax;
    const k = String(Number(item.tax_rate || 0));
    breakdown[k] ??= { rate: Number(item.tax_rate || 0), base: 0, tax: 0 };
    breakdown[k].base += net;
    breakdown[k].tax += lineTax;
    return { net, tax: lineTax };
  });
  const taxable = subtotal - discount;
  const withholding = round((taxable * Number(withholdingPct || 0)) / 100);
  return { lines, subtotal, discount, taxable, tax, withholding, total: taxable + tax - withholding, breakdown: Object.values(breakdown).sort((a, b) => b.rate - a.rate) };
}
