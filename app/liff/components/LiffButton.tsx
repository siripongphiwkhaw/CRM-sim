"use client";

import { useFormStatus } from "react-dom";

/**
 * Thumb-sized submit button — min 44px tall, unlike the CRM's SubmitButton
 * (~30px). Disables while pending, which also blunts the double-tap
 * double-redeem race.
 */
export function LiffButton({
  children,
  variant = "primary",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-brand-600 text-white active:bg-brand-700 disabled:bg-[#9fded6]"
      : "border border-[#c2d0d6] bg-white text-[#3c4f5e] active:bg-[#eef3f5]";
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`min-h-[44px] w-full rounded-[12px] px-4 text-base font-semibold transition duration-150 active:scale-[0.99] disabled:cursor-not-allowed ${styles}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
