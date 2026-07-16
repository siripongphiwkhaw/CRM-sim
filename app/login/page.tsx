"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

const initialState: LoginFormState = {};

const inputClass =
  "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100 px-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-[0_8px_30px_rgba(41,37,36,0.08)]">
        <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-8 py-6">
          <h1 className="font-display text-3xl text-white">Loyalty CRM</h1>
          <p className="mt-1 text-sm text-brand-100">
            สุขภาพดี เริ่มต้นที่นี่ — well-being starts here
          </p>
        </div>

        <div className="p-8">
          <form action={formAction} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">
                Email
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
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">
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
              <p className="text-sm text-brand-700">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-4 text-xs text-stone-400">
            Admin: admin@crm.local · Staff: staff@crm.local — password demo123
          </p>
        </div>
      </div>
    </div>
  );
}
