import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  Legend, ReferenceLine, ComposedChart, Area,
} from "recharts";
import {
  TrendingUp, BarChart3, Zap, Clock, Database,
  RefreshCw, Activity, Brain, Sparkles, Volume2,
} from "lucide-react";

const SHEET_ID = "1g9XRplcjctpLaOnxmsy7C_0o8dc9Yy4-Zny6m7XSyXg";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

type FilterType = "day" | "week" | "month";

interface RawRow {
  time: string;
  voltage: number;
  current: number;
  power: number;
  powerFactor: number;
  frequency: number;
}

// ── Parse CSV from Google Sheets ─────────────────────────────────────────────
function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split("\n");
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.replace(/"/g, "").trim());
    if (cols.length >= 6) {
      rows.push({
        time:        cols[0],
        voltage:     parseFloat(cols[1]) || 0,
        current:     parseFloat(cols[2]) || 0,
        power:       parseFloat(cols[3]) || 0,
        powerFactor: parseFloat(cols[4]) || 0,
        frequency:   parseFloat(cols[5]) || 0,
      });
    }
  }
  return rows;
}

// ── Get day key from timestamp ───────────────────────────────────────────────
function getDayKey(t: string): string {
  if (t.length >= 10 && t.includes("-")) return t.substring(0, 10);
  return t;
}

// ── Helper: extract hour 0-23 from any timestamp format ──────────────────────
function getHour(t: string): number {
  const parts = t.trim().split(" ");
  const timePart = parts.length >= 2 ? parts[1] : parts[0];
  return parseInt(timePart.substring(0, 2), 10) || 0;
}

// ── Build Energy vs Time data ─────────────────────────────────────────────────
function buildEnergyChart(rows: RawRow[], filter: FilterType) {
  if (rows.length === 0) return [];

  const allDays = Array.from(new Set(rows.map(r => getDayKey(r.time)))).sort();

  if (filter === "day") {
    // Pick day with most records (most complete day)
    const dayCounts: Record<string, number> = {};
    rows.forEach(r => { const dk = getDayKey(r.time); dayCounts[dk] = (dayCounts[dk] || 0) + 1; });
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? allDays[allDays.length - 1];
    const dayRows = rows.filter(r => getDayKey(r.time) === bestDay);
    const hourMap: Record<number, number[]> = {};
    dayRows.forEach(r => {
      const h = getHour(r.time);
      if (!hourMap[h]) hourMap[h] = [];
      hourMap[h].push(r.power);
    });
    return Array.from({ length: 24 }, (_, i) => {
      const vals = hourMap[i] || [];
      return {
        time: String(i).padStart(2, "0") + ":00",
        power: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      };
    });
  }

  if (filter === "week") {
    const last7 = allDays.slice(-7);
    return last7.map(day => {
      const dayRows = rows.filter(r => getDayKey(r.time) === day);
      const avg = dayRows.reduce((s, r) => s + r.power, 0) / dayRows.length;
      return { time: day.substring(5), power: Math.round(avg) };
    });
  }

  // month — each day is one point (max 30 days)
  const last30 = allDays.slice(-30);
  return last30.map(day => {
    const dayRows = rows.filter(r => getDayKey(r.time) === day);
    if (dayRows.length === 0) return { time: day.substring(5), power: null };
    const avg = dayRows.reduce((s, r) => s + r.power, 0) / dayRows.length;
    return { time: day.substring(5), power: Math.round(avg) };
  });
}

// ── Build Peak Consumption data ───────────────────────────────────────────────
function buildPeakChart(rows: RawRow[], filter: FilterType) {
  if (rows.length === 0) return [];

  const allDays = Array.from(new Set(rows.map(r => getDayKey(r.time)))).sort();

  if (filter === "day") {
    const dayCounts: Record<string, number> = {};
    rows.forEach(r => { const dk = getDayKey(r.time); dayCounts[dk] = (dayCounts[dk] || 0) + 1; });
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? allDays[allDays.length - 1];
    const dayRows = rows.filter(r => getDayKey(r.time) === bestDay);
    const hourMap: Record<number, number[]> = {};
    dayRows.forEach(r => {
      const h = getHour(r.time);
      if (!hourMap[h]) hourMap[h] = [];
      hourMap[h].push(r.power);
    });
    return Array.from({ length: 24 }, (_, i) => {
      const vals = hourMap[i] || [];
      return { hour: String(i).padStart(2, "0") + ":00", consumption: vals.length ? Math.round(Math.max(...vals)) : 0 };
    });
  }

  if (filter === "week") {
    const last7 = allDays.slice(-7);
    return last7.map(day => {
      const dayRows = rows.filter(r => getDayKey(r.time) === day);
      const peak = dayRows.length ? Math.max(...dayRows.map(r => r.power)) : 0;
      return { hour: day.substring(5), consumption: peak };
    });
  }

  // month — each day one point (max 30 days)
  const last30 = allDays.slice(-30);
  return last30.map(day => {
    const dayRows = rows.filter(r => getDayKey(r.time) === day);
    if (dayRows.length === 0) return { hour: day.substring(5), consumption: 0 };
    // Use sampled max to avoid Math.max crash on large arrays
    let peak = 0;
    for (const r of dayRows) { if (r.power > peak) peak = r.power; }
    return { hour: day.substring(5), consumption: peak };
  });
}

// ── Build Voltage & Power Factor chart ────────────────────────────────────────
function buildVoltageChart(rows: RawRow[], filter: FilterType) {
  if (rows.length === 0) return [];

  const allDays = Array.from(new Set(rows.map(r => getDayKey(r.time)))).sort();

  if (filter === "day") {
    const dayCounts: Record<string, number> = {};
    rows.forEach(r => { const dk = getDayKey(r.time); dayCounts[dk] = (dayCounts[dk] || 0) + 1; });
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? allDays[allDays.length - 1];
    const dayRows = rows.filter(r => getDayKey(r.time) === bestDay);
    const hourMap: Record<number, { v: number[]; pf: number[] }> = {};
    dayRows.forEach(r => {
      const h = getHour(r.time);
      if (!hourMap[h]) hourMap[h] = { v: [], pf: [] };
      hourMap[h].v.push(r.voltage);
      hourMap[h].pf.push(r.powerFactor);
    });
    return Array.from({ length: 24 }, (_, i) => {
      const d = hourMap[i];
      if (!d || d.v.length === 0) return { time: String(i).padStart(2, "0") + ":00", voltage: null, pf: null };
      return {
        time: String(i).padStart(2, "0") + ":00",
        voltage: parseFloat((d.v.reduce((a, b) => a + b, 0) / d.v.length).toFixed(1)),
        pf: parseFloat((d.pf.reduce((a, b) => a + b, 0) / d.pf.length).toFixed(3)),
      };
    });
  }

  if (filter === "week") {
    return allDays.slice(-7).map(day => {
      const dr = rows.filter(r => getDayKey(r.time) === day);
      return {
        time: day.substring(5),
        voltage: parseFloat((dr.reduce((s, r) => s + r.voltage, 0) / dr.length).toFixed(1)),
        pf: parseFloat((dr.reduce((s, r) => s + r.powerFactor, 0) / dr.length).toFixed(3)),
      };
    });
  }

  // month — each day one point (max 30 days, sampled for performance)
  return allDays.slice(-30).map(day => {
    const dr = rows.filter(r => getDayKey(r.time) === day);
    if (dr.length === 0) return { time: day.substring(5), voltage: null, pf: null };
    // Sample every Nth row to keep computation light
    const step = Math.max(1, Math.floor(dr.length / 20));
    const sampled = dr.filter((_, i) => i % step === 0);
    return {
      time: day.substring(5),
      voltage: parseFloat((sampled.reduce((s, r) => s + r.voltage, 0) / sampled.length).toFixed(1)),
      pf: parseFloat((sampled.reduce((s, r) => s + r.powerFactor, 0) / sampled.length).toFixed(3)),
    };
  });
}

// ── Stats summary ─────────────────────────────────────────────────────────────
function buildStats(rows: RawRow[], filter: FilterType) {
  if (rows.length === 0) return null;
  const allDays = Array.from(new Set(rows.map(r => getDayKey(r.time)))).sort();
  let filtered = rows;
  if (filter === "day") {
    const lastDay = allDays[allDays.length - 1];
    filtered = rows.filter(r => getDayKey(r.time) === lastDay);
  } else if (filter === "week") {
    const last7 = allDays.slice(-7);
    filtered = rows.filter(r => last7.includes(getDayKey(r.time)));
  } else {
    const last30 = allDays.slice(-30);
    const allFiltered = rows.filter(r => last30.includes(getDayKey(r.time)));
    // Sample for performance: max 500 rows for stats
    const step = Math.max(1, Math.floor(allFiltered.length / 500));
    filtered = allFiltered.filter((_, i) => i % step === 0);
  }
  if (filtered.length === 0) return null;
  const avgPower  = Math.round(filtered.reduce((s, r) => s + r.power, 0) / filtered.length);
  const peakPower = Math.round(Math.max(...filtered.map(r => r.power)));
  const avgV      = parseFloat((filtered.reduce((s, r) => s + r.voltage, 0) / filtered.length).toFixed(1));
  const avgPF     = parseFloat((filtered.reduce((s, r) => s + r.powerFactor, 0) / filtered.length).toFixed(2));
  const kWhDay    = parseFloat(((avgPower * 24) / 1000).toFixed(2));
  return { avgPower, peakPower, avgV, avgPF, kWhDay };
}

export default function GraphsAnalysis() {
  const [filter, setFilter]   = useState<FilterType>("day");

  // ── Groq AI insights ──────────────────────────────────────────────────────
  const [aiEnergy,        setAiEnergy]        = useState<string>("");
  const [aiPeak,          setAiPeak]          = useState<string>("");
  const [aiVolt,          setAiVolt]          = useState<string>("");
  const [loadingAiEnergy, setLoadingAiEnergy] = useState(false);
  const [loadingAiPeak,   setLoadingAiPeak]   = useState(false);
  const [loadingAiVolt,   setLoadingAiVolt]   = useState(false);
  const [rows, setRows]       = useState<RawRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [error, setError]     = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(SHEET_URL);
      const text = await res.text();
      const data = parseCSV(text);
      if (data.length === 0) throw new Error("No data");
      setRows(data);
      setLoaded(true);
    } catch {
      setError("Failed to load data. Check that the Google Sheet is public.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Groq AI call (via existing /api/gemini endpoint) ──────────────────────
  const askGroq = async (
    prompt: string,
    setter: (v: string) => void,
    loadSetter: (v: boolean) => void
  ) => {
    loadSetter(true);
    setter("");
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      setter(json.text || "Unable to generate explanation.");
    } catch {
      setter("Could not connect to AI. Please try again.");
    } finally {
      loadSetter(false);
    }
  };

  // ── TTS helper ────────────────────────────────────────────────────────────
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const explainEnergy = () => {
    if (!stats) return;
    const period = filter === "day" ? "today" : filter === "week" ? "the last 7 days" : "the last 30 days";
    const trend = stats.avgPower > 1500 ? "high" : stats.avgPower > 800 ? "moderate" : "low";
    askGroq(
      `You are a friendly energy assistant for a simple Algerian citizen who does not have technical knowledge.
Write 2-3 short, warm sentences explaining their energy consumption for ${period}.
Facts: average power = ${stats.avgPower}W, peak = ${stats.peakPower}W, daily energy = ${stats.kWhDay} kWh, consumption level is ${trend}.
Rules: DO NOT mention any appliances or devices. Only talk about the consumption level (high, normal, or low) and whether it is good or needs attention. Be simple, clear, and encouraging. No bullet points. No technical terms.`,
      setAiEnergy, setLoadingAiEnergy
    );
  };

  const explainPeak = () => {
    if (!stats || peakData.length === 0) return;
    const period = filter === "day" ? "today by hour" : filter === "week" ? "the last 7 days" : "the last 30 days";
    const maxEntry = peakData.reduce((a, b) => ((b.consumption || 0) > (a.consumption || 0) ? b : a), peakData[0]);
    const aboveCount = peakData.filter(d => (d.consumption || 0) > peakThresh).length;
    askGroq(
      `You are a friendly energy assistant for a simple Algerian citizen who does not have technical knowledge.
Write 2-3 short sentences explaining their peak consumption chart for ${period}.
Facts: highest consumption = ${maxEntry.consumption}W at ${maxEntry.hour}, number of periods above normal = ${aboveCount} out of ${peakData.length}.
Rules: DO NOT mention any appliances or devices. Focus only on when consumption was highest and whether the user should be concerned. Be simple, warm, and practical. No bullet points. No technical terms.`,
      setAiPeak, setLoadingAiPeak
    );
  };

  const explainVolt = () => {
    if (!stats) return;
    const period = filter === "day" ? "today" : filter === "week" ? "the last 7 days" : "the last 30 days";
    const voltStatus = stats.avgV >= 220 && stats.avgV <= 240 ? "normal" : stats.avgV < 220 ? "slightly low" : "slightly high";
    const pfStatus = stats.avgPF >= 0.95 ? "excellent" : stats.avgPF >= 0.85 ? "acceptable" : "poor";
    askGroq(
      `You are a friendly energy assistant for a simple Algerian citizen who does not have technical knowledge.
Write 2-3 short sentences explaining the electrical quality indicators for ${period}.
Facts: average voltage = ${stats.avgV}V (status: ${voltStatus}, normal in Algeria is 220-240V), power factor = ${stats.avgPF} (status: ${pfStatus}).
Rules: Explain voltage like water pressure in pipes — too low or too high is not good. Explain power factor as how efficiently electricity is being used. DO NOT mention any appliances or devices. Be reassuring if values are good, or gently warn if they need attention. No bullet points. No technical terms.`,
      setAiVolt, setLoadingAiVolt
    );
  };

  const energyData = buildEnergyChart(rows, filter);
  const peakData   = buildPeakChart(rows, filter);
  const voltData   = buildVoltageChart(rows, filter);
  const stats      = buildStats(rows, filter);

  const filterButtons: { label: string; value: FilterType }[] = [
    { label: "Day",    value: "day"   },
    { label: "7 Days", value: "week"  },
    { label: "Month",  value: "month" },
  ];

  const yUnit = "W";
  // Threshold adapts to filter: day=2000W, week=avg daily peak, month=avg daily peak
  const peakThresh = (() => {
    if (filter === "day") return 2000;
    if (peakData.length === 0) return 2000;
    const avg = Math.round(peakData.reduce((s, d) => s + (d.consumption || 0), 0) / peakData.length);
    return Math.round(avg * 1.2); // 20% above average = threshold
  })();

  const pfColor = (pf: number) =>
    pf >= 0.95 ? "#22c55e" : pf >= 0.85 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Graphs & Analysis</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real data from your energy meter</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Reload */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* Filter pills */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {filterButtons.map(btn => (
              <button
                key={btn.value}
                onClick={() => { setFilter(btn.value); setAiEnergy(""); setAiPeak(""); setAiVolt(""); }}
                className={
                  "flex items-center gap-1 rounded-md px-3 h-8 text-xs font-medium transition-all " +
                  (filter === btn.value
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200")
                }
              >
                <Clock className="w-3 h-3" />
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      {loading && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-500">Loading data from Google Sheets...</p>
        </div>
      )}
      {error && <p className="text-xs text-red-500 px-1">{error}</p>}
      {loaded && !loading && (
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-xs text-green-600 font-medium">
            Live data — {rows.length} records ·{" "}
            {filter === "day" ? "Last 24h" : filter === "week" ? "Last 7 days" : "Last 30 days"}
          </p>
        </div>
      )}

      {/* ── Stats row ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Avg Power",   value: stats.avgPower + " W",    color: "text-indigo-600",  icon: Zap      },
            { label: "Peak Power",  value: stats.peakPower + " W",   color: "text-red-500",     icon: TrendingUp },
            { label: "Daily kWh",   value: stats.kWhDay + " kWh",    color: "text-amber-600",   icon: BarChart3 },
            { label: "Avg Voltage", value: stats.avgV + " V",        color: "text-blue-600",    icon: Activity  },
            { label: "Power Factor",value: stats.avgPF.toString(),   color: stats.avgPF >= 0.95 ? "text-green-600" : stats.avgPF >= 0.85 ? "text-amber-600" : "text-red-500", icon: Activity },
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm shadow-gray-100">
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
                <div>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Energy vs Time ── */}
      <Card className="border-0 shadow-md shadow-gray-100">
        <CardHeader className="pb-2 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">Energy vs Time</CardTitle>
            <p className="text-xs text-gray-400">
              {filter === "day"   ? "Hourly average power — Last day"
              : filter === "week" ? "Daily average power — Last 7 days"
              :                    "Weekly average power — Last 30 days"}
            </p>
          </div>
          {loaded && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full bg-green-50 text-green-600">
              Real ●
            </span>
          )}
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={energyData} margin={{ top: 5, right: 10, left: -10, bottom: filter === "month" ? 20 : 5 }}>
                <defs>
                  <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="#6366F1" />
                    <stop offset="100%" stopColor="#8B5CF6" />
                  </linearGradient>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#8B5CF6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 9, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  interval={filter === "day" ? 2 : filter === "week" ? 0 : 4}
                  angle={filter === "month" ? -35 : 0}
                  textAnchor={filter === "month" ? "end" : "middle"}
                  height={filter === "month" ? 40 : 20}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94A3B8" }}
                  tickLine={false}
                  axisLine={{ stroke: "#E2E8F0" }}
                  unit={yUnit}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px" }}
                  formatter={(v: number, name: string) => name === "areaFill" ? null : [`${v} ${yUnit}`, "Avg Power"]}
                />
                <Area
                  type="monotone"
                  dataKey="power"
                  name="areaFill"
                  stroke="none"
                  fill="url(#areaGrad)"
                  connectNulls
                  dot={false}
                  activeDot={false}
                  legendType="none"
                />
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="url(#lineGrad)"
                  strokeWidth={2.5}
                  dot={filter !== "day"}
                  connectNulls
                  activeDot={{ r: 5, fill: "#6366F1", stroke: "#fff", strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* AI: Energy explanation */}
          {loaded && stats && (
            <div className="mt-3 p-3 rounded-xl flex items-start gap-2" style={{background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.15)"}}>
              <Brain className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                {aiEnergy ? (
                  <div className="flex items-start gap-1.5">
                    <p className="text-[11px] text-gray-700 leading-relaxed flex-1">{aiEnergy}</p>
                    <button onClick={() => speak(aiEnergy)} className="flex-shrink-0 mt-0.5 text-indigo-400 hover:text-indigo-600 transition-colors" title="Read aloud">
                      <Volume2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400">
                    {loadingAiEnergy ? "⏳ Analyzing your consumption..." : "Tap to understand this chart in simple words."}
                  </p>
                )}
              </div>
              <button
                onClick={explainEnergy}
                disabled={loadingAiEnergy}
                className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full text-indigo-500 hover:text-indigo-400 transition-colors disabled:opacity-50 whitespace-nowrap" style={{background:"rgba(99,102,241,0.12)"}}
              >
                {loadingAiEnergy ? "..." : aiEnergy ? "↺" : "✨ Explain"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Peak + Voltage row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Peak Consumption */}
        <Card className="border-0 shadow-md shadow-gray-100">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">Peak Consumption</CardTitle>
              <p className="text-xs text-gray-400">
                {filter === "day" ? "Max power per hour" : filter === "week" ? "Daily peak — 7 days" : "Weekly peak — 30 days"}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakData} margin={{ top: 5, right: 10, left: -10, bottom: filter === "month" ? 20 : 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 9, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    interval={filter === "day" ? 2 : filter === "week" ? 0 : 4}
                    angle={filter === "month" ? -35 : 0}
                    textAnchor={filter === "month" ? "end" : "middle"}
                    height={filter === "month" ? 40 : 20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    unit="W"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px" }}
                    formatter={(v: number) => [`${v} W`, "Peak Power"]}
                  />
                  <ReferenceLine y={peakThresh} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Threshold", fontSize: 9, fill: "#f59e0b", position: "insideTopRight" }} />
                  <Bar dataKey="consumption" radius={[4, 4, 0, 0]}>
                    {peakData.map((entry, i) => (
                      <Cell key={i} fill={entry.consumption > peakThresh ? "#dc2626" : "#22c55e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 px-1">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-500" /><span className="text-[10px] text-gray-500">Normal</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-600" /><span className="text-[10px] text-gray-500">High ({peakThresh}W+)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-amber-400" style={{borderTop:"2px dashed #f59e0b"}} /><span className="text-[10px] text-gray-500">Threshold</span></div>
            </div>

            {/* AI: Peak explanation */}
            {loaded && stats && (
              <div className="mt-3 p-3 rounded-xl flex items-start gap-2" style={{background:"rgba(168,85,247,0.08)", border:"1px solid rgba(168,85,247,0.15)"}}>
                <Brain className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {aiPeak ? (
                    <div className="flex items-start gap-1.5">
                      <p className="text-[11px] text-gray-700 leading-relaxed flex-1">{aiPeak}</p>
                      <button onClick={() => speak(aiPeak)} className="flex-shrink-0 mt-0.5 text-purple-400 hover:text-purple-600 transition-colors" title="Read aloud">
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      {loadingAiPeak ? "⏳ Analyzing..." : "Tap to understand your peak consumption."}
                    </p>
                  )}
                </div>
                <button
                  onClick={explainPeak}
                  disabled={loadingAiPeak}
                  className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full text-purple-500 hover:text-purple-400 transition-colors disabled:opacity-50 whitespace-nowrap" style={{background:"rgba(168,85,247,0.12)"}}
                >
                  {loadingAiPeak ? "..." : aiPeak ? "↺" : "✨ Explain"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voltage & Power Factor */}
        <Card className="border-0 shadow-md shadow-gray-100">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">Voltage & Power Factor</CardTitle>
              <p className="text-xs text-gray-400">Grid quality indicators</p>
            </div>
            {stats && (
              <span
                className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-full"
                style={{ background: pfColor(stats.avgPF) + "18", color: pfColor(stats.avgPF) }}
              >
                PF {stats.avgPF}
              </span>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={voltData} margin={{ top: 5, right: 20, left: -10, bottom: filter === "month" ? 20 : 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 9, fill: "#94A3B8" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E2E8F0" }}
                    interval={filter === "day" ? 3 : filter === "week" ? 0 : 4}
                    angle={filter === "month" ? -35 : 0}
                    textAnchor={filter === "month" ? "end" : "middle"}
                    height={filter === "month" ? 40 : 20}
                  />
                  <YAxis
                    yAxisId="v"
                    tick={{ fontSize: 10, fill: "#3b82f6" }}
                    tickLine={false}
                    axisLine={false}
                    unit="V"
                    domain={["auto", "auto"]}
                  />
                  <YAxis
                    yAxisId="pf"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#22c55e" }}
                    tickLine={false}
                    axisLine={false}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "10px 14px" }}
                    formatter={(v: number, name: string) =>
                      name === "voltage" ? [`${v} V`, "Voltage"] : [`${v}`, "Power Factor"]
                    }
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(val) => <span style={{ fontSize: 10, color: "#64748b" }}>{val === "voltage" ? "Voltage (V)" : "Power Factor"}</span>}
                  />
                  {filter === "day" && <ReferenceLine yAxisId="v" y={220} stroke="#f59e0b" strokeDasharray="3 3" />}
                  {filter === "day" && <ReferenceLine yAxisId="v" y={240} stroke="#f59e0b" strokeDasharray="3 3" />}
                  <Line yAxisId="v"  type="monotone" dataKey="voltage" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} />
                  <Line yAxisId="pf" type="monotone" dataKey="pf"      stroke="#22c55e" strokeWidth={2} dot={false} connectNulls activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.15)"}}>
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <div>
                  <p className="text-[10px] text-gray-400">Avg Voltage</p>
                  <p className="text-xs font-bold text-blue-600">{stats?.avgV ?? "—"} V</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg" style={{background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.15)"}}>
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-[10px] text-gray-400">Power Factor</p>
                  <p className="text-xs font-bold" style={{ color: stats ? pfColor(stats.avgPF) : "#94a3b8" }}>
                    {stats?.avgPF ?? "—"} {stats && stats.avgPF >= 0.95 ? "✅ Good" : stats && stats.avgPF >= 0.85 ? "⚠️ Fair" : "❌ Poor"}
                  </p>
                </div>
              </div>
            </div>

            {/* AI: Voltage explanation */}
            {loaded && stats && (
              <div className="mt-3 p-3 rounded-xl flex items-start gap-2" style={{background:"rgba(6,182,212,0.08)", border:"1px solid rgba(6,182,212,0.15)"}}>
                <Brain className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  {aiVolt ? (
                    <div className="flex items-start gap-1.5">
                      <p className="text-[11px] text-gray-700 leading-relaxed flex-1">{aiVolt}</p>
                      <button onClick={() => speak(aiVolt)} className="flex-shrink-0 mt-0.5 text-cyan-400 hover:text-cyan-600 transition-colors" title="Read aloud">
                        <Volume2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      {loadingAiVolt ? "⏳ Analyzing..." : "Tap to understand your voltage & power quality."}
                    </p>
                  )}
                </div>
                <button
                  onClick={explainVolt}
                  disabled={loadingAiVolt}
                  className="flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full text-cyan-500 hover:text-cyan-400 transition-colors disabled:opacity-50 whitespace-nowrap" style={{background:"rgba(6,182,212,0.12)"}}
                >
                  {loadingAiVolt ? "..." : aiVolt ? "↺" : "✨ Explain"}
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── No data state ── */}
      {!loaded && !loading && !error && (
        <Card className="border-0 shadow-sm border-dashed border-gray-200">
          <CardContent className="py-10 flex flex-col items-center gap-3">
            <Database className="w-8 h-8 text-gray-300" />
            <p className="text-sm text-gray-400">Connecting to Google Sheets...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
