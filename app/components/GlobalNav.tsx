"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavTab {
  href: string;
  label: string;
}

export function GlobalNav({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <nav className="border-b border-[#e5e5e5] bg-white px-4">
      <ul className="flex items-stretch gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`inline-flex items-center whitespace-nowrap border-b-[3px] px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-brand-600 font-semibold text-brand-700"
                    : "border-transparent text-[#444] hover:border-[#c9c9c9] hover:text-[#181818]"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
