function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function calculateLineItemTotals({ quantity, price, discount_percent, gst_percent }) {
  const normalizedQuantity = Math.max(0, toNumber(quantity, 0));
  const normalizedPrice = Math.max(0, toNumber(price, 0));
  const normalizedDiscountPercent = Math.max(0, toNumber(discount_percent, 0));
  const normalizedGstPercent = Math.max(0, toNumber(gst_percent, 0));

  const base = normalizedQuantity * normalizedPrice;
  const discount_amount = Math.min(base, (base * normalizedDiscountPercent) / 100);
  const taxable = Math.max(0, base - discount_amount);
  const gst_amount = (taxable * normalizedGstPercent) / 100;
  const total = taxable + gst_amount;

  return {
    base,
    discount_amount,
    taxable,
    gst_amount,
    total,
  };
}
