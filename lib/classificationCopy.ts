import {
  BEHAVIOR_CLASSES,
  BEHAVIOR_CLASS_LABELS,
  RESOLUTION_TIERS,
  RESOLUTION_TIER_LABELS,
  type BehaviorClass,
  type ResolutionTier,
} from "./constants";
import {
  BUSINESS_MIN_FREQUENCY,
  HORECA_AOV_FLOOR,
  WHOLESALER_AOV_FLOOR,
  MIN_POPULATION_FOR_PERCENTILE,
  TRADE_CHANNEL_SHARE,
  CLASSIFY_WINDOW_DAYS,
  type ClassificationReason,
  type ReasonCode,
} from "./classification";
import { formatCurrency } from "./format";

/**
 * Bilingual copy for everything that explains customer classification.
 *
 * One module serves both surfaces — the reference page at
 * /guide/classification and the per-customer "why this class" panel — so the
 * two can never drift into telling different stories.
 *
 * Three rules hold this file together:
 *
 *  1. ENGLISH IS DERIVED, NEVER RETYPED. The `.en` half of every label is
 *     defined as the existing constant in lib/constants.ts. Retyping the
 *     strings here would create a second source of truth that silently rots
 *     the first time someone edits a label. And we do NOT widen the maps in
 *     constants.ts to {en,th} instead: that file is imported by proxy.ts, so
 *     it is in the middleware bundle, and ~15 English-only call sites read
 *     those maps today.
 *
 *  2. THRESHOLDS ARE IMPORTED, NEVER TYPED AS LITERALS. Every number shown to
 *     a user is computed from the real exported constant. Hardcoding "฿8,000"
 *     into copy is exactly how a page ships confidently wrong six months
 *     after someone tunes the floor.
 *
 *  3. NO CLAIM THE ENGINE CANNOT SUPPORT. See REASON_META.weight and the
 *     tier caveats — several signals that look decisive are not, and saying
 *     otherwise would be worse than saying nothing.
 */

export const LOCALES = ["en", "th"] as const;
export type Locale = (typeof LOCALES)[number];

/** A string in every supported language. Using a Record (not an optional
 * `th?`) makes a missing translation a compile error rather than a silent
 * English fallback at runtime. */
export type Localized = Record<Locale, string>;

/* -------------------------------------------------------------------------- *
 * Formatting
 * -------------------------------------------------------------------------- */

export interface Fmt {
  money(n: number): string;
  pct(fraction: number): string;
  int(n: number): string;
  plural(n: number, one: string, many: string): string;
}

/**
 * Currency is th-TH/THB in BOTH languages — `฿4,210`. That is correct Thai and
 * correct English-in-Thailand; switching to en-US would render `THB 4,210`,
 * which is worse in both. Deliberately NOT using the `th-TH-u-nu-thai`
 * numbering system: it produces Thai numerals (๔,๒๑๐), which nobody wants to
 * read financial figures in.
 */
export function fmtFor(locale: Locale): Fmt {
  const enPlural = new Intl.PluralRules("en");
  return {
    money: (n) => formatCurrency(Math.round(n)),
    pct: (fraction) => `${Math.round(fraction * 100)}%`,
    int: (n) => n.toLocaleString(locale === "th" ? "th-TH" : "en-US"),
    // Thai has no grammatical plural, so it always takes the singular form.
    // Keeping this in Fmt rather than inline stops the Thai renderers from
    // accidentally inheriting English pluralisation.
    plural: (n, one, many) => (locale === "th" ? one : enPlural.select(n) === "one" ? one : many),
  };
}

/* -------------------------------------------------------------------------- *
 * Class + tier labels (English derived from lib/constants.ts)
 * -------------------------------------------------------------------------- */

const BEHAVIOR_CLASS_TH: Record<BehaviorClass, string> = {
  CONSUMER: "ผู้บริโภค",
  HORECA: "โฮเรก้า (ร้านอาหาร โรงแรม คาเฟ่)",
  TRADITIONAL_TRADE: "ร้านค้าดั้งเดิม",
  MODERN_TRADE: "โมเดิร์นเทรด",
  WHOLESALER: "ผู้ค้าส่ง",
  INSTITUTIONAL: "องค์กรและหน่วยงาน",
};

export const BEHAVIOR_CLASS_LABEL = Object.fromEntries(
  BEHAVIOR_CLASSES.map((c) => [c, { en: BEHAVIOR_CLASS_LABELS[c], th: BEHAVIOR_CLASS_TH[c] }])
) as Record<BehaviorClass, Localized>;

const RESOLUTION_TIER_TH: Record<ResolutionTier, string> = {
  VERIFIED: "ยืนยันตัวตน (เลขผู้เสียภาษี)",
  ANCHORED: "ผูกทะเบียน (ทะเบียนตัวแทนจำหน่าย)",
  INFERRED: "อนุมานจากพฤติกรรม",
  DEFAULT: "ยังจัดประเภทไม่ได้",
};

export const RESOLUTION_TIER_LABEL = Object.fromEntries(
  RESOLUTION_TIERS.map((t) => [t, { en: RESOLUTION_TIER_LABELS[t], th: RESOLUTION_TIER_TH[t] }])
) as Record<ResolutionTier, Localized>;

/**
 * The staff INSTITUTIONAL override is stored with resolution_tier = 'ANCHORED'
 * because there is no "manual" tier value. Rendering the plain ANCHORED label
 * for it tells the user "Anchored (dealer record)" about a customer who has no
 * dealer record — which is simply false. Any surface showing a tier must run
 * it through tierLabelFor().
 */
export const STAFF_SET_LABEL: Localized = {
  en: "Set by staff",
  th: "กำหนดโดยทีมงาน",
};

export function tierLabelFor(
  tier: ResolutionTier | null,
  behaviorClass: BehaviorClass | null,
  locale: Locale
): string {
  if (!tier) return "—";
  if (tier === "ANCHORED" && behaviorClass === "INSTITUTIONAL") return STAFF_SET_LABEL[locale];
  return RESOLUTION_TIER_LABEL[tier][locale];
}

/* -------------------------------------------------------------------------- *
 * Reason rendering
 * -------------------------------------------------------------------------- */

/**
 * How much a reason actually contributed.
 *
 *   decisive     this is why the class is what it is
 *   supporting   consistent with the verdict, but did NOT cause it. Pack size
 *                and weekday share live here: the classifier pushes them
 *                *inside a HoReCa branch it has already taken*, so no value of
 *                either can change a class.
 *   context      a condition of the run, not evidence about the customer
 *   conflict     the reason this customer was flagged for review
 */
export type ReasonWeight = "decisive" | "supporting" | "context" | "conflict";

export const REASON_META: Record<ReasonCode, { weight: ReasonWeight }> = {
  TOO_FEW_ORDERS: { weight: "decisive" },
  AOV_BELOW_PEER_P75: { weight: "decisive" },
  PEER_RANKING_OFF: { weight: "context" },
  AOV_CLEARS_WHOLESALER_FLOOR: { weight: "decisive" },
  TRADE_CHANNEL_SHARE_HIGH: { weight: "decisive" },
  AOV_CLEARS_HORECA_FLOOR: { weight: "decisive" },
  BULK_PACK_FORMATS: { weight: "supporting" },
  WEEKDAY_CONCENTRATION: { weight: "supporting" },
  AOV_BELOW_ALL_FLOORS: { weight: "decisive" },
  STAFF_INSTITUTIONAL_OVERRIDE: { weight: "decisive" },
  DEALER_ANCHOR: { weight: "decisive" },
  ANCHOR_BEHAVIOUR_DISAGREE: { weight: "conflict" },
  JURISTIC_TAX_ID: { weight: "context" },
  JURISTIC_BUT_CONSUMER: { weight: "conflict" },
};

type Renderers = {
  [C in ReasonCode]: (
    params: Extract<ClassificationReason, { code: C }>["params"],
    f: Fmt,
    locale: Locale
  ) => string;
};

/**
 * Typed so that adding a reason code to the union in lib/classification.ts
 * fails the build here until BOTH languages are written. That exhaustiveness
 * is the whole reason for the discriminated union.
 *
 * Free-text params (dealerType, channel) come from `distributors` as
 * unvalidated TEXT and are rendered verbatim in both languages on purpose —
 * that is what makes a mistyped channel visible to staff instead of silently
 * becoming Traditional trade.
 */
const RENDERERS: Record<Locale, Renderers> = {
  en: {
    TOO_FEW_ORDERS: (p, f) =>
      `Only ${f.int(p.frequency)} ${f.plural(p.frequency, "order", "orders")} in the last ${p.windowDays} days — fewer than the ${f.int(p.minFrequency)} needed before order size is read as a pattern.`,
    AOV_BELOW_PEER_P75: (p, f) =>
      `Average order ${f.money(p.aov)} sits below the ${f.money(p.aovP75)} mark that separates the top quarter of active customers.`,
    PEER_RANKING_OFF: (p, f) =>
      `Peer comparison was off: only ${f.int(p.population)} ${f.plural(p.population, "customer", "customers")} had any activity in the last ${p.windowDays} days, and ${f.int(p.minPopulation)} are needed to rank against. Absolute thresholds alone decided this.`,
    AOV_CLEARS_WHOLESALER_FLOOR: (p, f) =>
      `Average order ${f.money(p.aov)} clears the wholesaler threshold of ${f.money(p.floor)}.`,
    TRADE_CHANNEL_SHARE_HIGH: (p, f) =>
      `${f.pct(p.sfaShare)} of orders came through the trade channel, at or above the ${f.pct(p.threshold)} mark, on a declared B2B account.`,
    AOV_CLEARS_HORECA_FLOOR: (p, f) =>
      `Average order ${f.money(p.aov)} clears the food-service threshold of ${f.money(p.floor)}, while buying mostly on consumer channels.`,
    BULK_PACK_FORMATS: (p, f) => `Buys bulk formats — largest pack size ${f.int(p.maxPackSize)}.`,
    WEEKDAY_CONCENTRATION: (p, f) => `${f.pct(p.weekdayShare)} of orders fall on weekdays.`,
    AOV_BELOW_ALL_FLOORS: (p, f) =>
      `Average order ${f.money(p.aov)} is below every business threshold — ${f.money(p.horecaFloor)} for food service, ${f.money(p.wholesalerFloor)} for wholesale.`,
    STAFF_INSTITUTIONAL_OVERRIDE: () =>
      `A staff member set this account to Institutional. That decision outranks every automatic signal.`,
    DEALER_ANCHOR: (p) =>
      `Linked to a dealer record: ${p.dealerType}${p.channel ? ` · ${p.channel}` : ""}. A dealer record states the trade class outright, so buying behaviour was not needed to decide it.`,
    ANCHOR_BEHAVIOUR_DISAGREE: (p, _f, locale) =>
      `Buying behaviour on its own would read as ${BEHAVIOR_CLASS_LABEL[p.inferredClass][locale]}. The dealer record stands; this is flagged for a person to check.`,
    JURISTIC_TAX_ID: () =>
      `A corporate tax ID is on file, confirming this is a registered company. It does not say what kind of business — so the class below still comes from buying behaviour.`,
    JURISTIC_BUT_CONSUMER: () =>
      `Registered as a company, but buying like a consumer. Flagged for a person to check — this often means a second account holds the real volume.`,
  },
  th: {
    TOO_FEW_ORDERS: (p, f) =>
      `มีเพียง ${f.int(p.frequency)} บิลในช่วง ${p.windowDays} วันที่ผ่านมา ซึ่งน้อยกว่า ${f.int(p.minFrequency)} บิลที่ต้องมีก่อน ระบบจึงจะถือว่าขนาดการสั่งซื้อเป็นรูปแบบที่เชื่อถือได้`,
    AOV_BELOW_PEER_P75: (p, f) =>
      `ยอดเฉลี่ยต่อบิล ${f.money(p.aov)} ต่ำกว่าเส้น ${f.money(p.aovP75)} ซึ่งเป็นเส้นแบ่งลูกค้ากลุ่มบนสุดหนึ่งในสี่ที่ยังซื้อขายอยู่`,
    PEER_RANKING_OFF: (p, f) =>
      `ยังไม่ได้เทียบกับลูกค้ารายอื่น เพราะในช่วง ${p.windowDays} วันที่ผ่านมามีลูกค้าที่เคลื่อนไหวเพียง ${f.int(p.population)} ราย แต่ต้องมีอย่างน้อย ${f.int(p.minPopulation)} รายจึงจะเทียบกันได้ ครั้งนี้จึงตัดสินด้วยเกณฑ์ขั้นต่ำเพียงอย่างเดียว`,
    AOV_CLEARS_WHOLESALER_FLOOR: (p, f) =>
      `ยอดเฉลี่ยต่อบิล ${f.money(p.aov)} ผ่านเกณฑ์ผู้ค้าส่งที่ ${f.money(p.floor)}`,
    TRADE_CHANNEL_SHARE_HIGH: (p, f) =>
      `มีการสั่งซื้อผ่านช่องทางการค้า ${f.pct(p.sfaShare)} ของทั้งหมด ซึ่งถึงเกณฑ์ ${f.pct(p.threshold)} และบัญชีนี้แจ้งไว้เป็นแบบ B2B`,
    AOV_CLEARS_HORECA_FLOOR: (p, f) =>
      `ยอดเฉลี่ยต่อบิล ${f.money(p.aov)} ผ่านเกณฑ์ร้านอาหารที่ ${f.money(p.floor)} ทั้งที่ส่วนใหญ่สั่งผ่านช่องทางผู้บริโภค`,
    BULK_PACK_FORMATS: (p, f) => `ซื้อขนาดบรรจุใหญ่ โดยขนาดใหญ่ที่สุดที่ซื้อคือ ${f.int(p.maxPackSize)}`,
    WEEKDAY_CONCENTRATION: (p, f) => `${f.pct(p.weekdayShare)} ของบิลทั้งหมดเกิดขึ้นในวันธรรมดา`,
    AOV_BELOW_ALL_FLOORS: (p, f) =>
      `ยอดเฉลี่ยต่อบิล ${f.money(p.aov)} ต่ำกว่าเกณฑ์ธุรกิจทุกข้อ คือ ${f.money(p.horecaFloor)} สำหรับร้านอาหาร และ ${f.money(p.wholesalerFloor)} สำหรับผู้ค้าส่ง`,
    STAFF_INSTITUTIONAL_OVERRIDE: () =>
      `ทีมงานกำหนดบัญชีนี้เป็นองค์กรและหน่วยงานด้วยตนเอง การกำหนดด้วยคนมีน้ำหนักเหนือสัญญาณอัตโนมัติทุกอย่าง`,
    DEALER_ANCHOR: (p) =>
      `ผูกกับทะเบียนตัวแทนจำหน่าย: ${p.dealerType}${p.channel ? ` · ${p.channel}` : ""} ทะเบียนตัวแทนระบุประเภททางการค้าไว้ตรง ๆ อยู่แล้ว จึงไม่ต้องใช้พฤติกรรมการซื้อมาตัดสิน`,
    ANCHOR_BEHAVIOUR_DISAGREE: (p, _f, locale) =>
      `ถ้าดูจากพฤติกรรมการซื้ออย่างเดียว จะอ่านได้ว่าเป็น ${BEHAVIOR_CLASS_LABEL[p.inferredClass][locale]} ระบบยังยึดตามทะเบียนตัวแทนไว้ก่อน และตั้งธงให้คนเข้ามาตรวจสอบ`,
    JURISTIC_TAX_ID: () =>
      `มีเลขประจำตัวผู้เสียภาษีของนิติบุคคลอยู่ในระบบ ยืนยันได้ว่าเป็นบริษัทที่จดทะเบียนจริง แต่ไม่ได้บอกว่าเป็นธุรกิจประเภทไหน ประเภทด้านล่างจึงยังมาจากพฤติกรรมการซื้อ`,
    JURISTIC_BUT_CONSUMER: () =>
      `จดทะเบียนเป็นบริษัท แต่ซื้อเหมือนผู้บริโภคทั่วไป จึงตั้งธงให้คนเข้ามาตรวจสอบ กรณีแบบนี้มักแปลว่ายอดซื้อจริงไปอยู่อีกบัญชีหนึ่ง`,
  },
};

/** Renders one reason. The cast is safe by construction: RENDERERS is keyed by
 * the same union that produced `reason`, so the params always match. */
export function renderReason(reason: ClassificationReason, locale: Locale): string {
  const render = RENDERERS[locale][reason.code] as (
    params: ClassificationReason["params"],
    f: Fmt,
    locale: Locale
  ) => string;
  return render(reason.params, fmtFor(locale), locale);
}

/**
 * Total parse — never throws, never trusts the column.
 *
 * Every existing row is NULL until the first recompute after the migration,
 * and a row written before the (code, params) refactor would hold an array of
 * plain strings. Both must degrade to "no trace available" so the UI can show
 * its honest empty state rather than inventing evidence.
 */
export function parseReasons(raw: string | null | undefined): ClassificationReason[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (r): r is ClassificationReason =>
      typeof r === "object" &&
      r !== null &&
      typeof (r as { code?: unknown }).code === "string" &&
      (r as { code: string }).code in REASON_META
  );
}

export function reasonsByWeight(
  reasons: ClassificationReason[],
  weight: ReasonWeight
): ClassificationReason[] {
  return reasons.filter((r) => REASON_META[r.code].weight === weight);
}

/* -------------------------------------------------------------------------- *
 * Thresholds — computed from the live constants, never retyped
 * -------------------------------------------------------------------------- */

export interface ThresholdRow {
  name: Localized;
  /** Pre-formatted from the imported constant. */
  value: string;
  /** The symbol name in the source, so a reader can go verify it. */
  constant: string;
  effect: Localized;
}

export const THRESHOLDS: ThresholdRow[] = [
  {
    name: { en: "Judging window", th: "ช่วงเวลาที่ใช้ตัดสิน" },
    value: `${CLASSIFY_WINDOW_DAYS} days`,
    constant: "CLASSIFY_WINDOW_DAYS",
    effect: {
      en: "Only orders inside this window are used to classify. Loyalty value, churn risk and channel affinity deliberately use all-time figures instead.",
      th: `ใช้เฉพาะบิลที่อยู่ในช่วง ${CLASSIFY_WINDOW_DAYS} วันนี้ในการจัดประเภท ส่วนมูลค่าลูกค้า ความเสี่ยงเลิกซื้อ และช่องทางหลัก ตั้งใจให้ใช้ตัวเลขตลอดอายุลูกค้าแทน`,
    },
  },
  {
    name: { en: "Minimum orders", th: "จำนวนบิลขั้นต่ำ" },
    value: `${BUSINESS_MIN_FREQUENCY}`,
    constant: "BUSINESS_MIN_FREQUENCY",
    effect: {
      en: "Below this, order size is treated as a one-off rather than a pattern, and the customer stays a Consumer.",
      th: "ถ้าน้อยกว่านี้ ระบบถือว่าขนาดการสั่งซื้อเป็นเหตุบังเอิญ ไม่ใช่รูปแบบที่แน่นอน และจะยังเป็นผู้บริโภคต่อไป",
    },
  },
  {
    name: { en: "Food-service threshold", th: "เกณฑ์ร้านอาหาร" },
    value: formatCurrency(HORECA_AOV_FLOOR),
    constant: "HORECA_AOV_FLOOR",
    effect: {
      en: "Average order at or above this, bought mostly on consumer channels, reads as food service.",
      th: "ถ้ายอดเฉลี่ยต่อบิลถึงเกณฑ์นี้ และซื้อผ่านช่องทางผู้บริโภคเป็นหลัก จะอ่านว่าเป็นร้านอาหาร",
    },
  },
  {
    name: { en: "Wholesale threshold", th: "เกณฑ์ผู้ค้าส่ง" },
    value: formatCurrency(WHOLESALER_AOV_FLOOR),
    constant: "WHOLESALER_AOV_FLOOR",
    effect: {
      en: "Average order at or above this reads as wholesale, whichever channel it came through.",
      th: "ถ้ายอดเฉลี่ยต่อบิลถึงเกณฑ์นี้ จะอ่านว่าเป็นผู้ค้าส่ง ไม่ว่าจะซื้อผ่านช่องทางไหน",
    },
  },
  {
    name: { en: "Trade-channel share", th: "สัดส่วนช่องทางการค้า" },
    value: `${Math.round(TRADE_CHANNEL_SHARE * 100)}%`,
    constant: "TRADE_CHANNEL_SHARE",
    effect: {
      en: "A declared B2B account buying at least this share through the trade channel reads as wholesale even without a large average order.",
      th: "บัญชีที่แจ้งไว้เป็น B2B และซื้อผ่านช่องทางการค้าอย่างน้อยเท่านี้ จะอ่านว่าเป็นผู้ค้าส่ง แม้ยอดเฉลี่ยต่อบิลจะไม่สูงก็ตาม",
    },
  },
  {
    name: { en: "Peer comparison minimum", th: "จำนวนขั้นต่ำสำหรับเทียบกับลูกค้ารายอื่น" },
    value: `${MIN_POPULATION_FOR_PERCENTILE}`,
    constant: "MIN_POPULATION_FOR_PERCENTILE",
    effect: {
      en: "Peer ranking only runs once at least this many customers were active in the window. Below it, ranking is switched off entirely and the absolute thresholds decide alone.",
      th: "ระบบจะเทียบกับลูกค้ารายอื่นก็ต่อเมื่อมีลูกค้าเคลื่อนไหวในช่วงเวลานี้อย่างน้อยเท่านี้ ถ้าน้อยกว่านั้นจะปิดการเทียบทั้งหมด แล้วให้เกณฑ์ขั้นต่ำตัดสินเพียงอย่างเดียว",
    },
  },
];

/* -------------------------------------------------------------------------- *
 * Tiers
 * -------------------------------------------------------------------------- */

export interface TierCopy {
  /** 1-4, the order the engine actually evaluates them in. */
  order: number;
  tier: ResolutionTier;
  name: Localized;
  /** What actually triggers this tier. */
  trigger: Localized;
  /** Who has to do something for this tier to apply. */
  whoActs: Localized;
  /** What it legitimately proves. */
  proves: Localized;
  /** What it does NOT prove. The most important field in this file. */
  caveat: Localized;
}

/**
 * Ordered by real execution order in classifyCustomer(), which is NOT the
 * "Tier 1 / Tier 2" numbering used elsewhere in the UI — the dealer anchor is
 * checked before the tax ID. The staff override is listed first because it
 * short-circuits everything.
 */
export const TIER_COPY: TierCopy[] = [
  {
    order: 1,
    tier: "ANCHORED",
    name: { en: "Staff override", th: "การกำหนดโดยทีมงาน" },
    trigger: {
      en: "Someone marked the account Institutional by hand.",
      th: "มีคนกำหนดบัญชีนี้เป็นองค์กรและหน่วยงานด้วยมือ",
    },
    whoActs: { en: "Staff", th: "ทีมงาน" },
    proves: {
      en: "A person made a judgement the data cannot make. Nothing overrides it and it is never flagged for review.",
      th: "คนเป็นผู้ตัดสินในสิ่งที่ข้อมูลตัดสินแทนไม่ได้ ไม่มีอะไรมาเขียนทับ และจะไม่ถูกตั้งธงให้ตรวจสอบ",
    },
    caveat: {
      en: "Institutional is the only class here. It is stored against the Anchored tier because there is no separate manual tier — so it can look like a dealer record if a screen does not special-case it.",
      th: "ชั้นนี้ใช้ได้กับประเภทองค์กรและหน่วยงานเท่านั้น และถูกบันทึกไว้ในชั้นผูกทะเบียน เพราะระบบไม่มีชั้น “กำหนดด้วยมือ” แยกต่างหาก หน้าจอที่ไม่ได้แยกกรณีนี้จึงอาจแสดงผลเหมือนว่ามีทะเบียนตัวแทน",
    },
  },
  {
    order: 2,
    tier: "ANCHORED",
    name: { en: "Dealer record", th: "ทะเบียนตัวแทนจำหน่าย" },
    trigger: {
      en: "The customer is linked to a distributor record.",
      th: "ลูกค้าถูกผูกเข้ากับทะเบียนตัวแทนจำหน่าย",
    },
    whoActs: { en: "Staff", th: "ทีมงาน" },
    proves: {
      en: "The trade class outright. This is checked before the tax ID, and it decides the class on its own — buying behaviour is not consulted.",
      th: "ระบุประเภททางการค้าได้ตรง ๆ ชั้นนี้ถูกตรวจก่อนเลขผู้เสียภาษี และตัดสินประเภทได้ด้วยตัวเอง โดยไม่ต้องดูพฤติกรรมการซื้อ",
    },
    caveat: {
      en: "The channel field is free text with no validation, and anything unrecognised falls through to Traditional trade. A typo therefore lands the customer in the wrong class silently.",
      th: "ช่องช่องทางเป็นข้อความอิสระที่ไม่มีการตรวจสอบ ค่าที่ระบบไม่รู้จักจะตกไปเป็นร้านค้าดั้งเดิมทั้งหมด การพิมพ์ผิดจึงทำให้ลูกค้าเข้าประเภทผิดไปเงียบ ๆ",
    },
  },
  {
    order: 3,
    tier: "VERIFIED",
    name: { en: "Corporate tax ID", th: "เลขผู้เสียภาษีนิติบุคคล" },
    trigger: {
      en: "A validated corporate tax ID is on file.",
      th: "มีเลขผู้เสียภาษีของนิติบุคคลที่ตรวจสอบแล้วอยู่ในระบบ",
    },
    whoActs: { en: "Customer provides, staff records", th: "ลูกค้าให้ข้อมูล ทีมงานบันทึก" },
    proves: {
      en: "That the customer is a registered company. It raises how much we trust the record.",
      th: "พิสูจน์ว่าลูกค้าเป็นนิติบุคคลที่จดทะเบียนจริง และทำให้ข้อมูลชุดนี้น่าเชื่อถือขึ้น",
    },
    caveat: {
      en: "It never sets the class. A registered company can be a wholesaler or a one-person consultancy, so the class still comes from buying behaviour. A personal ID has no effect on classification at all.",
      th: "แต่ไม่เคยกำหนดประเภทเอง เพราะบริษัทที่จดทะเบียนอาจเป็นผู้ค้าส่ง หรือเป็นบริษัทที่ปรึกษาพนักงานคนเดียวก็ได้ ประเภทจึงยังมาจากพฤติกรรมการซื้อ ส่วนเลขบัตรประชาชนบุคคลธรรมดาไม่มีผลต่อการจัดประเภทเลย",
    },
  },
  {
    order: 4,
    tier: "INFERRED",
    name: { en: "Buying behaviour", th: "พฤติกรรมการซื้อ" },
    trigger: {
      en: "No dealer record and no corporate tax ID — so the orders themselves decide.",
      th: "ไม่มีทะเบียนตัวแทน และไม่มีเลขผู้เสียภาษีนิติบุคคล ระบบจึงให้ประวัติการซื้อเป็นผู้ตัดสิน",
    },
    whoActs: { en: "Nobody — automatic", th: "ไม่ต้องมีใครทำ ระบบทำเอง" },
    proves: {
      en: "That order size and channel mix look like a business. Thresholds are set deliberately high, so a Consumer result usually means the system working correctly.",
      th: "บอกได้ว่าขนาดการสั่งซื้อและช่องทางที่ใช้ดูเหมือนผู้ซื้อเชิงธุรกิจ เกณฑ์ถูกตั้งให้ผ่านยากตั้งใจ ผลที่ออกมาเป็นผู้บริโภคจึงมักแปลว่าระบบทำงานถูกต้อง",
    },
    caveat: {
      en: "It can only ever produce Consumer, Food service or Wholesale. Traditional trade and Modern trade are unreachable here — nothing in order history separates a corner shop from a supermarket chain, so guessing would be fabrication.",
      th: "ชั้นนี้ให้ผลได้เพียงผู้บริโภค ร้านอาหาร หรือผู้ค้าส่งเท่านั้น ไม่มีทางได้ร้านค้าดั้งเดิมหรือโมเดิร์นเทรด เพราะไม่มีอะไรในประวัติการซื้อที่แยกร้านโชห่วยออกจากเชนซูเปอร์มาร์เก็ตได้ การเดาจึงเท่ากับแต่งข้อมูลขึ้นมา",
    },
  },
  {
    order: 5,
    tier: "DEFAULT",
    name: { en: "Fell through to Consumer", th: "ตกมาเป็นผู้บริโภค" },
    trigger: {
      en: "Behaviour ran but did not clear any business threshold.",
      th: "ระบบดูพฤติกรรมแล้ว แต่ไม่ผ่านเกณฑ์ธุรกิจข้อใดเลย",
    },
    whoActs: { en: "Nobody — automatic", th: "ไม่ต้องมีใครทำ ระบบทำเอง" },
    proves: {
      en: "That on the evidence available, this reads as an ordinary shopper. For most of the customer base that is the correct answer.",
      th: "บอกได้ว่าจากหลักฐานที่มี ลูกค้ารายนี้อ่านได้ว่าเป็นผู้ซื้อทั่วไป และสำหรับลูกค้าส่วนใหญ่ นี่คือคำตอบที่ถูกต้อง",
    },
    caveat: {
      en: "This is not the same as having no data. A customer with forty small orders lands here too. The label reads Unclassified, but the reasons say which case it actually was.",
      th: "ไม่ได้แปลว่าไม่มีข้อมูล ลูกค้าที่มีสี่สิบบิลแต่ยอดต่อบิลน้อยก็มาอยู่ตรงนี้เหมือนกัน ป้ายกำกับเขียนว่ายังจัดประเภทไม่ได้ แต่เหตุผลด้านล่างจะบอกว่าจริง ๆ แล้วเป็นกรณีไหน",
    },
  },
];

/* -------------------------------------------------------------------------- *
 * Classes
 * -------------------------------------------------------------------------- */

export interface ClassCopy {
  klass: BehaviorClass;
  who: Localized;
  inData: Localized;
  commercialEffect: Localized;
  /** Human-readable statement of which tiers can actually produce this class. */
  reachability: Localized;
}

export const CLASS_COPY: Record<BehaviorClass, ClassCopy> = {
  CONSUMER: {
    klass: "CONSUMER",
    who: {
      en: "A household shopper buying to eat or use at home.",
      th: "ลูกค้าครัวเรือน ซื้อไปกินไปใช้ที่บ้าน",
    },
    inData: {
      en: "Smaller baskets, irregular timing, usually one channel.",
      th: "ยอดต่อบิลไม่สูง ความถี่ไม่แน่นอน ส่วนใหญ่ซื้อช่องทางเดียว",
    },
    commercialEffect: {
      en: "Retail pricing, loyalty points, consumer promotions. This is the default and the right answer for most of the base.",
      th: "ใช้ราคาขายปลีก สะสมแต้ม และโปรโมชั่นผู้บริโภค เป็นค่าตั้งต้นของระบบ และเป็นคำตอบที่ถูกต้องสำหรับลูกค้าส่วนใหญ่",
    },
    reachability: {
      en: "From buying behaviour, or alongside a corporate tax ID.",
      th: "มาจากพฤติกรรมการซื้อ หรือมาพร้อมกับเลขผู้เสียภาษีนิติบุคคล",
    },
  },
  HORECA: {
    klass: "HORECA",
    who: {
      en: "Hotels, restaurants and cafés — the three words behind HORECA — plus street vendors, caterers and central kitchens. All buy to cook and resell.",
      th: "โรงแรม ร้านอาหาร คาเฟ่ (สามคำนี้รวมกันเป็นคำว่า HORECA) รวมถึงร้านริมทาง ผู้รับจัดเลี้ยง และครัวกลาง ทั้งหมดซื้อไปปรุงแล้วขายต่อ",
    },
    inData: {
      en: "Business-sized orders placed through consumer channels. This is the margin leak the engine exists to catch.",
      th: "ยอดต่อบิลใหญ่ระดับธุรกิจ แต่สั่งผ่านช่องทางผู้บริโภค นี่คือรอยรั่วของกำไรที่ระบบถูกสร้างมาเพื่อจับ",
    },
    commercialEffect: {
      en: "Food-service pricing, larger pack formats, an owner on the trade team. Left as Consumer, they quietly draw retail promotions.",
      th: "ได้ราคาสำหรับร้านอาหาร ขนาดบรรจุใหญ่ขึ้น และมีผู้ดูแลจากทีมการค้า ถ้าปล่อยไว้เป็นผู้บริโภค ก็เท่ากับปล่อยให้ดูดโปรโมชั่นค้าปลีกไปเงียบ ๆ",
    },
    reachability: {
      en: "From a dealer record on the Food Service channel, or from buying behaviour.",
      th: "มาจากทะเบียนตัวแทนในช่องทาง Food Service หรือมาจากพฤติกรรมการซื้อ",
    },
  },
  TRADITIONAL_TRADE: {
    klass: "TRADITIONAL_TRADE",
    who: {
      en: "Corner shops, grocers and market stalls that take stock by the case and resell it.",
      th: "ร้านโชห่วย ร้านชำ และแผงตลาดสด ที่รับสินค้าไปขายต่อทั้งแพ็ก",
    },
    inData: {
      en: "Only ever from a dealer record — purchase history alone cannot tell a corner shop from a chain.",
      th: "เกิดขึ้นได้จากทะเบียนตัวแทนจำหน่ายเท่านั้น เพราะดูจากประวัติการซื้ออย่างเดียว แยกร้านโชห่วยออกจากเชนไม่ได้",
    },
    commercialEffect: {
      en: "Trade terms, van-route planning, visit frequency.",
      th: "ได้เงื่อนไขการค้า การวางแผนเส้นทางรถขาย และความถี่ในการเข้าพบ",
    },
    reachability: {
      en: "Dealer record only. Also the fallback for any unrecognised dealer channel.",
      th: "มาจากทะเบียนตัวแทนเท่านั้น และยังเป็นค่าที่รองรับช่องทางตัวแทนที่ระบบไม่รู้จักด้วย",
    },
  },
  MODERN_TRADE: {
    klass: "MODERN_TRADE",
    who: {
      en: "Supermarkets, hypermarkets and convenience chains buying centrally for many branches.",
      th: "ซูเปอร์มาร์เก็ต ไฮเปอร์มาร์เก็ต และร้านสะดวกซื้อ ที่สั่งซื้อรวมศูนย์เพื่อกระจายไปหลายสาขา",
    },
    inData: {
      en: "Only ever from a dealer record, for the same reason as Traditional trade.",
      th: "เกิดขึ้นได้จากทะเบียนตัวแทนเท่านั้น ด้วยเหตุผลเดียวกับร้านค้าดั้งเดิม",
    },
    commercialEffect: {
      en: "Listing fees, planograms and promotion calendars, a key-account team.",
      th: "มีค่าธรรมเนียมวางสินค้า แผนผังชั้นวางและปฏิทินโปรโมชั่น และทีมดูแลลูกค้ารายใหญ่",
    },
    reachability: {
      en: "Dealer record only — a Retailer on the Modern Trade channel.",
      th: "มาจากทะเบียนตัวแทนเท่านั้น คือประเภท Retailer ในช่องทาง Modern Trade",
    },
  },
  WHOLESALER: {
    klass: "WHOLESALER",
    who: {
      en: "Buys in volume to redistribute to other sellers rather than to end shoppers.",
      th: "ซื้อจำนวนมากเพื่อกระจายต่อให้ผู้ขายรายอื่น ไม่ได้ขายตรงถึงผู้บริโภค",
    },
    inData: {
      en: "The largest average orders in the system, or a declared B2B account buying mostly through the trade channel.",
      th: "ยอดเฉลี่ยต่อบิลสูงที่สุดในระบบ หรือเป็นบัญชีที่แจ้งไว้เป็น B2B และซื้อผ่านช่องทางการค้าเป็นหลัก",
    },
    commercialEffect: {
      en: "Volume price tiers and territory rules. Worth watching closely — a wholesaler can end up selling against our own trade channel.",
      th: "ได้ขั้นบันไดราคาตามปริมาณ และมีกติกาเรื่องเขตขาย กลุ่มนี้ต้องจับตาใกล้ที่สุด เพราะผู้ค้าส่งอาจไปขายชนกับช่องทางการค้าของเราเอง",
    },
    reachability: {
      en: "From a Dealer record, or from buying behaviour.",
      th: "มาจากทะเบียนประเภท Dealer หรือมาจากพฤติกรรมการซื้อ",
    },
  },
  INSTITUTIONAL: {
    klass: "INSTITUTIONAL",
    who: {
      en: "Schools, hospitals, factory canteens and government kitchens. They buy in volume but do not resell.",
      th: "โรงเรียน โรงพยาบาล โรงอาหารในโรงงาน และครัวหน่วยราชการ ซื้อจำนวนมากแต่ไม่ได้ขายต่อ",
    },
    inData: {
      en: "The system never guesses this one — buying in bulk on weekdays looks exactly like food service.",
      th: "ระบบไม่เดาให้ เพราะการซื้อทีละมากในวันธรรมดา หน้าตาเหมือนโฮเรก้าทุกประการ",
    },
    commercialEffect: {
      en: "Contract or tender pricing, invoicing terms, delivery scheduling.",
      th: "ใช้ราคาแบบสัญญาหรือประมูล มีเงื่อนไขการวางบิล และการจัดคิวส่งของ",
    },
    reachability: {
      en: "Staff override only. It is stored against the Anchored tier for want of a manual tier.",
      th: "มาจากการกำหนดโดยทีมงานเท่านั้น และถูกบันทึกไว้ในชั้นผูกทะเบียน เพราะไม่มีชั้นสำหรับการกำหนดด้วยมือ",
    },
  },
};

/* -------------------------------------------------------------------------- *
 * Page-level strings
 * -------------------------------------------------------------------------- */

export const UI: Record<string, Localized> = {
  pageTitle: { en: "How classification works", th: "ระบบจำแนกประเภทลูกค้าอย่างไร" },
  pageSubtitle: {
    en: "How the system decides whether a customer is a shopper or a business — and what it deliberately refuses to guess.",
    th: "ระบบตัดสินอย่างไรว่าลูกค้าเป็นผู้ซื้อทั่วไปหรือเป็นธุรกิจ และมีอะไรบ้างที่ระบบตั้งใจจะไม่เดา",
  },
  summaryHeading: { en: "The whole system in one sentence", th: "ทั้งระบบ สรุปเป็นประโยคเดียว" },
  summaryBody: {
    en: "Every customer is sorted into one of six commercial classes using the strongest evidence available about them — and when two pieces of evidence disagree, a person decides, not the software.",
    th: "ระบบจัดลูกค้าทุกรายเข้า 1 ใน 6 ประเภททางการค้า โดยเลือกใช้หลักฐานที่หนักแน่นที่สุดเท่าที่มีอยู่ และเมื่อหลักฐานสองชิ้นขัดกันเอง คนเป็นผู้ตัดสิน ไม่ใช่ระบบ",
  },
  tiersHeading: { en: "The evidence chain, in the order it runs", th: "ลำดับการตรวจหลักฐาน ตามที่ระบบทำงานจริง" },
  tiersLede: {
    en: "The system checks evidence from strongest to weakest. The first one that can answer decides the class, and everything below it is skipped. Signals are never blended or averaged.",
    th: "ระบบไล่ตรวจหลักฐานจากหนักแน่นที่สุดลงไป ชั้นไหนตอบได้ก่อน ชั้นนั้นเป็นผู้ตัดสิน แล้วข้ามชั้นที่เหลือทั้งหมด ระบบไม่เอาสัญญาณมาผสมกันและไม่หาค่าเฉลี่ย",
  },
  classesHeading: { en: "The six classes", th: "ประเภทลูกค้าทั้ง 6 แบบ" },
  thresholdsHeading: { en: "The actual numbers", th: "ตัวเลขเกณฑ์จริง" },
  thresholdsLede: {
    en: "These are read straight from the classification rules, so this table cannot drift out of date if someone tunes a threshold.",
    th: "ตัวเลขทั้งหมดนี้อ่านมาจากกฎการจำแนกจริงโดยตรง ตารางนี้จึงไม่มีทางล้าสมัย แม้จะมีการปรับเกณฑ์ในภายหลัง",
  },
  disagreementHeading: { en: "When the evidence disagrees", th: "เมื่อหลักฐานขัดแย้งกัน" },
  disagreementBody: {
    en: "Nothing is ever overwritten silently. The stronger evidence stands, the account is flagged, and a case is opened for the responsible team. Expect flags routinely — most end in no change at all. The only expensive outcome is leaving the queue unread.",
    th: "ระบบจะไม่เขียนทับอะไรเงียบ ๆ หลักฐานที่หนักแน่นกว่ายังยืนอยู่ บัญชีจะถูกตั้งธง และเปิดเคสส่งไปยังทีมที่รับผิดชอบ ให้คาดไว้เลยว่าจะมีธงขึ้นเป็นประจำ และส่วนใหญ่จะจบลงที่ไม่ต้องแก้อะไร สิ่งเดียวที่เสียหายจริงคือการปล่อยคิวตรวจสอบทิ้งไว้",
  },
  refreshHeading: { en: "When this updates", th: "ข้อมูลนี้อัปเดตเมื่อไหร่" },
  refreshBody: {
    en: "Classification is not on a schedule. It only refreshes when someone clicks “Recompute scores & insights” on the AI Insights page. A quarter with no recompute is a quarter of stale classes.",
    th: "การจำแนกประเภทไม่ได้ตั้งเวลาทำงานอัตโนมัติ จะอัปเดตก็ต่อเมื่อมีคนกดปุ่ม “Recompute scores & insights” ในหน้า AI Insights ไตรมาสไหนไม่มีใครกด ก็เท่ากับใช้ข้อมูลเก่าทั้งไตรมาส",
  },
  whyHeading: { en: "Why this class?", th: "ทำไมถึงเป็นประเภทนี้" },
  whyDecided: { en: "What decided it", th: "สิ่งที่เป็นตัวตัดสิน" },
  whySupporting: {
    en: "Consistent with this — but did not decide it",
    th: "สอดคล้องกัน แต่ไม่ใช่ตัวตัดสิน",
  },
  whyContext: { en: "Conditions of this run", th: "เงื่อนไขของการประมวลผลรอบนี้" },
  whyConflict: { en: "Why it was flagged", th: "สาเหตุที่ถูกตั้งธง" },
  whyNoTrace: {
    en: "This class was computed before evidence recording was switched on. Run “Recompute scores & insights” from AI Insights to see the reasoning.",
    th: "ประเภทนี้ถูกคำนวณก่อนที่ระบบจะเริ่มบันทึกหลักฐาน กดปุ่ม “Recompute scores & insights” ในหน้า AI Insights เพื่อดูเหตุผล",
  },
  learnMore: { en: "How classification works", th: "ระบบจำแนกอย่างไร" },
  langLabel: { en: "Language", th: "ภาษา" },
  colClass: { en: "Class", th: "ประเภท" },
  colWho: { en: "Who this actually is", th: "จริง ๆ แล้วคือใคร" },
  colInData: { en: "How it shows up in the data", th: "หน้าตาเป็นอย่างไรในข้อมูล" },
  colEffect: { en: "What changes commercially", th: "เปลี่ยนอะไรในเชิงการค้า" },
  colReach: { en: "Where it can come from", th: "มาจากหลักฐานแบบใดได้บ้าง" },
  colThreshold: { en: "Threshold", th: "เกณฑ์" },
  colValue: { en: "Value", th: "ค่า" },
  colEffectPlain: { en: "What it does", th: "มีผลอย่างไร" },
  tierTrigger: { en: "Triggered by", th: "เกิดขึ้นเมื่อ" },
  tierWhoActs: { en: "Who acts", th: "ใครต้องทำ" },
  tierProves: { en: "What it proves", th: "พิสูจน์อะไรได้" },
  tierCaveat: { en: "What it does not prove", th: "พิสูจน์อะไรไม่ได้" },
};
