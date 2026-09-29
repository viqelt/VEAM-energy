/**
 * VEAM — Event-Based Power Segmentation (ΔP-based Event Detection)
 * ----------------------------------------------------------------
 * Pure, dependency-free functions (no React). Runs LOCALLY, BEFORE the LLM call:
 *
 *   raw aggregate power → noise-robust ΔP → Aggregate Load Events → power segments
 *   → compact features (clusters / per-region stats) → prompt
 *
 * An event is a sustained STEP in the aggregate household power. It is NOT an
 * appliance label: ΔP = +50 W means "about 50 W of load appeared", nothing more.
 * Interpreting it is left to the AI + reference table + deterministic checks.
 *
 * This is a NILM-inspired feature extractor, not a complete NILM solution.
 */

// ─── Configurable parameters ─────────────────────────────────────────────────

/**
 * Minimum step (W) that can ever count as an event (floor of the threshold).
 * Rationale: the smallest appliances in the prompt's reference table that we want
 * to be able to notice on a ~400 W household signal are fan/laptop/TV (≈40–150 W),
 * so the floor sits just below them. Anything smaller (LED, chargers, router, meter
 * jitter) is treated as noise. The effective threshold is ADAPTIVE (see below), so
 * this is only a lower bound — check `thresholdW` / `noiseSigmaW` in the result.
 */
export const POWER_CHANGE_THRESHOLD_W = 30;

/** Effective threshold = max(floor, NOISE_SIGMA_MULTIPLIER × robust σ of consecutive ΔP). */
export const NOISE_SIGMA_MULTIPLIER = 4;

/** A step followed by a plateau shorter than this is flagged "CHANGE" (unstable transition). 3 samples = 60 s at 20 s sampling. */
export const STABLE_SEGMENT_MIN_SAMPLES = 3;

/** The lowest X % of smoothed power is taken as the always-on baseline (used only for overlap detection). */
export const BASELINE_PERCENTILE = 0.05;

/** Steps whose |ΔP| differ by less than this relative tolerance are grouped in one cluster. */
export const DELTA_CLUSTER_TOLERANCE = 0.25;

/** A cluster needs at least this many events to be considered a repeating signature. */
export const MIN_EVENTS_PER_CLUSTER = 2;

/** Max number of ΔP clusters sent to the LLM (keeps the prompt small). */
export const MAX_CLUSTERS_FOR_PROMPT = 8;

/** If at least this share of ON events happen while another load is already active → ambiguous. */
export const OVERLAP_AMBIGUITY_RATIO = 0.5;

/** Minimum number of ON events before the overlap ratio is trusted. */
export const MIN_EVENTS_FOR_OVERLAP_JUDGEMENT = 3;

// ─── Types ───────────────────────────────────────────────────────────────────

export type EventDirection = "ON" | "OFF" | "CHANGE";

export interface PowerEvent {
  time: string;              // timestamp (as in the source row) of the first sample at the new level
  index: number;             // index of that sample in the input array
  previousPower: number;     // median power of the plateau BEFORE the step (W)
  currentPower: number;      // median power of the plateau AFTER the step (W) = resulting aggregate level
  deltaPower: number;        // currentPower - previousPower (W)
  direction: EventDirection; // ON: stable rise · OFF: stable fall · CHANGE: step into a very short (<STABLE_SEGMENT_MIN_SAMPLES) plateau
  overlapsExistingLoad: boolean; // another load was already running above the baseline during this event
}

export interface PowerSegment {
  startIndex: number;
  endIndex: number;
  startTime: string;
  levelPower: number;  // W — MEDIAN of the plateau samples (robust to spikes/inrush)
  sampleCount: number;
  durationSec: number; // real elapsed time (same rules as runNILM's elapsedTo)
}

export interface EventDetectionInput {
  samples: { time: string; power: number }[]; // chronologically sorted
  epochs: (number | null)[];                  // parsed timestamps in seconds (same array runNILM already builds)
  elapsedTo: (i: number) => number;           // runNILM's existing helper (real seconds between sample i-1 and i)
  maxGapSeconds: number;                      // runNILM's MAX_GAP_SECONDS
  sampleIntervalSeconds: number;              // SAMPLE_INTERVAL_SECONDS
}

export interface EventDetectionConfig {
  thresholdFloorW?: number;
  noiseSigmaMultiplier?: number;
  stableSegmentMinSamples?: number;
  baselinePercentile?: number;
}

export interface EventDetectionResult {
  events: PowerEvent[];
  segments: PowerSegment[];
  thresholdW: number;  // effective threshold actually used
  noiseSigmaW: number; // robust noise estimate of consecutive ΔP
  baselineW: number;   // always-on baseline estimate
}

export interface EventCluster {
  typicalDeltaW: number; // median |ΔP| of the cluster
  onCount: number;
  offCount: number;
  onPerDay: number;
  overlapRatio: number;  // 0–1, share of ON events that overlapped another running load
}

export interface RegionEventStats {
  onEvents: number;
  onPerDay: number;
  medianOnStepW: number;
  overlapRatio: number; // 0–1
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const median = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

// ─── 1) ΔP calculation + event detection + segmentation ──────────────────────

export function detectPowerEvents(
  input: EventDetectionInput,
  config: EventDetectionConfig = {}
): EventDetectionResult {
  const floorW = config.thresholdFloorW ?? POWER_CHANGE_THRESHOLD_W;
  const sigmaMult = config.noiseSigmaMultiplier ?? NOISE_SIGMA_MULTIPLIER;
  const stableMin = config.stableSegmentMinSamples ?? STABLE_SEGMENT_MIN_SAMPLES;
  const baselinePct = config.baselinePercentile ?? BASELINE_PERCENTILE;

  const { samples, epochs, elapsedTo, maxGapSeconds, sampleIntervalSeconds } = input;
  const n = samples.length;
  const raw = samples.map(s => s.power);

  // A "gap" between i-1 and i = missing/invalid data or a hole longer than maxGapSeconds.
  // Events are never created across a gap (a jump over a hole is not a real ΔP).
  const isGap = (i: number): boolean => {
    if (i <= 0 || i >= n) return false;
    if (!Number.isFinite(raw[i]) || !Number.isFinite(raw[i - 1])) return true;
    const a = epochs[i - 1], b = epochs[i];
    if (a === null || b === null) return false;
    return b - a > maxGapSeconds;
  };

  // Step 1 — 3-point median filter: removes isolated 1-sample spikes (inrush / meter glitch)
  // while preserving real steps. Same spirit as runNILM's existing 1-sample region debounce,
  // but applied on watts instead of on region labels.
  const smooth = raw.map((p, i) => {
    if (i === 0 || i === n - 1 || isGap(i) || isGap(i + 1)) return p;
    const w = [raw[i - 1], p, raw[i + 1]];
    if (w.some(v => !Number.isFinite(v))) return p;
    return w.sort((a, b) => a - b)[1];
  });

  // Step 2 — ΔP = P_current − P_previous (NaN across gaps)
  const delta = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n; i++) if (!isGap(i)) delta[i] = smooth[i] - smooth[i - 1];

  // Step 3 — adaptive threshold: robust noise σ (MAD) of consecutive ΔP, never below the floor.
  const finiteDeltas = delta.filter(Number.isFinite);
  const med = median(finiteDeltas);
  const noiseSigmaW = 1.4826 * median(finiteDeltas.map(d => Math.abs(d - med)));
  const thresholdW = Math.max(floorW, sigmaMult * noiseSigmaW);

  // Step 4 — baseline (lowest percentile of smoothed power): the always-on load.
  const finiteSmooth = smooth.filter(Number.isFinite).sort((a, b) => a - b);
  const baselineW = finiteSmooth.length
    ? finiteSmooth[Math.floor(baselinePct * (finiteSmooth.length - 1))]
    : 0;

  // Step 5 — find breakpoints. Consecutive same-sign candidates are merged into ONE event
  // (a single appliance can ramp over 2 samples at 20 s sampling). Two real appliances
  // switching within the same ~40 s cannot be separated at this sampling rate.
  const isCandidate = (i: number) => Number.isFinite(delta[i]) && Math.abs(delta[i]) >= thresholdW;
  type Break = { oldEnd: number; newStart: number; isEvent: boolean };
  const breaks: Break[] = [];
  for (let i = 1; i < n; ) {
    if (isGap(i)) { breaks.push({ oldEnd: i - 1, newStart: i, isEvent: false }); i++; continue; }
    if (isCandidate(i)) {
      const sign = Math.sign(delta[i]);
      let j = i;
      while (j + 1 < n && isCandidate(j + 1) && Math.sign(delta[j + 1]) === sign) j++;
      breaks.push({ oldEnd: i - 1, newStart: j, isEvent: true }); // samples i..j-1 = ramp, excluded from plateaus
      i = j + 1;
    } else i++;
  }

  // Step 6 — segments = plateaus between breakpoints.
  const makeSegment = (s: number, e: number): PowerSegment => {
    const vals: number[] = [];
    let durationSec = 0;
    for (let k = s; k <= e; k++) {
      if (Number.isFinite(raw[k])) vals.push(raw[k]);
      durationSec += k === s ? sampleIntervalSeconds : elapsedTo(k);
    }
    return {
      startIndex: s, endIndex: e, startTime: samples[s].time,
      levelPower: vals.length ? median(vals) : NaN,
      sampleCount: e - s + 1, durationSec,
    };
  };
  const segments: PowerSegment[] = [];
  if (n === 0) return { events: [], segments, thresholdW, noiseSigmaW, baselineW };
  let start = 0;
  breaks.forEach(b => { segments.push(makeSegment(start, b.oldEnd)); start = b.newStart; });
  segments.push(makeSegment(start, n - 1));

  // Step 7 — events = transitions between consecutive segments.
  const events: PowerEvent[] = [];
  breaks.forEach((b, k) => {
    if (!b.isEvent) return;
    const before = segments[k], after = segments[k + 1];
    if (!Number.isFinite(before.levelPower) || !Number.isFinite(after.levelPower)) return;
    const previousPower = Math.round(before.levelPower);
    const currentPower = Math.round(after.levelPower);
    const deltaPower = currentPower - previousPower;
    if (Math.abs(deltaPower) < thresholdW) return; // plateaus barely differ → not a real step
    events.push({
      time: after.startTime,
      index: after.startIndex,
      previousPower, currentPower, deltaPower,
      direction: after.sampleCount < stableMin ? "CHANGE" : deltaPower > 0 ? "ON" : "OFF",
      overlapsExistingLoad: Math.min(previousPower, currentPower) - baselineW >= thresholdW,
    });
  });

  return { events, segments, thresholdW, noiseSigmaW, baselineW };
}

// ─── 2) Feature extraction (compact, LLM-ready) ──────────────────────────────

/** Groups events by |ΔP| magnitude (repeating "step signatures"). Ignores unstable CHANGE events. */
export function clusterEventsByMagnitude(
  events: PowerEvent[],
  spanDays: number,
  tolerance = DELTA_CLUSTER_TOLERANCE,
  maxClusters = MAX_CLUSTERS_FOR_PROMPT
): EventCluster[] {
  const usable = events
    .filter(e => e.direction !== "CHANGE")
    .sort((a, b) => Math.abs(a.deltaPower) - Math.abs(b.deltaPower));
  const groups: PowerEvent[][] = [];
  let groupStart = 0;
  for (const e of usable) {
    const mag = Math.abs(e.deltaPower);
    if (groups.length === 0 || mag > groupStart * (1 + tolerance)) { groups.push([e]); groupStart = mag; }
    else groups[groups.length - 1].push(e);
  }
  return groups
    .filter(g => g.length >= MIN_EVENTS_PER_CLUSTER)
    .map(g => {
      const ons = g.filter(e => e.direction === "ON");
      const offs = g.filter(e => e.direction === "OFF");
      return {
        typicalDeltaW: Math.round(median(g.map(e => Math.abs(e.deltaPower)))),
        onCount: ons.length,
        offCount: offs.length,
        onPerDay: round1(ons.length / spanDays),
        overlapRatio: ons.length ? round2(ons.filter(e => e.overlapsExistingLoad).length / ons.length) : 0,
      };
    })
    .sort((a, b) => b.onCount * b.typicalDeltaW - a.onCount * a.typicalDeltaW) // biggest energy contributors first
    .slice(0, maxClusters);
}

/** Per aggregate-power region: how often ON steps LAND in that region, typical step size, overlap share. */
export function summarizeEventsByRegion(
  events: PowerEvent[],
  spanDays: number,
  regionOf: (p: number) => string
): Record<string, RegionEventStats> {
  const byRegion: Record<string, PowerEvent[]> = {};
  events.filter(e => e.direction === "ON").forEach(e => {
    const r = regionOf(e.currentPower);
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(e);
  });
  const out: Record<string, RegionEventStats> = {};
  Object.entries(byRegion).forEach(([region, evs]) => {
    out[region] = {
      onEvents: evs.length,
      onPerDay: round1(evs.length / spanDays),
      medianOnStepW: Math.round(median(evs.map(e => e.deltaPower))),
      overlapRatio: round2(evs.filter(e => e.overlapsExistingLoad).length / evs.length),
    };
  });
  return out;
}

// ─── 3) Deterministic event evidence (runs BEFORE the existing usage-based check) ──

/**
 * Event evidence can only LOWER confidence (High → Medium) when most ON steps in the
 * region happened on top of other running loads (ambiguous / overlapping evidence).
 * It never raises confidence: without a wattage model, a step size alone cannot
 * verify a specific appliance.
 */
export function applyEventEvidence(confidence: string, stats?: RegionEventStats): string {
  if (!stats) return confidence;
  const ambiguous =
    stats.onEvents >= MIN_EVENTS_FOR_OVERLAP_JUDGEMENT && stats.overlapRatio >= OVERLAP_AMBIGUITY_RATIO;
  return ambiguous && confidence === "High" ? "Medium" : confidence;
}
