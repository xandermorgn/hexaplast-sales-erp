/**
 * Shared sidebar menu items for sales dashboard pages.
 * Main employees get an extra "All Users" menu item.
 */

type MenuItem = { id: string; label: string }

export function getSalesMenuItems(user?: { role?: string; role_type?: string | null } | null): MenuItem[] {
  const base: MenuItem[] = [
    { id: "inquiries", label: "Customer Inquiries" },
    { id: "quotations", label: "Quotations" },
    { id: "performas", label: "Performas" },
    { id: "work-orders", label: "Work Orders" },
    { id: "products", label: "Products" },
    { id: "followups", label: "Follow Ups" },
    { id: "reports", label: "Reports" },
  ]

  const isMainEmployee = user?.role === "employee" && user?.role_type === "main"
  const isAdmin = user?.role === "master_admin"
  if (isMainEmployee || isAdmin) {
    base.push({ id: "all-users", label: "All Users" })
  }

  return base
}

export const salesRouteMap: Record<string, string> = {
  inquiries: "/dashboard/inquiries",
  quotations: "/dashboard/quotations",
  performas: "/dashboard/performas",
  "work-orders": "/dashboard/work-orders",
  products: "/dashboard/products",
  followups: "/dashboard/followups",
  reports: "/dashboard/reports",
  "all-users": "/dashboard/all-users",
}
