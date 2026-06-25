import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain,
  TrendingDown,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  CircleDollarSign,
  Info,
  ChevronRight,
  Leaf,
  Car,
  Flame,
  BarChart2,
  Clock,
  Zap,
  Database,
  Search,
  Home,
  Plus,
  X,
  Volume2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getAIPredictions } from "@/lib/mockData";

const SHEET_ID = "1g9XRplcjctpLaOnxmsy7C_0o8dc9Yy4-Zny6m7XSyXg";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

// ─── Default appliances list ──────────────────────────────────────────────────
const DEFAULT_APPLIANCES = [
  { id: "fridge",   label: "Refrigerator",    icon: "🧊", selected: true,  count: 1, dailyHours: 24, usageTime: "24/7" },
  { id: "ac",       label: "Air Conditioner",  icon: "❄️", selected: true,  count: 1, dailyHours: 8,  usageTime: "Afternoon/Night" },
  { id: "heater",   label: "Water Heater",     icon: "🔥", selected: true,  count: 1, dailyHours: 4,  usageTime: "Morning/Night" },
  { id: "washing",  label: "Washing Machine",  icon: "🫧", selected: false, count: 1, dailyHours: 1,  usageTime: "Morning" },
  { id: "tv",       label: "TV",               icon: "📺", selected: true,  count: 1, dailyHours: 5,  usageTime: "Evening/Night" },
  { id: "light",    label: "Lighting",         icon: "💡", selected: true,  count: 1, dailyHours: 6,  usageTime: "Evening/Night" },
  { id: "micro",    label: "Microwave",        icon: "📡", selected: false, count: 1, dailyHours: 1,  usageTime: "Meal Times" },
  { id: "oven",     label: "Oven",             icon: "🍳", selected: false, count: 1, dailyHours: 1,  usageTime: "Afternoon" },
  { id: "pc",       label: "Computer / PC",    icon: "💻", selected: false, count: 1, dailyHours: 8,  usageTime: "Morning/Afternoon" },
  { id: "dryer",    label: "Hair Dryer",       icon: "💨", selected: false, count: 1, dailyHours: 0.2, usageTime: "Morning" },
];

function AnimatedValue({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);
  return <span>{count.toLocaleString()}</span>;
}

interface SheetAnalysis {
  totalEnergy: number;
  avgPower: number;
  peakPower: number;
  peakTime: string;
  estimatedBill: number;
  estimatedSavings: number;
  co2Kg: number;
  carKm: number;
  topDevices: { name: string; power: number; percentage: number }[];
  recommendations: { icon: string; title: string; description: string; savings: number }[];
  rowCount: number;
  rawRows: { time: string; voltage: number; current: number; power: number; powerFactor: number; frequency: number }[];
}

interface NILMDevice {
  region: string;
  percentage: number;
  avgPower: number;
  detectedDevices: string;
  confidence: string;
}

export default function AIPrediction() {
  const predictions = getAIPredictions();
  const [visibleCards, setVisibleCards] = useState(0);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetData, setSheetData] = useState<SheetAnalysis | null>(null);
  const [sheetError, setSheetError] = useState("");
  const [aiInsight, setAiInsight] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  // Billing period toggle
  const [billingPeriod, setBillingPeriod] = useState<1 | 2>(1);

  // NILM states
  const [nilmDevices, setNilmDevices] = useState<NILMDevice[]>([]);
  const [loadingNILM, setLoadingNILM] = useState(false);

  // User appliances state
  const [appliances, setAppliances] = useState(DEFAULT_APPLIANCES);
  const [customInput, setCustomInput] = useState("");
  const [showAppliancePanel, setShowAppliancePanel] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisibleCards((prev) => {
        if (prev >= recs.length) { clearInterval(timer); return prev; }
        return prev + 1;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [recs.length]);

  const toggleAppliance = (id: string) => {
    setAppliances(prev => prev.map(a => a.id === id ? { ...a, selected: !a.selected } : a));
  };

  const addCustomAppliance = () => {
    const name = customInput.trim();
    if (!name) return;
    setAppliances(prev => [...prev, { id: `custom_${Date.now()}`, label: name, icon: "🔌", selected: true, count: 1, dailyHours: 2, usageTime: "Variable" }]);
    setCustomInput("");
  };

  const removeAppliance = (id: string) => {
    setAppliances(prev => prev.filter(a => a.id !== id));
  };

  const updateCount = (id: string, delta: number) => {
    setAppliances(prev => prev.map(a =>
      a.id === id ? { ...a, count: Math.max(1, Math.min(9, (a.count ?? 1) + delta)) } : a
    ));
  };

  const updateHours = (id: string, val: string) => {
    const h = parseFloat(val);
    if (!isNaN(h) && h >= 0 && h <= 24) {
      setAppliances(prev => prev.map(a =>
        a.id === id ? { ...a, dailyHours: h } : a
      ));
    }
  };

  // Build appliance list with counts for NILM prompt
  const selectedAppliances = appliances
    .filter(a => a.selected)
    .flatMap(a => Array((a.count ?? 1)).fill(a.label));

  const askGemini = async (data: SheetAnalysis) => {
    setLoadingAI(true);
    setAiInsight("");
    try {
      const prompt = `You are an expert energy consultant specializing in Algerian household electricity consumption and Sonelgaz tariff structures.

Analyze this home energy data and provide smart, actionable recommendations in clear English:
- Daily energy consumption: ${data.totalEnergy} kWh
- Peak power recorded: ${data.peakPower}W at ${data.peakTime}
- Highest consuming zone: ${data.topDevices[0]?.name} (${data.topDevices[0]?.percentage}% of total time)
- Estimated bill: ${data.estimatedBill} DA
- CO₂ footprint: ${data.co2Kg} kg/month

Important context — Sonelgaz Tariff Rules:
• Sonelgaz applies a HIGHER electricity tariff during peak demand hours: 17:00 to 21:00 every day.
• Running high-power appliances (washing machine, oven, iron, water heater, air conditioner) during this window significantly increases the bill.
• Outside this window (before 17:00 or after 21:00), the standard lower tariff applies.
• Electricity tranches are fixed: 0–125 kWh at 1.7787 DA/kWh, 125–250 kWh at 4.1789 DA/kWh, 250–1000 kWh at 4.8120 DA/kWh.

Provide exactly 3 recommendations. Each must be specific, practical, and reference real Sonelgaz tariff logic where relevant. Format as bullet points. Be concise but impactful.`;

     const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const json = await res.json();
    const text = json.text || "No response";
      setAiInsight(text);
    } catch {
      setAiInsight("Failed to get AI response.");
    } finally {
      setLoadingAI(false);
    }
  };

  // ─── NILM: User-Informed — uses selected appliances to constrain detection ──
  const runNILM = async (rows: SheetAnalysis["rawRows"]) => {
    setLoadingNILM(true);
    setNilmDevices([]);
    try {
      const regions = [
        { region: "Region A", min: 0,    max: 400   },
        { region: "Region B", min: 400,  max: 800   },
        { region: "Region C", min: 800,  max: 1200  },
        { region: "Region D", min: 1200, max: 1700  },
        { region: "Region E", min: 1700, max: 99999 },
      ];

      const regionStats = regions.map(r => {
        const matched = rows.filter(row => row.power >= r.min && row.power < r.max);
        if (matched.length === 0) return null;
        const avgPower = Math.round(matched.reduce((s, x) => s + x.power, 0) / matched.length);
        const avgCurrent = parseFloat((matched.reduce((s, x) => s + x.current, 0) / matched.length).toFixed(2));
        const avgPF = parseFloat((matched.reduce((s, x) => s + x.powerFactor, 0) / matched.length).toFixed(2));
        const percentage = Math.round((matched.length / rows.length) * 100);
        return { region: r.region, avgPower, avgCurrent, avgPF, percentage };
      }).filter(Boolean);

      // Build prompt — constrained by user's selected appliances
      const applianceWithCounts = appliances
        .filter(a => a.selected)
        .map(a => (a.count ?? 1) > 1 ? a.label + " x" + (a.count ?? 1) : a.label)
        .join(", ");

      const applianceList = selectedAppliances.length > 0
        ? "The user confirmed these appliances exist in their home: " + applianceWithCounts + ". Daily usage: " + appliances.filter(a => a.selected).map(a => a.label + " ~" + (a.dailyHours ?? 2) + "h/day (" + (a.usageTime ?? "Variable") + ")").join(", ") + ". Only suggest devices from this list. Consider quantity and usage patterns. Do not suggest unlisted appliances."
        : "No appliance list provided. Use general knowledge to identify likely devices.";

      const prompt = `You are an energy analysis expert performing NILM-inspired appliance inference from real home electrical data.
${applianceList}

REAL APPLIANCE POWER REFERENCE (use this to match regions accurately):
- Standby/LED lights: 5–30W
- Phone charger, router: 5–20W
- Refrigerator (normal): 80–200W
- TV (LED 40"): 80–150W
- Laptop: 40–80W
- Desktop PC: 150–300W
- Fan: 40–100W
- Printer: 300–500W
- Microwave (low): 400–700W
- Washing machine (standby/rinse): 400–600W
- Iron: 1000–2400W
- Microwave (full power): 800–1200W
- Vacuum cleaner: 800–1200W
- Water heater (small): 800–1500W
- Oven / Electric stove: 1000–2000W
- Washing machine (heating cycle): 1500–2000W
- Air conditioner (1.5–2 HP): 1200–2000W
- Space heater: 1500–2500W
- Water pump: 1500–3000W

IMPORTANT RULES:
- Match each region to the appliance(s) whose NORMAL power consumption fits the avgPower of that region.
- Do NOT assign a refrigerator to a region above 300W unless no other match exists.
- Each appliance should appear in ONLY ONE region (best match). Do not repeat.
- Consider timeShare: high timeShare (>20%) means always-on devices (fridge, standby). Low timeShare (<10%) means occasional use (AC, oven).
- For each region suggest 1 main appliance. Add a 2nd only if clearly different usage pattern.
- Assign confidence: High (strong match), Medium (possible), Low (uncertain).

Reply ONLY with a JSON array, no extra text, no markdown:
[
  { "region": "Region A", "detectedDevices": "Refrigerator, Standby devices", "confidence": "High" },
  ...
]

Electrical signatures from real home meter:
${regionStats.map(r => `${r?.region}: avgPower=${r?.avgPower}W, avgCurrent=${r?.avgCurrent}A, powerFactor=${r?.avgPF}, timeShare=${r?.percentage}%`).join("\n")}`;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      const text = json.text || "[]";

      let parsed: { region: string; detectedDevices: string; confidence: string }[] = [];
      try {
        const clean = text.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = [];
      }

      const result: NILMDevice[] = regionStats.map(r => {
        const match = parsed.find(p => p.region === r?.region);
        return {
          region: r?.region ?? "",
          percentage: r?.percentage ?? 0,
          avgPower: r?.avgPower ?? 0,
          detectedDevices: match?.detectedDevices ?? "Unknown",
          confidence: match?.confidence ?? "Low",
        };
      });

      setNilmDevices(result);
    } catch {
      setNilmDevices([]);
    } finally {
      setLoadingNILM(false);
    }
  };


  // ── Sonelgaz tarification — tranches FIXES (vérifiées sur facture réelle) ──
  const calcSonelgazBill = (dailyKwh: number, days: number): number => {
    const totalKwh = dailyKwh * days;
    // Tranche limits are FIXED — not scaled by days (verified on real Sonelgaz bill)
    const T1 = 125;   // 0 – 125 kWh
    const T2 = 250;   // 125 – 250 kWh
    const T3 = 1000;  // 250 – 1000 kWh
    let bill = 0;
    if (totalKwh <= T1) {
      bill = totalKwh * 1.7787;
    } else if (totalKwh <= T2) {
      bill = T1 * 1.7787 + (totalKwh - T1) * 4.1789;
    } else if (totalKwh <= T3) {
      bill = T1 * 1.7787 + T1 * 4.1789 + (totalKwh - T2) * 4.8120;
    } else {
      bill = T1 * 1.7787 + T1 * 4.1789 + (T3 - T2) * 4.8120 + (totalKwh - T3) * 5.48;
    }
    return Math.round(bill);
  };

  const analyzeSheet = async () => {
    setLoadingSheet(true);
    setSheetError("");
    setSheetData(null);
    setAiInsight("");
    setNilmDevices([]);
    try {
      const res = await fetch(SHEET_URL);
      const text = await res.text();
      const lines = text.trim().split("\n");

      const rawRows: SheetAnalysis["rawRows"] = [];
      const rows: { time: string; power: number; device: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map(c => c.replace(/"/g, "").trim());
        if (cols.length >= 6) {
          const power = parseFloat(cols[3]);
          rawRows.push({
            time: cols[0],
            voltage: parseFloat(cols[1]),
            current: parseFloat(cols[2]),
            power,
            powerFactor: parseFloat(cols[4]),
            frequency: parseFloat(cols[5]),
          });
          rows.push({ time: cols[0], power, device: cols[6] ?? `${Math.round(power)}W` });
        }
      }
      if (rows.length === 0) throw new Error("No data");

      // ── Filter rows by billingPeriod ──────────────────────────────────
      // Sort rows by time ascending
      const sortedRows = [...rows].sort((a, b) => a.time.localeCompare(b.time));
      const sortedRaw  = [...rawRows].sort((a, b) => a.time.localeCompare(b.time));

      // Detect unique dates from timestamp (YYYY-MM-DD HH:MM or HH:MM:SS)
      const getDayKey = (t: string) => {
        // Support both "2026-01-01 00:00:00" and "00:00:00"
        if (t.length > 10) return t.substring(0, 10);
        return t;
      };

      const allDays = Array.from(new Set(sortedRows.map(r => getDayKey(r.time)))).sort();
      const totalDays = allDays.length;

      // For 1 month: use last ~30 days. For 2 months: use all rows.
      const daysToUse = billingPeriod === 1
        ? allDays.slice(Math.max(0, totalDays - 30))
        : allDays;

      const filteredRows = billingPeriod === 1
        ? sortedRows.filter(r => daysToUse.includes(getDayKey(r.time)))
        : sortedRows;

      const filteredRaw = billingPeriod === 1
        ? sortedRaw.filter(r => daysToUse.includes(getDayKey(r.time)))
        : sortedRaw;

      const actualDays = daysToUse.length;

      const avgPowerCalc = filteredRows.reduce((s, r) => s + r.power, 0) / filteredRows.length;
      const avgPower = Math.round(avgPowerCalc);
      const dailyEnergy = parseFloat(((avgPowerCalc * 24) / 1000).toFixed(2));
      const totalEnergy = dailyEnergy;
      const peakRow = filteredRows.reduce((max, r) => r.power > max.power ? r : max, filteredRows[0]);
      const days = actualDays;
      const estimatedBill = calcSonelgazBill(dailyEnergy, days);
      const estimatedSavings = Math.round(estimatedBill * 0.28);
      const co2Kg = parseFloat((dailyEnergy * actualDays * 0.5).toFixed(1));
      const carKm = Math.round(co2Kg * 4);

      const nilmRegionDefs = [
        { name: "Region A", min: 0,    max: 400   },
        { name: "Region B", min: 400,  max: 800   },
        { name: "Region C", min: 800,  max: 1200  },
        { name: "Region D", min: 1200, max: 1700  },
        { name: "Region E", min: 1700, max: 99999 },
      ];
      const topDevices = nilmRegionDefs.map(rDef => {
        const matched = filteredRows.filter(r => r.power >= rDef.min && r.power < rDef.max);
        if (matched.length === 0) return null;
        const avgPow = Math.round(matched.reduce((s, r) => s + r.power, 0) / matched.length);
        const pct = Math.round((matched.length / filteredRows.length) * 100);
        return { name: rDef.name, power: avgPow, percentage: pct };
      }).filter(Boolean).sort((a, b) => (b?.power ?? 0) - (a?.power ?? 0)).slice(0, 5) as { name: string; power: number; percentage: number }[];

      const recommendations = [
        { icon: "⚡", title: "Reduce Peak Hours Usage", description: `Peak at ${peakRow.time} — ${peakRow.power}W detected. Shift high-power tasks to off-peak hours.`, savings: Math.round(estimatedBill * 0.1) },
        { icon: "🕐", title: "Avoid the 17:00 – 21:00 Window", description: "Sonelgaz applies higher tariffs during peak demand hours (5 PM – 9 PM). Postpone your washing machine, oven, iron, and water heater to before 5 PM or after 9 PM to reduce your bill noticeably.", savings: Math.round(estimatedBill * 0.15) },
        { icon: "🔌", title: `Optimize ${topDevices[0]?.name}`, description: `${topDevices[0]?.name} consumes ${topDevices[0]?.percentage}% of total energy. Consider scheduling.`, savings: Math.round(estimatedBill * 0.12) },
        { icon: "❄️", title: "AC Optimization", description: "Set AC to 24°C instead of 20°C to reduce consumption by 25%.", savings: Math.round(estimatedBill * 0.08) },
        { icon: "💡", title: "Switch to LED Lighting", description: "LED bulbs consume 75% less energy than traditional bulbs.", savings: Math.round(estimatedBill * 0.05) },
      ];

      const result = { totalEnergy, avgPower, peakPower: peakRow.power, peakTime: peakRow.time, estimatedBill, estimatedSavings, co2Kg, carKm, topDevices, recommendations, rowCount: filteredRows.length, rawRows: filteredRaw };
      setSheetData(result);
      askGemini(result);
    } catch {
      setSheetError("Failed to load data. Make sure the Google Sheet is public.");
    } finally {
      setLoadingSheet(false);
    }
  };

  const colors = ["#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7"];
  const confidenceColor = (c: string) => c === "High" ? "#22c55e" : c === "Medium" ? "#f59e0b" : "#94a3b8";

  const bill = sheetData?.estimatedBill ?? predictions.predictedBill;
  const savings = sheetData?.estimatedSavings ?? predictions.totalSavings;
  const co2Kg = sheetData?.co2Kg ?? parseFloat((predictions.predictedBill / 4 * 0.5).toFixed(1));
  const carKm = sheetData?.carKm ?? Math.round(co2Kg * 4);
  const co2Level = co2Kg < 40 ? "low" : co2Kg < 80 ? "medium" : "high";
  const co2Config = co2Level === "low"
    ? { color: "#22c55e", bg: "from-green-400 to-emerald-500", label: "Low Impact 🌱", msg: "Great! Your carbon footprint is below average" }
    : co2Level === "medium"
    ? { color: "#f59e0b", bg: "from-amber-400 to-orange-500", label: "Medium Impact 🌿", msg: "Consider reducing consumption to lower your CO₂" }
    : { color: "#ef4444", bg: "from-red-400 to-rose-500", label: "High Impact ⚠️", msg: "Your carbon footprint is above average" };

  const recs = sheetData?.recommendations ?? predictions.recommendations;

  // ── TTS ──────────────────────────────────────────────────────────────────
  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const google = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"));
    if (google) u.voice = google;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden h-40 md:h-48">
        <img src="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80" alt="AI" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/90 to-purple-900/70 flex items-center justify-between px-6 md:px-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-6 h-6 text-purple-300" />
              <span className="text-purple-300 text-sm font-medium">AI-Powered Analysis</span>
            </div>
            <h2 className="text-white text-xl md:text-2xl font-bold">AI Energy Predictions</h2>
            <p className="text-purple-200 text-sm mt-1">Optimize your energy usage with AI insights</p>
          </div>
          <Button onClick={analyzeSheet} disabled={loadingSheet}
            className="flex-shrink-0 h-10 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white border border-white/30 rounded-xl font-medium text-sm transition-all">
            {loadingSheet
              ? <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Loading...</span></div>
              : <div className="flex items-center gap-2"><Database className="w-4 h-4" /><span className="hidden sm:inline">Load Real Data</span></div>
            }
          </Button>
        </div>
      </div>

      {sheetData && (
        <div className="flex items-center justify-between px-1 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-green-600 font-medium">Showing real data — {sheetData.rowCount} records from Google Sheets</p>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setBillingPeriod(1)}
              className={"text-xs font-semibold px-3 py-1.5 rounded-lg transition-all " + (billingPeriod === 1 ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              Last Month
            </button>
            <button
              onClick={() => setBillingPeriod(2)}
              className={"text-xs font-semibold px-3 py-1.5 rounded-lg transition-all " + (billingPeriod === 2 ? "bg-white text-indigo-600 shadow-sm" : "text-gray-400 hover:text-gray-600")}
            >
              All Data
            </button>
          </div>
        </div>
      )}
      {sheetError && <p className="text-xs text-red-500 px-1">{sheetError}</p>}

      {/* Bill + Savings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-sm">
              <CircleDollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-500">
                {sheetData ? (billingPeriod === 2 ? "Estimated Bill (All Data)" : "Estimated Bill (Last Month)") : "Predicted Monthly Bill"}
              </CardTitle>
              {sheetData && <p className="text-[10px] text-green-500 font-medium">From real data</p>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                <AnimatedValue target={bill} />
              </span>
              <span className="text-lg font-medium text-gray-400">DA</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {sheetData ? "Based on " + sheetData.totalEnergy + " kWh/day — Sonelgaz tarif" : "Based on current consumption patterns"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md shadow-gray-100 hover:shadow-lg transition-all duration-300">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium text-gray-500">Potential Savings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-emerald-600"><AnimatedValue target={savings} /></span>
              <span className="text-lg font-medium text-gray-400">DA</span>
            </div>
            <p className="text-xs text-emerald-600 mt-2 font-medium">💡 You can save up to {savings.toLocaleString()} DA this month</p>
          </CardContent>
        </Card>
      </div>

      {sheetData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Daily Energy", value: `${sheetData.totalEnergy} kWh`, icon: Zap, color: "text-amber-500" },
            { label: "Avg Power", value: `${sheetData.avgPower} W`, icon: BarChart2, color: "text-blue-500" },
            { label: "Peak Power", value: `${sheetData.peakPower} W`, icon: TrendingDown, color: "text-red-500" },
            { label: "Peak Time", value: sheetData.peakTime, icon: Clock, color: "text-purple-500" },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-sm shadow-gray-100">
              <CardContent className="p-3 flex items-center gap-2">
                <s.icon className={`w-4 h-4 flex-shrink-0 ${s.color}`} />
                <div>
                  <p className="text-[11px] text-gray-400">{s.label}</p>
                  <p className="text-sm font-bold text-gray-900">{s.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <Card className="border-0 shadow-md shadow-gray-100">
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">AI Recommendations</CardTitle>
            <p className="text-xs text-gray-400">
              {sheetData ? "Based on your real data" : "AI-generated tips to reduce your energy bill"}
            </p>
          </div>
          <Sparkles className="w-4 h-4 text-amber-400 ml-auto" />
        </CardHeader>
        <CardContent className="space-y-3">
          {recs.map((rec: any, index: number) => (
            <div key={index}
              className={`flex items-start gap-4 p-4 rounded-xl bg-gray-50 hover:bg-indigo-50 transition-all duration-300 group cursor-default ${
                index < visibleCards ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
              style={{ transition: "opacity 0.4s ease, transform 0.4s ease" }}
            >
              <span className="text-2xl flex-shrink-0">{rec.icon}</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900">{rec.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{rec.description}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-sm font-bold text-emerald-600">-{rec.savings} DA</span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Devices Chart */}
      {sheetData && (
        <Card className="border-0 shadow-md shadow-gray-100">
          <CardHeader className="pb-2 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">Top Energy Consumers</CardTitle>
              <p className="text-xs text-gray-400">Detected from your real consumption data</p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sheetData.topDevices} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94A3B8" }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} unit="W" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", color: "#1e293b", fontSize: 12 }}
                    labelStyle={{ color: "#64748b", marginBottom: 4 }}
                    formatter={(v: number, _name: string, props: any) => [`${v} W  (${props?.payload?.percentage ?? 0}%)`, "Avg Power"]}
                  />
                  <Bar dataKey="power" radius={[6, 6, 0, 0]}>
                    {sheetData.topDevices.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {sheetData.topDevices.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
                  <span className="text-xs text-gray-700 font-medium truncate">{d.name}</span>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: colors[i % colors.length] }}>{d.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 🤖 Groq AI Insights */}
      {(aiInsight || loadingAI) && (
        <Card className="border-0 shadow-md shadow-gray-100 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-indigo-600" />
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">Groq AI Insights</CardTitle>
              <p className="text-xs text-gray-400">Powered by Groq AI </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {aiInsight && (
                <button
                  onClick={() => speak(aiInsight)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-purple-500 hover:text-purple-700 transition-colors"
                  style={{background:"rgba(168,85,247,0.1)"}}
                  title="Read aloud"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-50 text-purple-600">AI ✨</span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAI ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Groq is analyzing your data...</span>
              </div>
            ) : (
              <div className="text-sm text-gray-700 leading-relaxed" style={{fontFamily: "'Palatino', 'Book Antiqua', serif", fontSize: "15px", lineHeight: "1.8"}}>
                {aiInsight.split("\n").map((line, i) => {
                  // Render **bold** text inline
                  const parts = line.split(/\*\*(.*?)\*\*/g);
                  return (
                    <p key={i} className="mb-1">
                      {parts.map((part, j) =>
                        j % 2 === 1
                          ? <strong key={j} className="font-bold text-gray-900">{part}</strong>
                          : <span key={j}>{part}</span>
                      )}
                    </p>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 🏠 User Appliances — NILM Constraint Panel */}
      {sheetData && (
        <Card className="border-0 shadow-md shadow-gray-100 overflow-hidden">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-600" />
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">Your Home Appliances</CardTitle>
              <p className="text-xs text-gray-400">Select devices you have — improves appliance estimation accuracy</p>
            </div>
            <button
              onClick={() => setShowAppliancePanel(p => !p)}
              className="ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
            >
              {showAppliancePanel ? "Hide ▲" : `Edit (${selectedAppliances.length}) ▼`}
            </button>
          </CardHeader>

          {/* Selected appliances preview */}
          {!showAppliancePanel && (
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {appliances.filter(a => a.selected).map(a => (
                  <span key={a.id} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                    {a.icon} {a.label}
                    {(a.count ?? 1) > 1 && (
                      <span className="ml-0.5 bg-emerald-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full">×{a.count}</span>
                    )}
                  </span>
                ))}
                {selectedAppliances.length === 0 && (
                  <span className="text-xs text-gray-400">No appliances selected — AI will use general power signature estimation</span>
                )}
              </div>
            </CardContent>
          )}

          {/* Full panel — table layout */}
          {showAppliancePanel && (
            <CardContent className="pt-0 space-y-4">
              {/* Table header */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Device</th>
                      <th className="text-center py-2 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</th>
                      <th className="text-center py-2 px-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">h/day</th>
                      <th className="text-left py-2 pl-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usage Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {appliances.map(a => (
                      <tr key={a.id}
                        className={"transition-colors " + (a.selected ? "bg-emerald-50/60" : "")}>
                        {/* Device name */}
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => toggleAppliance(a.id)}>
                            <div className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (a.selected ? "bg-emerald-500" : "bg-gray-200")} />
                            <span className={"font-medium " + (a.selected ? "text-emerald-700" : "text-gray-400")}>
                              {a.label}
                            </span>
                            {a.id.startsWith("custom_") && (
                              <button onClick={e => { e.stopPropagation(); removeAppliance(a.id); }}
                                className="text-gray-300 hover:text-red-400 transition-colors ml-1">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        {/* Quantity counter */}
                        <td className="py-2 px-1">
                          {a.selected ? (
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={e => { e.stopPropagation(); updateCount(a.id, -1); }}
                                className="w-5 h-5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold flex items-center justify-center transition-colors">
                                −
                              </button>
                              <span className="font-bold text-emerald-700 w-4 text-center">{a.count ?? 1}</span>
                              <button onClick={e => { e.stopPropagation(); updateCount(a.id, +1); }}
                                className="w-5 h-5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold flex items-center justify-center transition-colors">
                                +
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-300 text-center block">—</span>
                          )}
                        </td>
                        {/* Daily hours */}
                        <td className="py-2 px-1 text-center">
                          {a.selected ? (
                            <input
                              type="number"
                              min="0" max="24" step="0.5"
                              value={a.dailyHours ?? 2}
                              onChange={e => updateHours(a.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="w-12 h-6 text-center text-xs rounded-md border border-emerald-200 bg-white text-emerald-700 font-bold focus:outline-none focus:border-emerald-400"
                            />
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        {/* Usage time */}
                        <td className="py-2 pl-2">
                          <span className={"text-[10px] " + (a.selected ? "text-gray-500" : "text-gray-300")}>
                            {a.usageTime ?? "Variable"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add custom appliance */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={e => setCustomInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addCustomAppliance()}
                  placeholder="Add custom appliance..."
                  className="flex-1 h-9 px-3 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-400 bg-gray-50"
                />
                <Button
                  onClick={addCustomAppliance}
                  className="h-9 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-400">
                  ✅ {appliances.filter(a => a.selected).length} types · {selectedAppliances.length} total units selected
                </p>
                <Button onClick={() => setShowAppliancePanel(false)} className="h-8 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-medium">Save ✓</Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* ⚡ NILM — Device Detection */}
      {sheetData && (
        <Card className="border-0 shadow-md shadow-gray-100 overflow-hidden max-w-full">
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-blue-600" />
          <CardHeader className="pb-3 flex flex-row items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
              <Search className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm font-semibold text-gray-900">NILM-Inspired Appliance Detection</CardTitle>
              <p className="text-xs text-gray-400 truncate">
                {selectedAppliances.length > 0
                  ? "Constrained to " + selectedAppliances.length + " selected appliances"
                  : "AI estimates appliance categories from power signatures"}
              </p>
            </div>
            <span className="ml-auto text-xs font-semibold px-2 py-1 rounded-full bg-cyan-50 text-cyan-600">NILM-Inspired ⚡</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {nilmDevices.length === 0 && !loadingNILM && (
              <div className="text-center py-4">
                <p className="text-xs text-gray-400 mb-3">
                  {selectedAppliances.length > 0
                    ? `Ready — will detect from: ${selectedAppliances.slice(0, 3).join(", ")}${selectedAppliances.length > 3 ? "..." : ""}`
                    : "Click to detect appliances automatically from your power data"}
                </p>
                <Button
                  onClick={() => runNILM(sheetData.rawRows)}
                  className="h-9 px-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-medium text-sm shadow-md transition-all"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Analyze Appliances (NILM-Inspired)
                </Button>
              </div>
            )}
            {loadingNILM && (
              <div className="flex items-center gap-3 py-4 justify-center">
                <div className="w-4 h-4 border-2 border-cyan-300 border-t-cyan-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Groq AI is identifying devices...</span>
              </div>
            )}
            {nilmDevices.length > 0 && (
              <div className="space-y-2 w-full overflow-hidden">
                {/* Legend */}
                <div className="flex items-center gap-3 px-1 pb-1 border-b border-gray-100">
                  <span className="text-[10px] text-gray-400 font-semibold">W = Avg Power consumed</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-gray-400 font-semibold">kWh = Monthly energy</span>
                  <span className="text-[10px] text-gray-300">|</span>
                  <span className="text-[10px] text-gray-400 font-semibold">DA = Est. cost</span>
                </div>
                {nilmDevices.map((d, i) => {
                  const monthlyKwh = parseFloat(((d.avgPower * (d.percentage / 100) * 24 * 30) / 1000).toFixed(1));
                  const monthlyCost = Math.round(monthlyKwh * 4.17);
                  return (
                  <div key={i} className="p-2.5 rounded-xl bg-gray-50 hover:bg-cyan-50 transition-colors w-full overflow-hidden">
                    {/* Row 1: region + device + confidence */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: colors[i % colors.length] + "18" }}>
                        <Zap className="w-3 h-3" style={{ color: colors[i % colors.length] }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 whitespace-nowrap">{d.region}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0"
                        style={{ background: confidenceColor(d.confidence) + "18", color: confidenceColor(d.confidence) }}>
                        {d.confidence}
                      </span>
                      <p className="text-[11px] text-gray-500 truncate flex-1 min-w-0">{d.detectedDevices}</p>
                    </div>
                    {/* Row 2: metrics */}
                    <div className="grid grid-cols-3 gap-1.5 pl-9">
                      <div className="bg-white rounded-lg px-2 py-1.5 text-center border border-gray-100">
                        <p className="text-[10px] text-gray-400 leading-none mb-0.5">Avg Power</p>
                        <p className="text-xs font-bold text-gray-800 whitespace-nowrap">{d.avgPower} W</p>
                      </div>
                      <div className="bg-white rounded-lg px-2 py-1.5 text-center border border-gray-100">
                        <p className="text-[10px] text-gray-400 leading-none mb-0.5">Monthly</p>
                        <p className="text-xs font-bold text-blue-600 whitespace-nowrap">{monthlyKwh} kWh</p>
                      </div>
                      <div className="bg-white rounded-lg px-2 py-1.5 text-center border border-green-100">
                        <p className="text-[10px] text-gray-400 leading-none mb-0.5">Est. Cost</p>
                        <p className="text-xs font-bold text-emerald-600 whitespace-nowrap">~{monthlyCost} DA</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 pl-9 mt-1">{d.percentage}% of total time active</p>
                  </div>
                  );
                })}
                <Button
                  onClick={() => runNILM(sheetData.rawRows)}
                  variant="outline"
                  className="w-full h-8 text-xs text-cyan-600 border-cyan-200 hover:bg-cyan-50 mt-2"
                >
                  Re-analyze
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Carbon Footprint */}
      <Card className="border-0 shadow-md shadow-gray-100 overflow-hidden">
        <div className={`h-1.5 w-full bg-gradient-to-r ${co2Config.bg}`} />
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${co2Config.bg} flex items-center justify-center`}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold text-gray-900">Carbon Footprint</CardTitle>
            <p className="text-xs text-gray-400">
              {sheetData ? "Calculated from your real data" : "Estimated CO₂ from your energy usage"}
            </p>
          </div>
          <span className="ml-auto text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: `${co2Config.color}18`, color: co2Config.color }}>
            {co2Config.label}
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `${co2Config.color}18` }}>
                <Flame className="w-6 h-6" style={{ color: co2Config.color }} />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">This month you produced</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold" style={{ color: co2Config.color }}>{co2Kg}</span>
                  <span className="text-sm font-medium text-gray-400">kg CO₂</span>
                </div>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-xs text-gray-400">vs avg 80 kg</span>
              <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min((co2Kg / 120) * 100, 100)}%`, background: co2Config.color }} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
            <Car className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <p className="text-sm text-gray-600">Equivalent to driving <span className="font-bold text-gray-900 mx-1">{carKm} km</span> by car</p>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${co2Config.color}10` }}>
            <Leaf className="w-4 h-4 flex-shrink-0" style={{ color: co2Config.color }} />
            <p className="text-xs" style={{ color: co2Config.color }}>{co2Config.msg}</p>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <Card className="border-0 bg-amber-50 shadow-sm">
        <CardContent className="py-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-800">Disclaimer</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              This prediction is based on AI analysis and may not be 100% accurate. Actual energy consumption and costs may vary based on real-time usage patterns, weather conditions, and appliance efficiency.
            </p>
          </div>
          <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        </CardContent>
      </Card>
    </div>
  );
}
