"use client";

import { useState, useTransition } from "react";
import type { OrderStatus } from "@/lib/orderWorkflow";
import {
  submitOrderAction,
  approveOrderAction,
  rejectOrderAction,
  cancelOrderAction,
  forceFulfillOrderAction,
} from "./actions";

const btnBase =
  "rounded border px-3 py-1.5 text-sm font-medium transition duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 disabled:active:scale-100";
const btnPrimary = `${btnBase} border-brand-600 bg-brand-600 text-white hover:bg-brand-700`;
const btnSecondary = `${btnBase} border-[#c2d0d6] bg-white text-[#3c4f5e] hover:bg-[#eef3f5]`;
const btnDanger = `${btnBase} border-[#fead9a] bg-white text-[#8e030f] hover:bg-[#feded8]`;

export function OrderActions({
  orderId,
  status,
  isAdmin,
  canApprove,
}: {
  orderId: number;
  status: OrderStatus;
  isAdmin: boolean;
  /** Approver departments may approve/reject; overrides and force-fulfil stay admin-only. */
  canApprove: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);

  const canCancel =
    status === "draft" || status === "submitted" || (status === "approved" && isAdmin);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" && (
          <button
            disabled={pending}
            onClick={() => startTransition(() => submitOrderAction(orderId))}
            className={btnPrimary}
          >
            Submit for approval
          </button>
        )}

        {status === "submitted" && canApprove && (
          <>
            <button
              disabled={pending}
              onClick={() => startTransition(() => approveOrderAction(orderId))}
              className={btnPrimary}
            >
              Approve
            </button>
            <button
              disabled={pending}
              onClick={() => setShowReject((v) => !v)}
              className={btnDanger}
            >
              Reject
            </button>
          </>
        )}

        {status === "approved" && isAdmin && (
          <button
            disabled={pending}
            onClick={() => startTransition(() => forceFulfillOrderAction(orderId))}
            className={btnSecondary}
            title="Force fulfilled without waiting for delivery plans to complete"
          >
            Force fulfilled
          </button>
        )}

        {canCancel && (
          <button
            disabled={pending}
            onClick={() => startTransition(() => cancelOrderAction(orderId))}
            className={btnSecondary}
          >
            Cancel order
          </button>
        )}
      </div>

      {showReject && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Rejection reason (required)"
            className="w-full rounded border border-[#c2d0d6] px-2 py-1 text-sm focus:border-brand-600 focus:outline-none sm:w-64"
          />
          <button
            disabled={pending || !rejectNote.trim()}
            onClick={() =>
              startTransition(() => {
                rejectOrderAction(orderId, rejectNote.trim());
                setShowReject(false);
              })
            }
            className={btnDanger}
          >
            Confirm reject
          </button>
        </div>
      )}
    </div>
  );
}
