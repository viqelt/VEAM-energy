// ── Shared Sonelgaz billing logic ───────────────────────────────────────────
// Extracted verbatim from BillCalculator.tsx so that BillCalculator.tsx and
// Notifications.tsx (and any future page) compute bills the exact same way.
// DO NOT change the tranche limits, rates, or tax values here — they were
// verified against a real Sonelgaz bill. Only import/reuse this logic.

// ── Sonelgaz electricity tranches ─────────────────────────────────────────
// Tranche limits are FIXED per Sonelgaz billing (verified on real bill).
// Days only affect total kWh consumed, NOT the tranche boundaries.
export function calcElecBill(dailyKwh: number, days: number): number {
  const kwh = dailyKwh * days;
  const T1 = 125;   // 0 – 125 kWh
  const T2 = 250;   // 125 – 250 kWh
  const T3 = 1000;  // 250 – 1000 kWh
  let bill = 0;
  if (kwh <= T1) {
    bill = kwh * 1.7787;
  } else if (kwh <= T2) {
    bill = T1 * 1.7787 + (kwh - T1) * 4.1789;
  } else if (kwh <= T3) {
    bill = T1 * 1.7787 + T1 * 4.1789 + (kwh - T2) * 4.8120;
  } else {
    bill = T1 * 1.7787 + T1 * 4.1789 + (T3 - T2) * 4.8120 + (kwh - T3) * 5.48;
  }
  return Math.round(bill);
}

// ── Sonelgaz gas tranches — prorata par jours (vérifié sur facture réelle) ──
// Seuils annuels: 2500 / 5000 / 15000 Th/an, proratés sur la durée réelle.
// Vérif: 5496.4 Th / 164 jours → 1841 DA ✅ (facture réelle: 1841.47 DA)
export function calcGasBill(th: number, days: number): number {
  if (th <= 0) return 0;
  const L1 = Math.round(2500  * (days / 365));
  const L2 = Math.round(5000  * (days / 365));
  const L3 = Math.round(15000 * (days / 365));
  let bill = 0;
  if (th <= L1)       bill = th * 0.1682;
  else if (th <= L2)  bill = L1 * 0.1682 + (th - L1) * 0.3245;
  else if (th <= L3)  bill = L1 * 0.1682 + (L2 - L1) * 0.3245 + (th - L2) * 0.4025;
  else                bill = L1 * 0.1682 + (L2 - L1) * 0.3245 + (L3 - L2) * 0.4025 + (th - L3) * 0.60;
  return Math.round(bill);
}

// ── Default tax config — based on real Sonelgaz bill ──────────────────────
export const DEFAULT_TAXES = {
  tva9:        { label: "TVA 9%",              value: 9,   unit: "%",  enabled: true,  desc: "Taxe sur énergie (taux réduit)" },
  tva19:       { label: "TVA 19%",             value: 19,  unit: "%",  enabled: true,  desc: "Taxe sur redevances & services" },
  redevance:   { label: "Redevances Fixes",    value: 164, unit: "DA", enabled: true,  desc: "Abonnement réseau HT" },
  habitation:  { label: "Taxe d'Habitation",   value: 200, unit: "DA", enabled: true,  desc: "Services municipaux" },
  droitFixe:   { label: "Droit Fixe",          value: 100, unit: "DA", enabled: true,  desc: "Droit fixe sur consommation" },
  timbre:      { label: "Timbre Fiscal",        value: 37,  unit: "DA", enabled: true,  desc: "Appliqué une fois par facture" },
};

export type TaxKey = keyof typeof DEFAULT_TAXES;

export interface TaxItem {
  label: string;
  value: number;
  unit: string;
  enabled: boolean;
  desc: string;
}
