import type { ExtractedReceipt } from "./receiptOcr";

/**
 * Matches OCR-extracted receipt lines against known records:
 * - order verification: lines vs a PO/SO's line items (qty + price checks)
 * - retail audit: lines vs the whole product catalog (own-item sightings)
 *
 * Pure functions — no DB access — so the logic is testable without OCR calls.
 */

export type LineMatchStatus =
  | "matched"
  | "qty_mismatch"
  | "price_mismatch"
  | "not_in_order"
  | "not_our_product";

export type ScanMatchStatus = "matched" | "partial" | "mismatched" | "unmatched";

export interface MatchCandidate {
  /** products.id */
  productId: number;
  name: string;
  sku: string;
  /** expected unit price (order snapshot or catalog price) */
  unitPrice: number;
  /** expected quantity — set for order items, undefined for catalog matching */
  quantity?: number;
}

export interface MatchedLine {
  productId: number | null;
  ocrName: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  matchStatus: LineMatchStatus;
  expectedQuantity: number | null;
  expectedPrice: number | null;
}

export interface MatchResult {
  status: ScanMatchStatus;
  lines: MatchedLine[];
  /** order items the receipt never mentioned (order verification only) */
  missingCandidates: MatchCandidate[];
}

const PRICE_TOLERANCE = 0.01;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/**
 * Scores how well an OCR item description matches a product. SKU appearing in
 * the description is a definitive match; otherwise token overlap against the
 * product name, requiring at least half the product-name tokens to appear.
 */
function matchScore(ocrName: string, candidate: MatchCandidate): number {
  const normalizedOcr = normalize(ocrName);
  if (candidate.sku && normalizedOcr.includes(normalize(candidate.sku))) return 1;

  const productTokens = tokens(candidate.name);
  if (productTokens.length === 0) return 0;
  const ocrTokens = new Set(tokens(ocrName));
  const overlap = productTokens.filter((t) => ocrTokens.has(t)).length;
  const score = overlap / productTokens.length;
  return score >= 0.5 ? score : 0;
}

function bestCandidate(
  ocrName: string,
  candidates: MatchCandidate[],
  used: Set<number>
): MatchCandidate | null {
  let best: MatchCandidate | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (used.has(candidate.productId)) continue;
    const score = matchScore(ocrName, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Verify a receipt/billing document against a PO/SO's line items. */
export function matchAgainstOrder(
  extracted: ExtractedReceipt,
  orderItems: MatchCandidate[]
): MatchResult {
  const used = new Set<number>();
  const lines: MatchedLine[] = [];

  for (const line of extracted.line_items) {
    const candidate = bestCandidate(line.name, orderItems, used);
    if (!candidate) {
      lines.push({
        productId: null,
        ocrName: line.name,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        lineTotal: line.line_total,
        matchStatus: "not_in_order",
        expectedQuantity: null,
        expectedPrice: null,
      });
      continue;
    }
    used.add(candidate.productId);

    let status: LineMatchStatus = "matched";
    if (
      line.quantity !== null &&
      candidate.quantity !== undefined &&
      line.quantity !== candidate.quantity
    ) {
      status = "qty_mismatch";
    } else if (
      line.unit_price !== null &&
      Math.abs(line.unit_price - candidate.unitPrice) > PRICE_TOLERANCE
    ) {
      status = "price_mismatch";
    }

    lines.push({
      productId: candidate.productId,
      ocrName: line.name,
      quantity: line.quantity,
      unitPrice: line.unit_price,
      lineTotal: line.line_total,
      matchStatus: status,
      expectedQuantity: candidate.quantity ?? null,
      expectedPrice: candidate.unitPrice,
    });
  }

  const missingCandidates = orderItems.filter((c) => !used.has(c.productId));
  const matchedCount = lines.filter((l) => l.matchStatus === "matched").length;
  const hasMismatch = lines.some(
    (l) => l.matchStatus === "qty_mismatch" || l.matchStatus === "price_mismatch"
  );
  const hasExtras = lines.some((l) => l.matchStatus === "not_in_order");

  let status: ScanMatchStatus;
  if (matchedCount === 0 && !hasMismatch) {
    status = "unmatched";
  } else if (hasMismatch) {
    status = "mismatched";
  } else if (missingCandidates.length === 0 && !hasExtras) {
    status = "matched";
  } else {
    status = "partial";
  }

  return { status, lines, missingCandidates };
}

/** Retail audit: spot own products on any store receipt. */
export function matchAgainstCatalog(
  extracted: ExtractedReceipt,
  catalog: MatchCandidate[]
): MatchResult {
  const used = new Set<number>();
  const lines: MatchedLine[] = extracted.line_items.map((line) => {
    const candidate = bestCandidate(line.name, catalog, used);
    if (!candidate) {
      return {
        productId: null,
        ocrName: line.name,
        quantity: line.quantity,
        unitPrice: line.unit_price,
        lineTotal: line.line_total,
        matchStatus: "not_our_product" as const,
        expectedQuantity: null,
        expectedPrice: null,
      };
    }
    used.add(candidate.productId);
    return {
      productId: candidate.productId,
      ocrName: line.name,
      quantity: line.quantity,
      unitPrice: line.unit_price,
      lineTotal: line.line_total,
      matchStatus: "matched" as const,
      expectedQuantity: null,
      expectedPrice: candidate.unitPrice,
    };
  });

  const ownCount = lines.filter((l) => l.matchStatus === "matched").length;
  return {
    status: ownCount > 0 ? "matched" : "unmatched",
    lines,
    missingCandidates: [],
  };
}
