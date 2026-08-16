import { classifyCustomer, type PeerContext } from "../lib/classification";

const fails: string[] = [];
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fails.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ---------------------------------------------------------------------------
// THE HONESTY TEST — the current live population: 14 customers, all B2C, all
// ordinary consumer baskets. A percentile-only rule would label the top
// spenders WHOLESALER. The correct answer is "no business buyers here".
// ---------------------------------------------------------------------------
const smallPop: PeerContext = { population: 14, aovP75: 900 };
const realistic = [120, 260, 310, 420, 480, 520, 640, 700, 760, 880, 980, 1200, 1450, 2400];

let fabricated = 0;
for (const aov of realistic) {
  const r = classifyCustomer(
    {
      custType: "B2C",
      frequency: 4,
      monetary: aov * 4,
      channelCounts: { POS: 2, ECOM: 2 },
    },
    smallPop
  );
  if (r.behaviorClass !== "CONSUMER") fabricated++;
}
check("no business class fabricated from 14 consumers", fabricated, 0);

// Even the single biggest spender must stay CONSUMER.
const top = classifyCustomer(
  { custType: "B2C", frequency: 4, monetary: 2400 * 4, channelCounts: { POS: 4 } },
  smallPop
);
check("top spender stays CONSUMER", top.behaviorClass, "CONSUMER");
check("top spender tier DEFAULT", top.tier, "DEFAULT");

// ---------------------------------------------------------------------------
// Real business buyers still get caught (floors clear regardless of peers).
// ---------------------------------------------------------------------------
const horeca = classifyCustomer(
  {
    custType: "B2C",
    frequency: 12,
    monetary: 3800 * 12,
    channelCounts: { ECOM: 10, D2C: 2 },
    maxPackSize: 20,
    weekdayShare: 0.9,
  },
  smallPop
);
check("HoReCa detected", horeca.behaviorClass, "HORECA");
check("HoReCa tier INFERRED", horeca.tier, "INFERRED");

const wholesaler = classifyCustomer(
  { custType: "B2B", frequency: 20, monetary: 12000 * 20, channelCounts: { SFA: 18, ECOM: 2 } },
  smallPop
);
check("wholesaler detected", wholesaler.behaviorClass, "WHOLESALER");

// ---------------------------------------------------------------------------
// Tier precedence + disagreement
// ---------------------------------------------------------------------------
const anchored = classifyCustomer(
  {
    custType: "B2B",
    dealer: { dealerType: "Retailer", channel: "Modern Trade" },
    frequency: 3,
    monetary: 300 * 3,
    channelCounts: { SFA: 3 },
  },
  smallPop
);
check("dealer anchor wins", anchored.behaviorClass, "MODERN_TRADE");
check("dealer anchor tier", anchored.tier, "ANCHORED");
check("anchor vs behaviour disagreement flagged", anchored.disagreement, true);

// MODERN_TRADE / TRADITIONAL_TRADE must be UNREACHABLE without a dealer link.
const noAnchorBigSpender = classifyCustomer(
  { custType: "B2B", frequency: 30, monetary: 50000 * 30, channelCounts: { SFA: 30 } },
  { population: 500, aovP75: 1000 }
);
check(
  "no dealer link -> never MODERN/TRADITIONAL_TRADE",
  ["MODERN_TRADE", "TRADITIONAL_TRADE"].includes(noAnchorBigSpender.behaviorClass),
  false
);

// Registered company that buys like a consumer — the one-man-company case.
const companyConsumer = classifyCustomer(
  { custType: "B2C", taxEntityType: "JURISTIC", frequency: 5, monetary: 400 * 5, channelCounts: { ECOM: 5 } },
  smallPop
);
check("tax ID -> VERIFIED tier", companyConsumer.tier, "VERIFIED");
check("class still reflects behaviour", companyConsumer.behaviorClass, "CONSUMER");
check("conflict flagged for review", companyConsumer.disagreement, true);

// Staff override beats everything.
const institutional = classifyCustomer(
  {
    custType: "B2B",
    institutionalOverride: true,
    dealer: { dealerType: "Dealer", channel: "Modern Trade" },
    frequency: 40,
    monetary: 90000 * 40,
    channelCounts: { SFA: 40 },
  },
  smallPop
);
check("staff override wins", institutional.behaviorClass, "INSTITUTIONAL");

// Percentile engages once the population is big enough.
const bigPop: PeerContext = { population: 400, aovP75: 6000 };
const belowPeers = classifyCustomer(
  { custType: "B2C", frequency: 10, monetary: 3500 * 10, channelCounts: { ECOM: 10 } },
  bigPop
);
check("clears floor but below peer p75 -> CONSUMER", belowPeers.behaviorClass, "CONSUMER");

console.log("top spender  :", top.behaviorClass, "·", top.tier, "·", top.reasons[0]);
console.log("horeca       :", horeca.behaviorClass, "·", horeca.tier);
console.log("company-consumer:", companyConsumer.behaviorClass, "·", companyConsumer.tier, "· flag:", companyConsumer.disagreement);

if (fails.length) {
  console.log("\nFAILURES:");
  for (const f of fails) console.log(" - " + f);
  process.exitCode = 1;
} else {
  console.log("\nAll checks passed.");
}
