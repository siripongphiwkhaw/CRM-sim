"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MemberPickerRow } from "@/db/queries/member";
import { impersonateMemberAction } from "../actions";

export function MemberPicker({ members }: { members: MemberPickerRow[] }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (members.length === 0) {
    return (
      <p className="rounded-[14px] border border-dashed border-[#c2d0d6] bg-white p-6 text-center text-sm text-[#607785]">
        No B2C members exist yet. Run <span className="font-mono text-xs">npx tsx scripts/seed-demo.ts</span> to
        create some.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id}>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await impersonateMemberAction(m.id);
                router.push("/liff");
              })
            }
            className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-[14px] border border-[#dde5e8] bg-white px-4 py-3 text-left active:bg-[#eef3f5] disabled:opacity-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#14202b]">{m.name}</p>
              <p className="mt-0.5 font-mono text-xs text-[#607785]">{m.member_code}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-[#14202b]">
                {m.points.toLocaleString("en-US")}
              </p>
              <p className="text-xs text-[#607785]">{m.tier}</p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
