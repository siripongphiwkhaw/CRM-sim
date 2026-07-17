export const ORDER_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "fulfilled",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

/**
 * Legal next states for an order. `approved -> fulfilled` is never triggered
 * directly by a user action — it fires automatically once every linked
 * delivery plan is delivered (see db/queries/deliveryPlans.ts), or via an
 * admin's manual "force fulfilled" override, both of which call
 * applyOrderTransition the same as every other transition.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["fulfilled", "cancelled"],
  rejected: [],
  fulfilled: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
