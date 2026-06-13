import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, AlertCircle, Info, Clock, Settings, Zap, CircleDollarSign, Save, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Simulated current values (in a real app these come from Google Sheets)
  const currentPower = 1850; // W  — peak power from dashboard
  const currentBill  = 2593; // DA — estimated monthly bill

  useEffect(() => {
    const p = localStorage.getItem("veam_power_limit");
    const b = localStorage.getItem("veam_bill_limit");
    const w = localStorage.getItem("veam_whatsapp_phone");
    const e = localStorage.getItem("veam_whatsapp_enabled");
    if (p) { setPowerLimit(Number(p)); setPowerInput(p); }
    if (b) { setBillLimit(Number(b));  setBillInput(b);  }
    if (w) { setWhatsappPhone(w); setPhoneInput(w); }
    if (e) { setWhatsappEnabled(e === "true"); }
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
        ? "Monthly bill limit exceeded!"
        : "Approaching monthly bill limit",
      description: "Estimated bill is " + currentBill + " DA — your limit is set to " + billLimit + " DA.",
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
            <CardTitle className="text-sm font-semibold text-gray-900">Alert Thresholds</CardTitle>
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
                    <p className="text-[10px] text-gray-400">Est. Bill</p>
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
                    Bill Limit (DA)
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
