import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Zap,
  DollarSign,
  Receipt,
  FileText,
  Fuel,
  Upload,
  CheckCircle2,
  TrendingUp,
  Activity,
  Gauge,
  Radio,
  Waves,
  CircleDot,
  Wifi,
  ShoppingCart,
  X,
  Cpu,
  BarChart2,
  Smartphone,
  Star,
  AlertTriangle,
} from "lucide-react";
import { calcElecBill } from "@/lib/sonelgazTariffs";

// ── Live data from Google Sheets (ESP32 + PZEM-004T → Google Sheets) ────────
// Column order (same as GraphsAnalysis.tsx): time, voltage, current, power, powerFactor, frequency
const SHEET_ID = "1g9XRplcjctpLaOnxmsy7C_0o8dc9Yy4-Zny6m7XSyXg";
const SHEET_BASE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq`;

const POLL_MS = 10_000;            // check the sheet every 10s (ESP32 writes every ~20s)
const LIVE_MAX_AGE_SEC = 120;      // last row ≤ 2 min old  → "Live"
const OFFLINE_AFTER_SEC = 15 * 60; // last row > 15 min old → "Offline" (same as Notifications.tsx)
const FORCE_RETRIES = 4;           // "Upload Data from Device": number of checks
const FORCE_RETRY_GAP_MS = 6_000;  // wait between checks (≈ one ESP32 cycle in total)

interface LiveReading {
  time: string;
  timestamp: Date | null;
  voltage: number;
  current: number;
  power: number;
  powerFactor: number;
  frequency: number;
}

type DeviceState = "connecting" | "live" | "delayed" | "offline" | "error";
type UploadStatus = "idle" | "loading" | "success" | "stale" | "error";

// Minimal CSV line parser (handles quoted fields)
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

// "YYYY-MM-DD HH:MM:SS" or "DD/MM/YYYY HH:MM:SS" → Date
function parseSheetTimestamp(t: string): Date | null {
  if (!t) return null;
  const s = t.trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (dmy) {
    const d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1], +dmy[4], +dmy[5], +(dmy[6] || 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d;
}

// Convert CSV text to readings (the header row is dropped automatically: its "power" is not a number)
function readingsFromCsv(text: string): LiveReading[] {
  const rows: LiveReading[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const c = parseCsvLine(line);
    if (c.length < 6) continue;
    const power = parseFloat(c[3]);
    if (!Number.isFinite(power)) continue;
    rows.push({
      time: c[0],
      timestamp: parseSheetTimestamp(c[0]),
      voltage: parseFloat(c[1]) || 0,
      current: parseFloat(c[2]) || 0,
      power,
      powerFactor: parseFloat(c[4]) || 0,
      frequency: parseFloat(c[5]) || 0,
    });
  }
  return rows;
}

async function fetchCsv(query?: string): Promise<string> {
  const params = new URLSearchParams({ tqx: "out:csv", _: String(Date.now()) });
  if (query) params.set("tq", query);
  const res = await fetch(`${SHEET_BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Sheet request failed: " + res.status);
  return res.text();
}

// Reads ONLY the last row of the sheet.
// 1) light query (newest row by timestamp) → small download every poll
// 2) fallback: download the whole sheet and take the last line (same as other pages)
async function fetchLatestReading(): Promise<LiveReading | null> {
  try {
    const rows = readingsFromCsv(await fetchCsv("select * order by A desc limit 1"));
    if (rows.length > 0) return rows[rows.length - 1];
  } catch {
    /* fall through to the full read */
  }
  const rows = readingsFromCsv(await fetchCsv());
  return rows.length > 0 ? rows[rows.length - 1] : null;
}

function formatAge(sec: number): string {
  if (sec < 5) return "just now";
  if (sec < 60) return Math.round(sec) + "s ago";
  const min = sec / 60;
  if (min < 60) return Math.round(min) + " min ago";
  const h = Math.floor(min / 60);
  return h + "h " + Math.round(min % 60) + "min ago";
}

// ── Today's consumption ─────────────────────────────────────────────────────
const BILL_PERIOD_DAYS = 70;       // Sonelgaz bi-monthly billing period (same as BillCalculator.tsx)
const MAX_ENERGY_GAP_MIN = 10;     // gaps longer than this = device offline → not counted

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// ACTUAL energy (kWh) between the first and last reading, by trapezoidal integration.
// Unlike estimateDailyKwh() it does NOT project to 24h: it is what was really consumed so far.
function integrateKwh(rows: LiveReading[]): number {
  const pts = rows
    .filter((r): r is LiveReading & { timestamp: Date } => r.timestamp !== null)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let wh = 0;
  for (let i = 1; i < pts.length; i++) {
    const dtH = (pts[i].timestamp.getTime() - pts[i - 1].timestamp.getTime()) / 3_600_000;
    if (dtH <= 0 || dtH * 60 > MAX_ENERGY_GAP_MIN) continue;
    wh += ((pts[i].power + pts[i - 1].power) / 2) * dtH;
  }
  return wh / 1000;
}

function AnimatedCounter({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    const start = prevTarget.current !== target ? count : 0;
    prevTarget.current = target;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return <span>{count.toLocaleString()}</span>;
}

export default function HomePage() {
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [todayRows, setTodayRows] = useState<LiveReading[]>([]);
  const [todayLoaded, setTodayLoaded] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [forceAttempt, setForceAttempt] = useState(0);
  const [gasTh, setGasTh] = useState(150);
  const [includeGas, setIncludeGas] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Latest row from Google Sheets (returns the reading so the Force button can verify it)
  const refresh = useCallback(async (): Promise<LiveReading | null> => {
    try {
      const latest = await fetchLatestReading();
      if (latest) {
        setReading(latest);
        setFetchError(false);
        // keep today's list up to date without re-downloading the sheet
        const now = new Date();
        if (latest.timestamp && isSameDay(latest.timestamp, now)) {
          setTodayRows((prev) => {
            const sameDay = prev.filter((r) => r.timestamp && isSameDay(r.timestamp, now));
            if (sameDay.length && sameDay[sameDay.length - 1].time === latest.time) return sameDay;
            return [...sameDay, latest];
          });
        }
      } else {
        setFetchError(true);
      }
      return latest;
    } catch {
      setFetchError(true);
      return null;
    }
  }, []);

  // Full read of today's rows (once on load, and when the tab becomes visible again)
  const loadToday = useCallback(async () => {
    try {
      const all = readingsFromCsv(await fetchCsv());
      const now = new Date();
      setTodayRows(all.filter((r) => r.timestamp && isSameDay(r.timestamp, now)));
      setTodayLoaded(true);
    } catch {
      /* keep what we already have */
    }
  }, []);

  // Real-time polling: on mount, every POLL_MS, and when the tab becomes visible again
  useEffect(() => {
    refresh();
    loadToday();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) {
        refresh();
        loadToday();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, loadToday]);

  // 1s tick so "updated Xs ago" and the Live/Offline state stay accurate
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const currentPower = reading?.power ?? 0; // W

  // Today's consumption (actual kWh so far) and its cost on Sonelgaz's progressive tariff
  const dayKey = new Date(nowTick).toDateString();
  const todayKwh = useMemo(
    () => integrateKwh(todayRows.filter((r) => r.timestamp && r.timestamp.toDateString() === dayKey)),
    [todayRows, dayKey]
  );
  // Cost of one day at this consumption level: tranches apply over the whole billing period,
  // so we price (today's kWh × 70 days) and divide by 70 → average DA/day (HT)
  const todayCost = Math.round(calcElecBill(todayKwh, BILL_PERIOD_DAYS) / BILL_PERIOD_DAYS);
  const ageSec = reading?.timestamp ? Math.max(0, (nowTick - reading.timestamp.getTime()) / 1000) : null;

  const deviceState: DeviceState = !reading
    ? fetchError ? "error" : "connecting"
    : ageSec === null || ageSec <= LIVE_MAX_AGE_SEC ? "live"
    : ageSec <= OFFLINE_AFTER_SEC ? "delayed"
    : "offline";

  const stateUI: Record<DeviceState, { dot: string; text: string; label: string }> = {
    connecting: { dot: "bg-gray-400",  text: "text-gray-500",  label: "Connecting to Google Sheets..." },
    live:       { dot: "bg-green-500", text: "text-green-600", label: "Live" },
    delayed:    { dot: "bg-amber-500", text: "text-amber-600", label: "Delayed" },
    offline:    { dot: "bg-red-500",   text: "text-red-600",   label: "Device offline" },
    error:      { dot: "bg-red-500",   text: "text-red-600",   label: "Can't reach Google Sheets" },
  };
  const ui = stateUI[deviceState];
  const ageText = ageSec !== null ? formatAge(ageSec) : null;

  // Clear a "stale"/"error" message by itself once fresh data arrives
  useEffect(() => {
    if ((uploadStatus === "stale" || uploadStatus === "error") && deviceState === "live") {
      setUploadStatus("idle");
    }
  }, [deviceState, uploadStatus]);

  // Sonelgaz gas — prorata sur 70 jours (vérifié sur facture réelle)
  const GAS_DAYS = 70;

  // Force check: re-reads the last row of the sheet (bypassing cache) and verifies it is fresh.
  // If the row is old, it waits and tries again (≈ one ESP32 cycle) before reporting a problem.
  const handleUpload = async () => {
    if (uploadStatus === "loading") return;
    setUploadStatus("loading");
    let latest: LiveReading | null = null;

    for (let attempt = 1; attempt <= FORCE_RETRIES; attempt++) {
      setForceAttempt(attempt);
      latest = await refresh();
      const age = latest?.timestamp ? (Date.now() - latest.timestamp.getTime()) / 1000 : null;
      if (latest && (age === null || age <= LIVE_MAX_AGE_SEC)) {
        setUploadStatus("success");
        setTimeout(() => setUploadStatus("idle"), 4000);
        return;
      }
      if (attempt < FORCE_RETRIES) {
        await new Promise((r) => setTimeout(r, FORCE_RETRY_GAP_MS));
      }
    }
    setUploadStatus(latest ? "stale" : "error");
  };

  const electricalParams = [
    { label: "Voltage", value: reading ? reading.voltage.toFixed(1) : "--", unit: "V", icon: Zap, gradient: "from-amber-400 to-orange-500" },
    { label: "Current", value: reading ? reading.current.toFixed(2) : "--", unit: "A", icon: Gauge, gradient: "from-blue-400 to-cyan-500" },
    { label: "Frequency", value: reading ? reading.frequency.toFixed(1) : "--", unit: "Hz", icon: Waves, gradient: "from-green-400 to-emerald-500" },
    { label: "Power Factor", value: reading ? reading.powerFactor.toFixed(2) : "--", unit: "cos φ", icon: CircleDot, gradient: "from-purple-400 to-violet-500" },
  ];

  // Energy Score calculation
  const energyScore = useMemo(() => {
    if (!reading) return 0;
    const powerKw = reading.power / 1000;
    // PZEM reports PF = 0 when (almost) no load is connected → don't penalise that case
    const powerFactor = reading.powerFactor > 0 ? reading.powerFactor : reading.power < 5 ? 1 : 0;
    const frequency = reading.frequency;

    // Power score: lower is better (max 3kW normal)
    const powerScore = Math.max(0, 40 - (powerKw / 3) * 40);
    // Power factor score: closer to 1 is better
    const pfScore = powerFactor * 35;
    // Frequency score: closer to 50Hz is better
    const freqScore = Math.max(0, 25 - Math.abs(frequency - 50) * 50);

    return Math.min(100, Math.round(powerScore + pfScore + freqScore));
  }, [reading]);

  const scoreConfig = !reading
    ? { color: "#9ca3af", bg: "from-gray-300 to-gray-400", label: "No data", msg: "Waiting for the first reading from your device" }
    : energyScore >= 75
    ? { color: "#22c55e", bg: "from-green-400 to-emerald-500", label: "Excellent", msg: "Your energy consumption is optimal" }
    : energyScore >= 50
    ? { color: "#f59e0b", bg: "from-amber-400 to-orange-500", label: "Good", msg: "Your consumption is within normal range" }
    : { color: "#ef4444", bg: "from-red-400 to-rose-500", label: "High", msg: "Consider reducing high-power devices" };

  const deviceFeatures = [
    { icon: Zap, text: "Real-time energy monitoring" },
    { icon: Cpu, text: "AI-based device detection" },
    { icon: Wifi, text: "WiFi connectivity" },
    { icon: BarChart2, text: "Web dashboard" },
    { icon: Smartphone, text: "Mobile dashboard" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden h-40 md:h-48">
        <img
          src="https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=1200&q=80"
          alt="Energy Dashboard"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/80 to-purple-900/60 flex items-center justify-between px-6 md:px-8">
          <div>
            <h2 className="text-white text-xl md:text-2xl font-bold">Welcome to Your Energy Hub</h2>
            <p className="text-indigo-200 text-sm mt-1">Monitor, analyze, and optimize your energy consumption</p>
          </div>
          <button
            onClick={() => setShowBuyModal(true)}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-medium text-sm transition-all duration-300 hover:scale-105 border border-white/30 shadow-lg"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>🛒 Buy Device</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 group">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-500">Real-time Power</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">
                {reading ? (currentPower / 1000).toFixed(2) : "--"}
              </span>
              <span className="text-lg font-medium text-gray-400">kW</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="relative flex h-2 w-2">
                {deviceState === "live" && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${ui.dot}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${ui.dot}`} />
              </span>
              <span className={`text-xs font-medium ${ui.text}`}>
                {ui.label}
                {reading && ageText ? ` · updated ${ageText}` : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-500">Tarification Sonelgaz</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-1.5 mt-1">
              {[
                { range: "0 – 125 kWh",    rate: "1.7787", color: "text-green-600",  bg: "bg-green-50"  },
                { range: "125 – 250 kWh",  rate: "4.1789", color: "text-blue-600",   bg: "bg-blue-50"   },
                { range: "250 – 1000 kWh", rate: "4.8120", color: "text-amber-600",  bg: "bg-amber-50"  },
                { range: "> 1000 kWh",     rate: "5.48", color: "text-red-600",    bg: "bg-red-50"    },
              ].map((t) => (
                <div key={t.range} className={"flex items-center justify-between px-2 py-1 rounded-lg " + t.bg}>
                  <span className="text-[11px] text-gray-500 font-medium">{t.range}</span>
                  <span className={"text-[11px] font-bold " + t.color}>{t.rate} DA/kWh</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg hover:shadow-purple-100/50 transition-all duration-300 sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-sm">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-500">Today's Consumption</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900">
                {todayLoaded ? todayKwh.toFixed(2) : "--"}
              </span>
              <span className="text-lg font-medium text-gray-400">kWh</span>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="text-xs text-purple-600 font-medium">
                {todayLoaded ? <>≈ <AnimatedCounter target={todayCost} /> DA today · HT</> : "Loading today's readings..."}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ⚡ Energy Score */}
      <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden">
        <div className={`h-1.5 w-full bg-gradient-to-r ${scoreConfig.bg}`} />
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Score Circle */}
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="32" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <circle
                    cx="40" cy="40" r="32" fill="none"
                    stroke={scoreConfig.color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(energyScore / 100) * 201} 201`}
                    style={{ transition: "stroke-dasharray 1s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-gray-900">{energyScore}</span>
                </div>
              </div>

              {/* Score Info */}
              <div>
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4" style={{ color: scoreConfig.color }} />
                  <span className="text-lg font-bold text-gray-900">Energy Score</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full`}
                    style={{ background: `${scoreConfig.color}20`, color: scoreConfig.color }}>
                    {scoreConfig.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{scoreConfig.msg}</p>
                <div className="flex items-center gap-1 mt-2">
                  <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{ width: `${energyScore}%`, background: scoreConfig.color }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 ml-1">{energyScore}/100</span>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="hidden md:flex flex-col gap-1 text-right">
              <p className="text-xs text-gray-400">Based on:</p>
              <p className="text-xs text-gray-600">⚡ Power consumption</p>
              <p className="text-xs text-gray-600">📊 Power factor</p>
              <p className="text-xs text-gray-600">〰️ Frequency stability</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Electrical Parameters Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-500" />
          Real-time Electrical Parameters
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {electricalParams.map((param) => (
            <Card key={param.label} className="border-0 shadow-sm shadow-gray-100 hover:shadow-md hover:shadow-indigo-100/40 hover:-translate-y-0.5 transition-all duration-300 cursor-default">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${param.gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
                  <param.icon className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 font-medium truncate">{param.label}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-bold text-gray-900">{param.value}</span>
                    <span className="text-xs font-medium text-gray-400">{param.unit}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-sm">
              <Fuel className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-900">Gas Consumption</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Estimate your gas cost</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="gas-toggle" className="text-sm text-gray-600 font-medium">
                Show gas cost estimate
              </Label>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${!includeGas ? "text-gray-900" : "text-gray-400"}`}>OFF</span>
                <Switch id="gas-toggle" checked={includeGas} onCheckedChange={setIncludeGas} />
                <span className={`text-xs font-medium ${includeGas ? "text-gray-900" : "text-gray-400"}`}>ON</span>
              </div>
            </div>
            <div className={`transition-all duration-300 ${includeGas ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <Label htmlFor="gas-amount" className="text-xs text-gray-500">Gas Consumption (Th)</Label>
              <Input
                id="gas-amount"
                type="number"
                value={gasTh}
                onChange={(e) => setGasTh(Number(e.target.value))}
                className="mt-1 h-10 border-gray-200 focus:border-indigo-500 rounded-lg"
                placeholder="Enter gas consumption in Th"
              />
              {includeGas && gasTh > 0 && (() => {
                const th = gasTh;
                const L1 = Math.round(2500  * (GAS_DAYS / 365));
                const L2 = Math.round(5000  * (GAS_DAYS / 365));
                const L3 = Math.round(15000 * (GAS_DAYS / 365));
                let total = 0;
                let rate = "0.1682";
                if (th <= L1) {
                  total = th * 0.1682;
                  rate = "0.1682";
                } else if (th <= L2) {
                  total = L1 * 0.1682 + (th - L1) * 0.3245;
                  rate = "0.3245";
                } else if (th <= L3) {
                  total = L1 * 0.1682 + (L2 - L1) * 0.3245 + (th - L2) * 0.4025;
                  rate = "0.4025";
                } else {
                  total = L1 * 0.1682 + (L2 - L1) * 0.3245 + (L3 - L2) * 0.4025 + (th - L3) * 0.60;
                  rate = "0.60";
                }
                const tier = th <= L1 ? "🟢 Tier 1" : th <= L2 ? "🟡 Tier 2" : th <= L3 ? "🟠 Tier 3" : "🔴 Tier 4";
                return (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                      <span className="text-xs text-gray-500">{tier}</span>
                      <span className="text-xs font-semibold text-gray-700">{rate} DA/Th</span>
                    </div>
                    <p className="text-xs text-emerald-600 font-medium">
                      Gas total: {total.toFixed(2)} DA
                    </p>
                  </div>
                );
              })()}
              <div className="mt-2 space-y-1">
                {[
                  { label: `🟢 0 → ${Math.round(2500*(GAS_DAYS/365))} Th`,                                                    rate: "0.1682 DA/Th" },
                  { label: `🟡 ${Math.round(2500*(GAS_DAYS/365))} → ${Math.round(5000*(GAS_DAYS/365))} Th`,                   rate: "0.3245 DA/Th" },
                  { label: `🟠 ${Math.round(5000*(GAS_DAYS/365))} → ${Math.round(15000*(GAS_DAYS/365))} Th`,                  rate: "0.4025 DA/Th" },
                  { label: `🔴 +${Math.round(15000*(GAS_DAYS/365))} Th`,                                                       rate: "0.60 DA/Th" },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>{t.label}</span>
                    <span className="font-medium">{t.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center shadow-sm">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-900">IoT Device Upload</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">Sync data from ESP32 via WiFi</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <img
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80"
              alt="IoT Device"
              className="w-full h-28 object-cover rounded-xl"
            />
            <Button
              onClick={handleUpload}
              disabled={uploadStatus === "loading"}
              className={`w-full h-11 rounded-xl font-medium transition-all duration-300 ${
                uploadStatus === "success"
                  ? "bg-green-500 hover:bg-green-600 shadow-green-200"
                  : uploadStatus === "stale" || uploadStatus === "error"
                  ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
                  : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-200"
              } text-white shadow-lg hover:shadow-xl`}
            >
              {uploadStatus === "loading" ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Checking Google Sheets... ({forceAttempt}/{FORCE_RETRIES})</span>
                </div>
              ) : uploadStatus === "success" ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Latest data received!</span>
                </div>
              ) : uploadStatus === "stale" || uploadStatus === "error" ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{uploadStatus === "stale" ? "No new data — Retry" : "Connection failed — Retry"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span>Upload Data from Device</span>
                </div>
              )}
            </Button>

            <div className="text-center space-y-1">
              {reading && (
                <p className="text-xs text-gray-500">
                  Last reading: <span className="font-medium text-gray-700">{reading.time}</span>
                  {ageText ? ` (${ageText})` : ""}
                </p>
              )}
              {uploadStatus === "stale" && (
                <p className="text-xs text-amber-600">
                  The newest row in Google Sheets is old. Check that the ESP32 is powered and connected to WiFi.
                </p>
              )}
              {uploadStatus === "error" && (
                <p className="text-xs text-red-600">
                  Could not read Google Sheets. Check your internet connection and that the sheet is public.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Buy Device Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowBuyModal(false)}
          />
          <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6">
              <button
                onClick={() => setShowBuyModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-white text-xl font-bold">Smart Energy Device</h2>
                  <p className="text-indigo-200 text-sm">VEAM IoT Monitor</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-gray-600 text-sm leading-relaxed">
                A smart device that monitors your home energy consumption in real time using AI — detects which appliances are running and predicts your monthly bill.
              </p>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Features</p>
                {deviceFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <f.icon className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-700">{f.text}</span>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">Price</span>
                <div className="text-right">
                  <span className="text-2xl font-bold text-indigo-600">3990</span>
                  <span className="text-sm font-medium text-indigo-400 ml-1">DA</span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  onClick={() => window.open("https://veam-store.vercel.app", "_blank")}
                  className="flex-1 h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 transition-all duration-300"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Order Now
                </Button>
                <Button
                  onClick={() => setShowBuyModal(false)}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl font-medium border-gray-200 hover:bg-gray-50 transition-all duration-300"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
