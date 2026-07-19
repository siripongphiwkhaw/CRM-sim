"use client";

import { useState } from "react";

export interface MonthPoint {
  month: string; // "2026-02"
  total: number;
  orders: number;
}

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

function monthLabel(m: string): string {
  const d = new Date(m + "-01T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short" });
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Single-series purchase-revenue area chart with crosshair + tooltip. */
export function PerformanceChart({ data }: { data: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[#607785]">No purchase data yet.</p>;
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const max = Math.max(...data.map((d) => d.total), 1);
  const x = (i: number) =>
    PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.total)}`).join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${PAD.top + innerH} L${x(0)},${PAD.top + innerH} Z`;

  const gridLines = [0.25, 0.5, 0.75, 1].map((f) => PAD.top + innerH - f * innerH);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Purchase revenue by month"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          let nearest = 0;
          let best = Infinity;
          data.forEach((_, i) => {
            const d = Math.abs(x(i) - px);
            if (d < best) { best = d; nearest = i; }
          });
          setHover(nearest);
        }}
      >
        {gridLines.map((gy, i) => (
          <line key={i} x1={PAD.left} x2={W - PAD.right} y1={gy} y2={gy} stroke="#ecebea" strokeWidth="1" />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH} y2={PAD.top + innerH} stroke="#c2d0d6" strokeWidth="1" />

        <path d={areaPath} fill="#12a594" opacity="0.12" />
        <path d={linePath} fill="none" stroke="#12a594" strokeWidth="2" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={d.month}>
            {hover === i && (
              <line x1={x(i)} x2={x(i)} y1={PAD.top} y2={PAD.top + innerH} stroke="#c2d0d6" strokeDasharray="3 3" />
            )}
            <circle
              cx={x(i)}
              cy={y(d.total)}
              r={hover === i ? 5 : 3.5}
              fill="#12a594"
              stroke="#fff"
              strokeWidth="2"
            />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#607785">
              {monthLabel(d.month)}
            </text>
          </g>
        ))}

        <text x={PAD.left - 8} y={PAD.top + 4} textAnchor="end" fontSize="11" fill="#607785">
          {fmtMoney(max)}
        </text>
        <text x={PAD.left - 8} y={PAD.top + innerH} textAnchor="end" fontSize="11" fill="#607785">
          ฿0
        </text>
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute rounded border border-[#dde5e8] bg-white px-3 py-2 text-xs shadow-md"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: 0,
            transform: `translateX(${hover > data.length / 2 ? "-110%" : "10%"})`,
          }}
        >
          <p className="font-semibold text-[#14202b]">{monthLabel(data[hover].month)}</p>
          <p className="text-[#3c4f5e]">{fmtMoney(data[hover].total)}</p>
          <p className="text-[#607785]">{data[hover].orders} purchases</p>
        </div>
      )}

      {/* accessible data table */}
      <table className="sr-only">
        <caption>Purchase revenue by month</caption>
        <thead>
          <tr><th>Month</th><th>Revenue</th><th>Purchases</th></tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{d.month}</td><td>{fmtMoney(d.total)}</td><td>{d.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
