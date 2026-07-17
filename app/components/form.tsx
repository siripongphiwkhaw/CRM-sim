"use client";

import { useFormStatus } from "react-dom";

const inputClass =
  "w-full rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm text-[#181818] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-[#f3f3f3]";

export function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold text-[#444]"
      >
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-[#706e6b]">{hint}</p>}
    </div>
  );
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      {...props}
      className={`${inputClass} ${props.className ?? ""}`}
    />
  );
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className ?? ""}`}>
      {children}
    </select>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded border border-[#fead9a] bg-[#feded8] px-3 py-2 text-sm text-[#8e030f]">
      {message}
    </div>
  );
}

export function FormSuccess({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded border border-[#9be6ae] bg-[#cdefc4] px-3 py-2 text-sm text-[#194e31]">
      {message}
    </div>
  );
}

export function SubmitButton({
  children = "Save",
}: {
  children?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center rounded border border-brand-600 bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 hover:border-brand-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : children}
    </button>
  );
}

export function DeleteButton({
  action,
  id,
  label = "Delete",
  confirmMessage = "Are you sure you want to delete this? This cannot be undone.",
}: {
  action: (formData: FormData) => void;
  id: number;
  label?: string;
  confirmMessage?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="inline-flex items-center rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm font-medium text-[#8e030f] transition-colors hover:bg-[#feded8]"
      >
        {label}
      </button>
    </form>
  );
}
