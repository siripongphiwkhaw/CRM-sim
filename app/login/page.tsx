"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

const inputClass =
  "w-full rounded border border-[#c9c9c9] px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f3f3] px-4">
      <div className="w-full max-w-sm overflow-hidden rounded border border-[#e5e5e5] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
        <div className="bg-brand-800 px-8 py-7 text-center">
          {/* waffle mark, echoing the app-launcher icon in the signed-in shell */}
          <span aria-hidden className="mx-auto mb-3 grid w-fit grid-cols-3 gap-[3px] rounded bg-white/10 p-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-[1px] bg-white" />
            ))}
          </span>
          <h1 className="text-xl font-bold text-white">Loyalty Cloud</h1>
          <p className="mt-1 text-xs text-brand-100">Customer Data Platform</p>
        </div>

        <div className="p-8">
          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-xs font-semibold text-[#444]">
                Username
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue="admin@crm.local"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-semibold text-[#444]">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                defaultValue="demo123"
                required
                className={inputClass}
              />
            </div>

            {state.error && (
              <p className="text-sm text-[#8e030f]">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Signing in…" : "Log In"}
            </button>
          </form>

          <p className="mt-4 text-xs text-[#706e6b]">
            Admin: admin@crm.local · Staff: staff@crm.local — password demo123
          </p>
        </div>
      </div>
    </div>
  );
}
