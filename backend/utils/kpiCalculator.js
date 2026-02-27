import { get } from '../config/database.js';

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toRate(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round(((numerator / denominator) * 100) * 100) / 100;
}

export function getSalesKPIs() {
  const inquiries = get('SELECT COUNT(*) AS count FROM customer_inquiries WHERE is_deleted = 0')?.count || 0;
  const quotations = get('SELECT COUNT(*) AS count FROM quotations WHERE is_deleted = 0')?.count || 0;
  const performas = get('SELECT COUNT(*) AS count FROM performa_invoices WHERE is_deleted = 0')?.count || 0;
  const workOrders = get('SELECT COUNT(*) AS count FROM work_orders WHERE is_deleted = 0')?.count || 0;
  const revenue = get('SELECT COALESCE(SUM(total_amount), 0) AS total FROM work_orders WHERE is_deleted = 0 AND status IN (\'approved\', \'sent_to_production\', \'completed\')')?.total || 0;

  return {
    total_inquiries: inquiries,
    total_quotations: quotations,
    total_performas: performas,
    total_work_orders: workOrders,
    total_revenue: toNumber(revenue, 0),
    inquiry_to_quotation_rate: toRate(quotations, inquiries),
    quotation_to_performa_rate: toRate(performas, quotations),
    performa_to_work_order_rate: toRate(workOrders, performas),
  };
}
