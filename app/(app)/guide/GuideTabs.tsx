"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui";

type RoleKey = "staff" | "pic" | "admin";

interface Step {
  /** A short "how to" task title. */
  task: string;
  /** Plain-language, numbered steps. */
  steps: string[];
  /** Optional tip shown under the steps. */
  tip?: string;
}

interface GuideSection {
  heading: string;
  blurb: string;
  tasks: Step[];
}

interface RoleGuide {
  key: RoleKey;
  label: string;
  tagline: string;
  /** One-line "what you can do" bullets shown at the top of the tab. */
  canDo: string[];
  sections: GuideSection[];
}

const STAFF_SECTIONS: GuideSection[] = [
  {
    heading: "Members & Customer 360",
    blurb: "Members are your customers. Each has a member code like CUS-000123 and a 360° profile page.",
    tasks: [
      {
        task: "Find or add a member",
        steps: [
          "Open Members from the left menu.",
          "Search by name, phone, email, or member code in the search box.",
          "Not there yet? Click New Member, fill in the details, choose B2C (shopper) or B2B (business), and pick a consent option (Accept all, or Without marketing).",
        ],
        tip: "The member code (CUS-000123) is generated automatically — you don't type it.",
      },
      {
        task: "Record a purchase and give points",
        steps: [
          "Open the member's profile (click their name).",
          "In Record a transaction, choose the channel (POS, E-Commerce, Direct, or Sales Force) and type the amount in Baht.",
          "Save — points are added instantly and you'll see a “+N pts” confirmation.",
        ],
        tip: "Points = amount ÷ rate × tier multiplier. A B2B member billed through a shopper channel still earns at the B2B rate, and you'll see an eligibility warning chip.",
      },
      {
        task: "Redeem a reward for a member",
        steps: [
          "On the member's profile, find Redeem a reward.",
          "Pick a reward from the list and confirm.",
          "If the member doesn't have enough points, you'll get an inline error — no points are deducted.",
        ],
      },
      {
        task: "Update marketing / privacy consent (PDPA)",
        steps: [
          "On the member's profile, open the Consent card.",
          "Grant or withdraw each purpose separately: Marketing, Analytics, Profiling.",
          "Every change is logged with a date so there's a full history.",
        ],
        tip: "Only members who have granted Marketing consent can be sent marketing messages.",
      },
    ],
  },
  {
    heading: "Next Best Action & Timeline",
    blurb: "Each profile suggests the smartest next step and shows one merged activity history.",
    tasks: [
      {
        task: "Act on the Next Best Action",
        steps: [
          "Look at the amber Next Best Action card near the top of a member's profile.",
          "It reads the member's data and recommends one step (e.g. request consent, invite to a tier, nudge a redemption).",
          "Do the suggested step, then refresh to see it update.",
        ],
      },
      {
        task: "Read the activity timeline",
        steps: [
          "Scroll to the member's Timeline.",
          "It combines purchases, points changes, consent updates, and cases in one dated list.",
        ],
      },
    ],
  },
  {
    heading: "Cases (service requests)",
    blurb: "Cases track questions, complaints, and requests from members.",
    tasks: [
      {
        task: "Open and work a case",
        steps: [
          "Go to Cases → New Case, choose a member (optional), category, and priority.",
          "Move it through the workflow as you work: Open → In Progress → Resolved → Closed.",
          "Assign it to a colleague and add a resolution note when you close it.",
        ],
      },
    ],
  },
  {
    heading: "Orders & receipt scanning",
    blurb: "Scan a paper receipt to check it against an order — no typing.",
    tasks: [
      {
        task: "Scan a receipt",
        steps: [
          "Open an Order and choose Scan Receipt.",
          "Upload or photograph the receipt — it's read in your browser (Thai + English), free, no upload to any server.",
          "Review the matched lines: OK, quantity differs, price differs, not in order, or other brand.",
        ],
      },
    ],
  },
  {
    heading: "Loyalty & AI Insights (view)",
    blurb: "See the rewards catalog, the points ledger, and system suggestions.",
    tasks: [
      {
        task: "Browse rewards and the ledger",
        steps: [
          "Open Loyalty to see outstanding points, the tier ladder, the rewards catalog, and recent points activity.",
        ],
      },
      {
        task: "Read AI Insights",
        steps: [
          "Open AI Insights to see flagged risks and opportunities (churn risk, consent gaps, stock alerts, and more), grouped by severity.",
          "Dismiss ones you've handled.",
        ],
      },
    ],
  },
];

const PIC_EXTRA: GuideSection[] = [
  {
    heading: "My Department (Person In Charge)",
    blurb: "If you're the PIC of a department, you get an extra back-office area.",
    tasks: [
      {
        task: "Manage your department settings",
        steps: [
          "Open My Department from the left menu (only visible if you're a PIC).",
          "Each department you own shows a settings card you can update.",
          "Not a PIC yet but should be? Ask an administrator to assign you.",
        ],
      },
    ],
  },
];

const ADMIN_EXTRA: GuideSection[] = [
  {
    heading: "Loyalty administration",
    blurb: "Admins shape the loyalty program itself.",
    tasks: [
      {
        task: "Manage rewards and tiers",
        steps: [
          "Open Loyalty. Use the reward form to add rewards and the toggle to activate/deactivate them.",
          "Review the tier ladder — tiers are earned by lifetime points (Bronze, Silver, Gold) and set each member's earn multiplier.",
        ],
      },
    ],
  },
  {
    heading: "AI Insights, Products & Channel",
    blurb: "Keep the data and alerts fresh.",
    tasks: [
      {
        task: "Regenerate AI Insights",
        steps: [
          "Open AI Insights and click Regenerate to re-run the rules against the latest data.",
        ],
      },
      {
        task: "Edit products and stock rules",
        steps: [
          "Open Products to edit catalog items, including each product's reorder point (the stock level that triggers a reorder alert).",
        ],
      },
      {
        task: "Manage dealers and channel stock",
        steps: [
          "Open Sales & Channel to manage dealers/retailers, link them to member accounts, and review sell-in / sell-out.",
          "Selling out more than a dealer holds is rejected, and low stock raises a reorder insight automatically.",
        ],
      },
    ],
  },
  {
    heading: "Setup, SQL Console & API",
    blurb: "System administration.",
    tasks: [
      {
        task: "Manage users, departments & PICs",
        steps: [
          "Open Setup to manage users, departments, and assign a Person In Charge to each department.",
        ],
      },
      {
        task: "Run ad-hoc queries",
        steps: [
          "Open SQL Console to run read queries against the demo database for reporting or troubleshooting.",
        ],
      },
      {
        task: "Integrate over the REST API",
        steps: [
          "The platform exposes a /api/v1 REST API for members, transactions, loyalty, consent, cases, channel, and insights.",
          "Requests authenticate with a signed-in session or a bearer API key configured in the server environment.",
        ],
        tip: "API keys are secrets — keep them in the server environment, never in the app or in shared links.",
      },
    ],
  },
];

const ROLE_GUIDES: RoleGuide[] = [
  {
    key: "staff",
    label: "Staff",
    tagline: "Front-line members, points, cases and receipts.",
    canDo: [
      "Find, add and manage members",
      "Record purchases and grant points instantly",
      "Redeem rewards and manage PDPA consent",
      "Open and work service cases",
      "Scan receipts against orders",
    ],
    sections: STAFF_SECTIONS,
  },
  {
    key: "pic",
    label: "Department PIC",
    tagline: "Everything Staff can do, plus your department back-office.",
    canDo: [
      "Everything a Staff member can do",
      "Manage the departments you're Person In Charge of",
    ],
    sections: [...STAFF_SECTIONS, ...PIC_EXTRA],
  },
  {
    key: "admin",
    label: "Administrator",
    tagline: "Full control of the program, data and settings.",
    canDo: [
      "Everything Staff and PICs can do",
      "Manage rewards, tiers and the rewards catalog",
      "Regenerate AI Insights and edit products/stock rules",
      "Manage dealers, users, departments and PIC assignments",
      "Use the SQL Console and the REST API",
    ],
    sections: [...STAFF_SECTIONS, ...PIC_EXTRA, ...ADMIN_EXTRA],
  },
];

export function GuideTabs({ defaultRole }: { defaultRole: RoleKey }) {
  const [active, setActive] = useState<RoleKey>(defaultRole);
  const guide = ROLE_GUIDES.find((g) => g.key === active) ?? ROLE_GUIDES[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="Guide by role"
        className="mb-4 inline-flex flex-wrap gap-1 rounded-[14px] border border-[#dde5e8] bg-white p-1"
      >
        {ROLE_GUIDES.map((g) => {
          const selected = g.key === active;
          return (
            <button
              key={g.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(g.key)}
              className={`rounded-[9px] px-4 py-1.5 text-sm font-medium transition duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                selected
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-[#607785] hover:bg-[#eef3f5]"
              }`}
            >
              {g.label}
              {g.key === defaultRole && (
                <span className={`ml-1.5 text-[10px] ${selected ? "text-white/80" : "text-[#607785]"}`}>
                  (you)
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Card className="mb-4 bg-[#f8fafb]">
        <p className="text-sm font-semibold text-[#14202b]">{guide.tagline}</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {guide.canDo.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-[#3c4f5e]">
              <span aria-hidden className="mt-0.5 text-brand-600">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {guide.sections.map((section) => (
          <Card key={section.heading}>
            <h2 className="text-sm font-bold text-[#14202b]">{section.heading}</h2>
            <p className="mt-0.5 text-xs text-[#607785]">{section.blurb}</p>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {section.tasks.map((t) => (
                <div
                  key={t.task}
                  className="rounded-[14px] border border-[#eef3f5] bg-[#f8fafb] p-3"
                >
                  <p className="text-sm font-semibold text-[#14202b]">{t.task}</p>
                  <ol className="mt-2 space-y-1.5">
                    {t.steps.map((step, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#3c4f5e]">
                        <span
                          aria-hidden
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800"
                        >
                          {i + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  {t.tip && (
                    <p className="mt-2 rounded-[9px] bg-[#fff5ec] px-2.5 py-1.5 text-xs text-[#8a4b1e]">
                      Tip: {t.tip}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
