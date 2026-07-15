import Link from "next/link";
import type { DealStage, TaskType } from "@/lib/constants";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "border border-slate-300 text-slate-700 hover:bg-slate-100";
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium ${styles}`}
    >
      {children}
    </Link>
  );
}

const STAGE_STYLES: Record<DealStage, string> = {
  New: "bg-slate-100 text-slate-700",
  Contacted: "bg-blue-100 text-blue-700",
  Qualified: "bg-violet-100 text-violet-700",
  Proposal: "bg-amber-100 text-amber-700",
  Won: "bg-emerald-100 text-emerald-700",
  Lost: "bg-rose-100 text-rose-700",
};

export function StageBadge({ stage }: { stage: DealStage }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {stage}
    </span>
  );
}

const TASK_TYPE_STYLES: Record<TaskType, string> = {
  call: "bg-blue-100 text-blue-700",
  email: "bg-indigo-100 text-indigo-700",
  note: "bg-slate-100 text-slate-700",
  meeting: "bg-violet-100 text-violet-700",
  follow_up: "bg-amber-100 text-amber-700",
};

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  call: "Call",
  email: "Email",
  note: "Note",
  meeting: "Meeting",
  follow_up: "Follow-up",
};

export function TaskTypeBadge({ type }: { type: TaskType }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TASK_TYPE_STYLES[type]}`}
    >
      {TASK_TYPE_LABELS[type]}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}
