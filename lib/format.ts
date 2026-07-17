export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** "3m ago" / "2h ago" / "5d ago" relative time for sync stamps. */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return "never";
  const then = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(then.getTime())) return "—";
  const secs = Math.max(0, (Date.now() - then.getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

export function isOverdue(dueDate: string | null, completed: number): boolean {
  if (!dueDate || completed) return false;
  const due = new Date(dueDate.length <= 10 ? `${dueDate}T23:59:59` : dueDate);
  return due.getTime() < Date.now();
}
