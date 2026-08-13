import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, Clock, Settings, Zap, CircleDollarSign, Save, MessageCircle, Phone, Wifi, WifiOff, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calcElecBill } from "@/lib/sonelgazTariffs";
import { estimateDailyKwh } from "@/lib/energyEstimate";

type NotificationType = "critical" | "warning" | "info";

interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
}

const BASE_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: "critical",
    title: "High energy consumption detected",
    description: "Power usage spiked to 4,200W at 22:30 — significantly above your daily average.",
    time: "Today, 22:30",
  },
  {
    id: 2,
    type: "critical",
    title: "Unusual spike in power usage",
    description: "Region B recorded a 180% increase in consumption over the last hour.",
    time: "Today, 21:15",
  },
  {
    id: 3,
    type: "warning",
    title: "Your consumption today is higher than average",
    description: "You have consumed 18.4 kWh so far today, compared to your 7-day average of 14.2 kWh.",
    time: "Today, 18:00",
  },
  {
    id: 4,
    type: "warning",
    title: "AC running for extended period",
    description: "Your air conditioner has been running continuously for 6 hours. Consider adjusting the thermostat.",
    time: "Today, 16:45",
  },
  {
    id: 5,
    type: "info",
    title: "Weekly energy report available",
    description: "Your weekly consumption summary is ready. Visit the Graphs & Analysis page for details.",
    time: "Today, 08:00",
  },
  {
    id: 6,
    type: "info",
    title: "System update completed",
    description: "Your Smart Energy Monitor firmware has been updated to version 2.1.4.",
    time: "Yesterday, 03:00",
  },
  {
    id: 7,
    type: "warning",
    title: "Gas consumption above threshold",
    description: "Your gas usage this month has exceeded 120 Th. Review your heating schedule.",
    time: "Yesterday, 12:30",
  },
  {
    id: 8,
    type: "info",
    title: "New AI recommendation",
    description: "Based on your usage patterns, we have a new energy-saving tip. Check the AI Prediction page.",
    time: "2 days ago",
  },
];

const typeConfig: Record<NotificationType, { icon: typeof AlertTriangle; bg: string; border: string; iconColor: string; badge: string; badgeText: string }> = {
  critical: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-700",
    badgeText: "Critical",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    badge: "bg-amber-100 text-amber-700",
    badgeText: "Warning",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
    badgeText: "Info",
  },
};

// ── Traffic light status ────────────────────────────────────────────────────
function getStatus(current: number, limit: number) {
  if (limit <= 0) return "green";
  const ratio = current / limit;
  if (ratio >= 1) return "red";
  if (ratio >= 0.8) return "yellow";
  return "green";
}

const STATUS_CONFIG = {
  green:  { label: "Normal",   dot: "bg-green-500",  text: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  yellow: { label: "Warning",  dot: "bg-amber-500",  text: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  red:    { label: "Critical", dot: "bg-red-500",    text: "text-red-700",    bg: "bg-red-50",    border: "border-red-200"   },
};

// ── Send WhatsApp via Vercel serverless function ────────────────────────────
async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Device Connectivity monitoring ──────────────────────────────────────────
// Reads the same Google Sheet used by GraphsAnalysis.tsx and checks how old
// the latest reading is. This is a client-side check only (works while the
// dashboard is open). Designed so a future n8n + dedicated "DeviceStatus"
// Sheet tab can replace this fetch without changing the UI below.
const DEVICE_SHEET_ID = "1g9XRplcjctpLaOnxmsy7C_0o8dc9Yy4-Zny6m7XSyXg";
const DEVICE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEVICE_SHEET_ID}/gviz/tq?tqx=out:csv`;
const OFFLINE_THRESHOLD_MIN = 15; // minutes without a new reading = offline
const DEVICE_POLL_MS = 60_000; // re-check every 60s while page is open
const DEVICE_HISTORY_KEY = "veam_device_history";
const DEVICE_HISTORY_LIMIT = 10;

type DeviceStatus = "online" | "offline" | "unknown";

interface DeviceHistoryEntry {
  id: string;
  offlineAt: string;    // ISO timestamp when device went offline
  reconnectedAt: string | null; // ISO timestamp when it came back (null = still offline)
  durationMin: number | null;   // null while ongoing
}

// Parse "YYYY-MM-DD HH:MM:SS" (or similar) from the sheet into a Date
function parseSheetTimestamp(t: string): Date | null {
  if (!t) return null;
  const iso = t.trim().replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function loadDeviceHistory(): DeviceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(DEVICE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDeviceHistory(entries: DeviceHistoryEntry[]) {
  localStorage.setItem(DEVICE_HISTORY_KEY, JSON.stringify(entries.slice(0, DEVICE_HISTORY_LIMIT)));
}

function formatMinutesAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return Math.round(minutes) + " min ago";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours + "h " + mins + "min ago";
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return Math.round(minutes) + " min";
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return hours + "h " + mins + "min";
}

// ── Live Power/Bill from the same Sheet ─────────────────────────────────────
// Column order matches GraphsAnalysis.tsx: time, voltage, current, power, powerFactor, frequency
interface SheetRow { time: string; power: number; }

function parseSheetRows(text: string): SheetRow[] {
  const lines = text.trim().split("\n");
  const rows: SheetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.replace(/"/g, "").trim());
    if (cols.length >= 4) {
      rows.push({ time: cols[0], power: parseFloat(cols[3]) || 0 });
    }
  }
  return rows;
}

function getDayKey(t: string): string {
  if (t.length >= 10 && t.includes("-")) return t.substring(0, 10);
  return t;
}

// Estimate a monthly ELECTRICITY CONSUMPTION COST (HT — before fixed
// charges & taxes) from today's readings:
//   1. estimateDailyKwh()  → time-weighted integration of Power over time (energyEstimate.ts)
//   2. calcElecBill()      → real Sonelgaz tranche/rate logic (sonelgazTariffs.ts)
// This matches "Montant en DA HT" (électricité) on a real Sonelgaz bill —
// NOT the final "Net à payer TTC" (which adds redevances fixes, taxe
// d'habitation, droit fixe, timbre and TVA — see BillCalculator.tsx for that).
function estimateBillFromRows(rows: SheetRow[]): number {
  if (rows.length === 0) return 0;
  const lastDay = getDayKey(rows[rows.length - 1].time);
  const todayRows = rows.filter((r) => getDayKey(r.time) === lastDay);
  const sample = todayRows.length > 0 ? todayRows : rows;
  const dailyKwh = estimateDailyKwh(sample);
  return calcElecBill(dailyKwh, 30);
}

export default function Notifications() {
  // ── Alert limits (persisted in localStorage) ─────────────────────────────
  const [powerLimit, setPowerLimit]   = useState<number>(0);
  const [billLimit,  setBillLimit]    = useState<number>(0);
  const [powerInput, setPowerInput]   = useState<string>("");
  const [billInput,  setBillInput]    = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const [saved, setSaved]             = useState(false);

  // ── WhatsApp state ────────────────────────────────────────────────────────
  const [whatsappPhone,   setWhatsappPhone]   = useState<string>("");
  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean>(false);
  const [whatsappStatus,  setWhatsappStatus]  = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [phoneInput,      setPhoneInput]      = useState<string>("");
  const lastSentRef = useRef<Record<string, number>>({});

  // ── Device connectivity state ───────────────────────────────────────────
  const [deviceStatus,  setDeviceStatus]  = useState<DeviceStatus>("unknown");
  const [lastSeen,      setLastSeen]      = useState<Date | null>(null);
  const [deviceHistory, setDeviceHistory] = useState<DeviceHistoryEntry[]>([]);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [nowTick,       setNowTick]       = useState(() => Date.now());
  const prevStatusRef = useRef<DeviceStatus>("unknown");

  // ── Live Power/Bill — read from Google Sheets, computed via shared Sonelgaz logic ──
  const [currentPower, setCurrentPower] = useState<number>(0); // W — latest reading
  // currentBill = estimated monthly ELECTRICITY CONSUMPTION COST (HT), i.e. only the
  // kWh × Sonelgaz tranche rates (calcElecBill). It does NOT include redevances fixes,
  // taxe d'habitation, droit fixe, timbre, or TVA — so it will always be lower than the
  // final "Net à payer TTC" on a real Sonelgaz bill. See BillCalculator.tsx for the
  // full TTC estimate with all fixed charges and taxes included.
  const [currentBill,  setCurrentBill]  = useState<number>(0); // DA — elec. consumption cost, HT
  const [liveDataLoaded, setLiveDataLoaded] = useState(false);

  useEffect(() => {
    const p = localStorage.getItem("veam_power_limit");
    const b = localStorage.getItem("veam_bill_limit");
    const w = localStorage.getItem("veam_whatsapp_phone");
    const e = localStorage.getItem("veam_whatsapp_enabled");
    if (p) { setPowerLimit(Number(p)); setPowerInput(p); }
    if (b) { setBillLimit(Number(b));  setBillInput(b);  }
    if (w) { setWhatsappPhone(w); setPhoneInput(w); }
    if (e) { setWhatsappEnabled(e === "true"); }
    setDeviceHistory(loadDeviceHistory());
  }, []);

  // ── Check device connectivity: fetch latest reading, detect on/offline ───
  useEffect(() => {
    let cancelled = false;

    const checkDevice = async () => {
      setDeviceLoading(true);
      try {
        const res = await fetch(DEVICE_SHEET_URL);
        const text = await res.text();

        // ── Live Power/Bill (same fetch, no extra request) ─────────────
        const rows = parseSheetRows(text);
        if (!cancelled && rows.length > 0) {
          setCurrentPower(rows[rows.length - 1].power);
          setCurrentBill(estimateBillFromRows(rows));
          setLiveDataLoaded(true);
        }

        const lines = text.trim().split("\n");
        const lastLine = lines[lines.length - 1] || "";
        const firstCol = lastLine.split(",")[0]?.replace(/"/g, "").trim() || "";
        const ts = parseSheetTimestamp(firstCol);
        if (cancelled || !ts) { setDeviceLoading(false); return; }

        setLastSeen(ts);
        const minutesAgo = (Date.now() - ts.getTime()) / 60000;
        const status: DeviceStatus = minutesAgo <= OFFLINE_THRESHOLD_MIN ? "online" : "offline";
        setDeviceStatus(status);

        // ── Detect transitions and update history ───────────────────────
        const prev = prevStatusRef.current;
        if (prev !== "unknown" && prev !== status) {
          const current = loadDeviceHistory();
          if (status === "offline") {
            // went offline: open a new ongoing entry
            const entry: DeviceHistoryEntry = {
              id: String(Date.now()),
              offlineAt: ts.toISOString(),
              reconnectedAt: null,
              durationMin: null,
            };
            const updated = [entry, ...current];
            saveDeviceHistory(updated);
            setDeviceHistory(updated);
          } else {
            // came back online: close the most recent ongoing entry
            const idx = current.findIndex((h) => h.durationMin === null);
            if (idx !== -1) {
              const offlineAt = new Date(current[idx].offlineAt);
              const durationMin = Math.round((Date.now() - offlineAt.getTime()) / 60000);
              current[idx] = { ...current[idx], reconnectedAt: new Date().toISOString(), durationMin };
              saveDeviceHistory(current);
              setDeviceHistory([...current]);
            }
          }
        }
        prevStatusRef.current = status;
      } catch {
        if (!cancelled) setDeviceStatus("unknown");
      } finally {
        if (!cancelled) setDeviceLoading(false);
      }
    };

    checkDevice();
    const interval = setInterval(checkDevice, DEVICE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Tick every 30s so "X min ago" labels stay fresh without refetching ───
  useEffect(() => {
    const tick = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const saveAlerts = () => {
    const p = parseFloat(powerInput) || 0;
    const b = parseFloat(billInput)  || 0;
    const phone = phoneInput.trim();
    setPowerLimit(p);
    setBillLimit(b);
    setWhatsappPhone(phone);
    localStorage.setItem("veam_power_limit",      String(p));
    localStorage.setItem("veam_bill_limit",       String(b));
    localStorage.setItem("veam_whatsapp_phone",   phone);
    localStorage.setItem("veam_whatsapp_enabled", String(whatsappEnabled));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // ── Build dynamic alert notifications ─────────────────────────────────────
  const dynamicAlerts: Notification[] = [];
  const now = new Date().toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" });

  if (powerLimit > 0 && currentPower >= powerLimit) {
    const status = getStatus(currentPower, powerLimit);
    dynamicAlerts.push({
      id: 9001,
      type: status === "red" ? "critical" : "warning",
      title: status === "red"
        ? "Power limit exceeded!"
        : "Approaching power limit",
      description: "Current power is " + currentPower + "W — your limit is set to " + powerLimit + "W.",
      time: "Today, " + now,
    });
  }

  if (billLimit > 0 && currentBill >= billLimit) {
    const status = getStatus(currentBill, billLimit);
    dynamicAlerts.push({
      id: 9002,
      type: status === "red" ? "critical" : "warning",
      title: status === "red"
        ? "Electricity cost limit exceeded!"
        : "Approaching electricity cost limit",
      description: "Estimated electricity consumption cost (HT, before fixed charges & taxes) is " + currentBill + " DA — your limit is set to " + billLimit + " DA.",
      time: "Today, " + now,
    });
  }

  const notifications = [...dynamicAlerts, ...BASE_NOTIFICATIONS];

  // ── Auto-send WhatsApp when alert triggered ────────────────────────────────
  useEffect(() => {
    if (!whatsappEnabled || !whatsappPhone) return;
    dynamicAlerts.forEach((alert) => {
      const key = String(alert.id);
      const lastSent = lastSentRef.current[key] || 0;
      const tenMinutes = 10 * 60 * 1000;
      if (Date.now() - lastSent > tenMinutes) {
        lastSentRef.current[key] = Date.now();
        const msg =
          "🚨 VEAM Alert: " + alert.title + "\n" +
          alert.description + "\n" +
          "⏰ " + alert.time;
        sendWhatsApp(whatsappPhone, msg);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [powerLimit, billLimit, whatsappEnabled, whatsappPhone]);

  // ── Manual test button handler ─────────────────────────────────────────────
  const handleTestWhatsApp = async () => {
    if (!whatsappPhone) return;
    setWhatsappStatus("sending");
    const ok = await sendWhatsApp(
      whatsappPhone,
      "✅ VEAM Test: Your WhatsApp alerts are working correctly!\n📊 Energy Monitor is active and watching your consumption."
    );
    setWhatsappStatus(ok ? "sent" : "error");
    setTimeout(() => setWhatsappStatus("idle"), 3000);
  };

  // ── Status indicators ──────────────────────────────────────────────────────
  const powerStatus = getStatus(currentPower, powerLimit);
  const billStatus  = getStatus(currentBill,  billLimit);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
        <p className="text-sm text-gray-500 mt-0.5">Stay informed about your energy usage alerts</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {(["critical", "warning", "info"] as NotificationType[]).map((type) => {
          const config = typeConfig[type];
          const count = notifications.filter((n) => n.type === type).length;
          const Icon = config.icon;
          return (
            <Card key={type} className={"border " + config.border + " " + config.bg + " shadow-none"}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={"w-5 h-5 " + config.iconColor + " flex-shrink-0"} />
                <div>
                  <p className="text-lg font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-500 capitalize">{config.badgeText}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Alert Settings Card ────────────────────────────────────────────── */}
      <Card className="border-0 shadow-md shadow-gray-100 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-purple-600" />
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              Alert Thresholds
              {liveDataLoaded && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Live ●
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-gray-400">Set your power and bill limits</p>
          </div>
          <button
            onClick={() => setShowSettings(p => !p)}
            className="flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
          >
            {showSettings ? "Hide ▲" : "Edit ▼"}
          </button>
        </CardHeader>

        {/* ── Traffic lights — always visible ── */}
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Power status */}
            {(() => {
              const s = STATUS_CONFIG[powerStatus];
              return (
                <div className={"flex items-center gap-2.5 p-3 rounded-xl border " + s.border + " " + s.bg}>
                  <Zap className={"w-4 h-4 flex-shrink-0 " + s.text} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400">Peak Power</p>
                    <p className={"text-sm font-bold " + s.text}>{currentPower} W</p>
                    <p className="text-[10px] text-gray-400">
                      {powerLimit > 0 ? "Limit: " + powerLimit + " W" : "No limit set"}
                    </p>
                  </div>
                  <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + s.dot} />
                </div>
              );
            })()}

            {/* Bill status */}
            {(() => {
              const s = STATUS_CONFIG[billStatus];
              return (
                <div className={"flex items-center gap-2.5 p-3 rounded-xl border " + s.border + " " + s.bg}>
                  <CircleDollarSign className={"w-4 h-4 flex-shrink-0 " + s.text} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400">Elec. Cost (HT)</p>
                    <p className={"text-sm font-bold " + s.text}>{currentBill} DA</p>
                    <p className="text-[10px] text-gray-400">
                      {billLimit > 0 ? "Limit: " + billLimit + " DA" : "No limit set"}
                    </p>
                  </div>
                  <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + s.dot} />
                </div>
              );
            })()}
          </div>

          {/* ── Inputs — only when open ── */}
          {showSettings && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                {/* Power input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-violet-500" />
                    Power Limit (W)
                  </label>
                  <input
                    type="number"
                    value={powerInput}
                    onChange={e => setPowerInput(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full h-9 px-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-violet-400 bg-gray-50"
                  />
                </div>
                {/* Bill input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <CircleDollarSign className="w-3 h-3 text-violet-500" />
                    Elec. Cost Limit (DA, HT)
                  </label>
                  <input
                    type="number"
                    value={billInput}
                    onChange={e => setBillInput(e.target.value)}
                    placeholder="e.g. 3000"
                    className="w-full h-9 px-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-violet-400 bg-gray-50"
                  />
                </div>
              </div>

              {/* ── WhatsApp Alerts Section ── */}
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-green-800">WhatsApp Alerts</p>
                  <button
                    onClick={() => setWhatsappEnabled(p => !p)}
                    className={
                      "ml-auto relative inline-flex h-5 w-9 items-center rounded-full transition-colors " +
                      (whatsappEnabled ? "bg-green-500" : "bg-gray-300")
                    }
                  >
                    <span
                      className={
                        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform " +
                        (whatsappEnabled ? "translate-x-4" : "translate-x-1")
                      }
                    />
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-green-600" />
                    Your WhatsApp Number
                  </label>
                  <input
                    type="tel"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    placeholder="+213XXXXXXXXX"
                    className="w-full h-9 px-3 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-green-400 bg-white"
                  />
                  <p className="text-[10px] text-gray-400">Include country code — e.g. +213554705671</p>
                </div>

                {phoneInput && whatsappEnabled && (
                  <button
                    onClick={handleTestWhatsApp}
                    disabled={whatsappStatus === "sending"}
                    className={
                      "w-full h-8 rounded-xl text-xs font-semibold transition-all " +
                      (whatsappStatus === "sent"
                        ? "bg-green-100 text-green-700"
                        : whatsappStatus === "error"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-500 hover:bg-green-600 text-white")
                    }
                  >
                    {whatsappStatus === "sending" && "⏳ Sending..."}
                    {whatsappStatus === "sent"    && "✅ Test sent!"}
                    {whatsappStatus === "error"   && "❌ Failed — check number"}
                    {whatsappStatus === "idle"    && "📱 Send Test Message"}
                  </button>
                )}

                {whatsappEnabled && (
                  <p className="text-[10px] text-green-700 font-medium">
                    ✅ Active — VEAM will alert you on WhatsApp when limits are exceeded
                  </p>
                )}
              </div>

              <Button
                onClick={saveAlerts}
                className="w-full h-9 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                {saved
                  ? <span className="flex items-center gap-2">✅ Saved!</span>
                  : <span className="flex items-center gap-2"><Save className="w-3.5 h-3.5" /> Save Alerts</span>
                }
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Device Connectivity Card ───────────────────────────────────────── */}
      {(() => {
        const minutesAgo = lastSeen ? (nowTick - lastSeen.getTime()) / 60000 : null;
        const isOnline = deviceStatus === "online";
        const isOffline = deviceStatus === "offline";
        const statusColor = isOnline ? "green" : isOffline ? "red" : "gray";
        const dotClass = isOnline ? "bg-green-500" : isOffline ? "bg-red-500" : "bg-gray-300";
        const textClass = isOnline ? "text-green-700 dark:text-green-400" : isOffline ? "text-red-700 dark:text-red-400" : "text-gray-500 dark:text-gray-400";
        const bgClass = isOnline ? "bg-green-50 dark:bg-green-950/30" : isOffline ? "bg-red-50 dark:bg-red-950/30" : "bg-gray-50 dark:bg-slate-800/50";
        const borderClass = isOnline ? "border-green-200 dark:border-green-900" : isOffline ? "border-red-200 dark:border-red-900" : "border-gray-200 dark:border-slate-700";
        const StatusIcon = isOnline ? Wifi : WifiOff;

        return (
          <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-none overflow-hidden dark:bg-slate-900">
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-blue-600" />
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <StatusIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Device Connectivity</CardTitle>
                <p className="text-xs text-gray-400">ESP32 sensor connection status</p>
              </div>
              {deviceLoading && <span className="text-[10px] text-gray-400 animate-pulse">Checking…</span>}
            </CardHeader>

            <CardContent className="pt-0 space-y-3">
              {/* ── Current status ── */}
              <div className={"flex items-center gap-2.5 p-3 rounded-xl border " + borderClass + " " + bgClass}>
                <StatusIcon className={"w-4 h-4 flex-shrink-0 " + textClass} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400">
                    {isOnline ? "Connected" : isOffline ? "Disconnected" : "Checking connection"}
                  </p>
                  <p className={"text-sm font-bold " + textClass}>
                    {isOnline && "Device Online 🟢"}
                    {isOffline && "Device Offline 🔴"}
                    {deviceStatus === "unknown" && "Waiting for data…"}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {minutesAgo !== null
                      ? "Last reading: " + formatMinutesAgo(minutesAgo)
                      : "No data yet"}
                  </p>
                </div>
                <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 " + dotClass + (isOffline ? " animate-pulse" : "")} />
              </div>

              {/* ── History log ── */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Recent disconnections
                </p>
                {deviceHistory.length === 0 ? (
                  <p className="text-[11px] text-gray-400 px-1">No disconnections recorded yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {deviceHistory.slice(0, 5).map((h) => (
                      <div
                        key={h.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700"
                      >
                        <WifiOff className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-gray-600 dark:text-gray-300">
                            {new Date(h.offlineAt).toLocaleString("fr-DZ", {
                              day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " +
                          (h.durationMin === null
                            ? "bg-red-100 text-red-700"
                            : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-gray-300")
                        }>
                          {h.durationMin === null ? "Ongoing" : formatDuration(h.durationMin)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-gray-400 px-1 pt-1">
                  Tracked while this page is open · powered by n8n coming soon for 24/7 monitoring
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ── Notification List ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        {notifications.map((notification, index) => {
          const config = typeConfig[notification.type];
          const Icon = config.icon;
          return (
            <Card
              key={notification.id}
              className={"border " + config.border + " " + config.bg + " shadow-none hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"}
              style={{ animationDelay: index * 60 + "ms", animationFillMode: "both" }}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Icon className={"w-5 h-5 " + config.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-gray-900">{notification.title}</h3>
                    <span className={"text-[10px] font-semibold px-2 py-0.5 rounded-full " + config.badge}>
                      {config.badgeText}
                    </span>
                    {(notification.id === 9001 || notification.id === 9002) && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                        Live ●
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">{notification.description}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-[11px] text-gray-400">{notification.time}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
