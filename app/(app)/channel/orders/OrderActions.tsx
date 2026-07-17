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

const btnPrimary =
  "rounded border border-brand-600 bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50";
const btnSecondary =
  "rounded border border-[#c9c9c9] bg-white px-3 py-1.5 text-sm font-medium text-[#444] hover:bg-[#f3f3f3] disabled:opacity-50";
const btnDanger =
  "rounded border border-[#fead9a] bg-white px-3 py-1.5 text-sm font-medium text-[#8e030f] hover:bg-[#feded8] disabled:opacity-50";

export function OrderActions({
  orderId,
  status,
  isAdmin,
}: {
  orderId: number;
  status: OrderStatus;
  isAdmin: boolean;
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

        {status === "submitted" && isAdmin && (
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
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Rejection reason (required)"
            className="w-64 rounded border border-[#c9c9c9] px-2 py-1 text-sm focus:border-brand-600 focus:outline-none"
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
