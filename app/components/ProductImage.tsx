// Original, programmatically-drawn product packshots (no external assets).
// Each fictional brand gets a color; each category gets a package silhouette —
// presented on a warm cream tile like a food e-commerce product photo.

const BRAND_COLORS: Record<string, { main: string; dark: string }> = {
  Umeya: { main: "#ee1c26", dark: "#9c1218" },
  Sunmato: { main: "#e8590c", dark: "#a33c05" },
  VitaCharge: { main: "#14ae5c", dark: "#0b7c40" },
  GoldLeaf: { main: "#c8b27a", dark: "#8f7a45" },
  FreshPantry: { main: "#0d9488", dark: "#0a6b62" },
  NutriWell: { main: "#7c3aed", dark: "#5b21b6" },
};

const FALLBACK = { main: "#78716c", dark: "#44403c" };

function Pouch({ main, dark, initial }: { main: string; dark: string; initial: string }) {
  return (
    <>
      {/* seasoning pouch with crimped top */}
      <path d="M32 26 L88 26 L84 34 L86 96 Q86 102 80 102 L40 102 Q34 102 34 96 L36 34 Z" fill={main} />
      <path d="M32 26 L88 26 L86 31 L34 31 Z" fill={dark} />
      <rect x="42" y="52" width="36" height="30" rx="4" fill="#fffaf0" />
      <text x="60" y="74" textAnchor="middle" fontSize="20" fontFamily="serif" fill={dark}>{initial}</text>
      <path d="M42 44 L78 44" stroke="#fffaf0" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </>
  );
}

function Bottle({ main, dark, initial }: { main: string; dark: string; initial: string }) {
  return (
    <>
      {/* beverage bottle */}
      <rect x="52" y="18" width="16" height="10" rx="2" fill={dark} />
      <path d="M52 28 L68 28 L74 44 L74 96 Q74 102 68 102 L52 102 Q46 102 46 96 L46 44 Z" fill={main} />
      <rect x="50" y="54" width="20" height="26" rx="3" fill="#fffaf0" />
      <text x="60" y="73" textAnchor="middle" fontSize="16" fontFamily="serif" fill={dark}>{initial}</text>
      <path d="M50 46 Q60 42 70 46" stroke="#fffaf0" strokeWidth="2.5" fill="none" opacity="0.7" />
    </>
  );
}

function Jar({ main, dark, initial }: { main: string; dark: string; initial: string }) {
  return (
    <>
      {/* nutrition jar with wide lid */}
      <rect x="40" y="22" width="40" height="12" rx="4" fill={dark} />
      <path d="M38 34 L82 34 L82 94 Q82 102 74 102 L46 102 Q38 102 38 94 Z" fill={main} />
      <rect x="46" y="50" width="28" height="32" rx="4" fill="#fffaf0" />
      <text x="60" y="73" textAnchor="middle" fontSize="18" fontFamily="serif" fill={dark}>{initial}</text>
    </>
  );
}

function FrozenBox({ main, dark, initial }: { main: string; dark: string; initial: string }) {
  return (
    <>
      {/* frozen-food box */}
      <rect x="30" y="34" width="60" height="64" rx="4" fill={main} />
      <rect x="30" y="34" width="60" height="14" rx="4" fill={dark} />
      <rect x="40" y="58" width="40" height="26" rx="4" fill="#fffaf0" />
      <text x="60" y="77" textAnchor="middle" fontSize="17" fontFamily="serif" fill={dark}>{initial}</text>
      {/* snowflake dots */}
      <circle cx="38" cy="41" r="2" fill="#fffaf0" opacity="0.9" />
      <circle cx="46" cy="41" r="2" fill="#fffaf0" opacity="0.6" />
    </>
  );
}

function SauceBottle({ main, dark, initial }: { main: string; dark: string; initial: string }) {
  return (
    <>
      {/* slim sauce bottle */}
      <rect x="54" y="16" width="12" height="12" rx="2" fill={dark} />
      <path d="M54 28 L66 28 L70 40 L70 94 Q70 102 62 102 L58 102 Q50 102 50 94 L50 40 Z" fill={main} />
      <rect x="52" y="56" width="16" height="24" rx="3" fill="#fffaf0" />
      <text x="60" y="73" textAnchor="middle" fontSize="14" fontFamily="serif" fill={dark}>{initial}</text>
    </>
  );
}

const SHAPES: Record<
  string,
  (p: { main: string; dark: string; initial: string }) => React.ReactNode
> = {
  Seasoning: Pouch,
  Beverage: Bottle,
  "Health & Nutrition": Jar,
  "Frozen Food": FrozenBox,
  Sauce: SauceBottle,
};

export function ProductImage({
  brand,
  category,
  className = "",
}: {
  brand: string;
  category: string | null;
  className?: string;
}) {
  const colors = BRAND_COLORS[brand] ?? FALLBACK;
  const Shape = SHAPES[category ?? ""] ?? Pouch;
  const initial = brand.charAt(0);

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={`${brand} ${category ?? "product"} illustration`}
      className={className}
    >
      <rect width="120" height="120" rx="12" fill="#fff4e4" />
      <ellipse cx="60" cy="104" rx="30" ry="5" fill="#292524" opacity="0.08" />
      <Shape main={colors.main} dark={colors.dark} initial={initial} />
    </svg>
  );
}
