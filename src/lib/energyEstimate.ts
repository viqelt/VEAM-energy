// ── Energy estimation from raw Power readings ───────────────────────────────
// Separate from billing on purpose:
//   Power readings  →  estimateDailyKwh()  →  dailyKwh
//   dailyKwh        →  calcElecBill()      →  DA          (see sonelgazTariffs.ts)
// Keeping these two steps apart means the Sonelgaz tariff logic never has to
// know anything about how energy was estimated, and vice versa.

export interface PowerReading {
  time: string;  // "YYYY-MM-DD HH:MM:SS" (or any Date-parseable string)
  power: number; // instantaneous power in Watts
}

// Guard against huge gaps (e.g. ESP32 buffers readings while offline and
// uploads a burst on reconnect — integrating "as if" power was constant
// across that gap would badly overstate energy). Gaps longer than this are
// skipped rather than integrated.
const MAX_INTEGRATION_GAP_HOURS = 6;

function parseTimestamp(t: string): Date | null {
  if (!t) return null;
  const d = new Date(t.trim().replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Estimates a representative daily energy consumption (kWh) from a set of
 * power readings, using time-weighted (trapezoidal) integration instead of
 * a simple average — irregular sampling intervals no longer bias the result.
 *
 * Readings don't need to span a full 24h: the time-weighted average power
 * over the available span is projected across 24h, which is what you want
 * for an intraday "if today continues like this" monthly bill estimate.
 */
export function estimateDailyKwh(readings: PowerReading[]): number {
  const points = readings
    .map((r) => ({ ts: parseTimestamp(r.time), power: r.power }))
    .filter((r): r is { ts: Date; power: number } => r.ts !== null)
    .sort((a, b) => a.ts.getTime() - b.ts.getTime());

  if (points.length === 0) return 0;
  if (points.length === 1) return (points[0].power * 24) / 1000; // not enough to integrate

  let energyWh = 0;
  let integratedHours = 0;

  for (let i = 1; i < points.length; i++) {
    const dtHours = (points[i].ts.getTime() - points[i - 1].ts.getTime()) / 3_600_000;
    if (dtHours <= 0 || dtHours > MAX_INTEGRATION_GAP_HOURS) continue; // skip bad/huge gaps
    const avgP = (points[i].power + points[i - 1].power) / 2; // trapezoidal rule
    energyWh += avgP * dtHours;
    integratedHours += dtHours;
  }

  if (integratedHours === 0) {
    // every interval was skipped (e.g. all gaps too large) — fall back
    const lastPower = points[points.length - 1].power;
    return (lastPower * 24) / 1000;
  }

  const timeWeightedAvgW = energyWh / integratedHours;
  return (timeWeightedAvgW * 24) / 1000; // project time-weighted avg across a full day
}
