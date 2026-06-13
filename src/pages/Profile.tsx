import { useState, useRef } from "react";
import {
  User, Settings, X, Wifi, WifiOff,
  FileText, FileSpreadsheet, FileBarChart2, Calendar,
  Shield, Trash2, ChevronDown, CheckSquare, Square,
  Zap, Brain, DollarSign, Leaf, BarChart2,
  Save, ChevronRight, Activity, Cpu, Lock, Eye, EyeOff,
  KeyRound, ImagePlus, Mail, Home, Building2, Camera, MoveVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type FileFormat = "PDF" | "CSV" | "Excel";
type ReportContent = {
  energy: boolean; ai: boolean; cost: boolean; co2: boolean; efficiency: boolean;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// ── Energy Score Ring (SVG) ───────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const label = score >= 75 ? "Excellent" : score >= 50 ? "Average" : "High Usage";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ position: "absolute" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={5} strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-gray-900 dark:text-white leading-none">{score}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ value, onChange, minDate }: {
  value: Date; onChange: (d: Date) => void; minDate?: Date;
}) {
  const [view, setView] = useState(new Date(value));
  const y = view.getFullYear(), m = view.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-3 shadow-2xl shadow-black/10 min-w-[230px]">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setView(new Date(y, m - 1, 1))}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ChevronDown className="w-3.5 h-3.5 rotate-90 text-gray-500" />
        </button>
        <span className="text-xs font-bold text-gray-800 dark:text-white">
          {view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setView(new Date(y, m + 1, 1))}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
          <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-gray-500" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <span key={i} className="text-[10px] text-gray-400 font-semibold py-0.5">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const d = new Date(y, m, day);
          const sel = d.toDateString() === value.toDateString();
          const dis = minDate ? d < minDate : false;
          return (
            <button key={i} disabled={dis} onClick={() => onChange(d)}
              className={
                "w-7 h-7 rounded-lg text-[11px] font-medium transition-all " +
                (sel ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md " : "") +
                (!sel && !dis ? "hover:bg-indigo-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-300 " : "") +
                (dis ? "text-gray-300 dark:text-slate-700 cursor-not-allowed" : "")
              }>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function Profile() {
  const serial    = localStorage.getItem("veam-device-code") || "VEAM-2026-DEMO01";
  const connected = localStorage.getItem("veam-device-connected") === "true";

  // Energy score from localStorage (set by Home/AIPrediction page)
  const energyScore = parseInt(localStorage.getItem("veam-energy-score") || "72");

  // Profile state
  const [username,  setUsername]  = useState(localStorage.getItem("veam-username") || "VEAM User");
  const [avatarUrl, setAvatarUrl] = useState(localStorage.getItem("veam-avatar") || "");
  const [coverUrl,  setCoverUrl]  = useState(localStorage.getItem("veam-cover") || "");
  const [deviceId,  setDeviceId]  = useState(serial);
  const [email,     setEmail]     = useState(localStorage.getItem("veam-email") || "");
  const [deviceUse, setDeviceUse] = useState<"household" | "business">(
    (localStorage.getItem("veam-device-use") as "household" | "business") || "household"
  );

  const avatarRef    = useRef<HTMLInputElement>(null);
  const editAvatarRef = useRef<HTMLInputElement>(null);
  const editCoverRef  = useRef<HTMLInputElement>(null);

  // Settings drawer state
  const [showSettings,  setShowSettings]  = useState(false);
  const [editName,      setEditName]      = useState(username);
  const [editSerial,    setEditSerial]    = useState(deviceId);
  const [editEmail,     setEditEmail]     = useState(email);
  const [editDeviceUse, setEditDeviceUse] = useState<"household" | "business">(deviceUse);
  const [editAvatar,    setEditAvatar]    = useState(avatarUrl);
  const [editCover,     setEditCover]     = useState(coverUrl);
  const [coverOffsetY,  setCoverOffsetY]  = useState(
    parseFloat(localStorage.getItem("veam-cover-offsety") || "50")
  );
  const [editCoverOffsetY, setEditCoverOffsetY] = useState(coverOffsetY);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Password change state
  const [showPassword,    setShowPassword]    = useState(false);
  const [oldPass,         setOldPass]         = useState("");
  const [newPass,         setNewPass]         = useState("");
  const [confirmPass,     setConfirmPass]     = useState("");
  const [showOld,         setShowOld]         = useState(false);
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [passSaved,       setPassSaved]       = useState(false);
  const [forgotSent,      setForgotSent]      = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (v: string) => void, key: string) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      const val = ev.target?.result as string;
      setter(val);
      localStorage.setItem(key, val);
    };
    r.readAsDataURL(f);
  };

  const saveSettings = () => {
    setUsername(editName || "VEAM User");
    setDeviceId(editSerial || serial);
    setEmail(editEmail);
    setDeviceUse(editDeviceUse);
    setAvatarUrl(editAvatar);
    setCoverUrl(editCover);
    setCoverOffsetY(editCoverOffsetY);
    localStorage.setItem("veam-username",       editName || "VEAM User");
    localStorage.setItem("veam-device-code",    editSerial || serial);
    localStorage.setItem("veam-email",          editEmail);
    localStorage.setItem("veam-device-use",     editDeviceUse);
    localStorage.setItem("veam-avatar",         editAvatar);
    localStorage.setItem("veam-cover",          editCover);
    localStorage.setItem("veam-cover-offsety",  String(editCoverOffsetY));
    setSettingsSaved(true);
    setTimeout(() => { setSettingsSaved(false); setShowSettings(false); }, 1200);
  };

  const savePassword = () => {
    if (newPass.length < 6 || newPass !== confirmPass) return;
    setPassSaved(true);
    setTimeout(() => {
      setPassSaved(false);
      setOldPass(""); setNewPass(""); setConfirmPass("");
    }, 2000);
  };

  const passValid = newPass.length >= 6 && newPass === confirmPass && oldPass.length >= 1;

  // Report state
  const [format,   setFormat]   = useState<FileFormat>("PDF");
  const [fromD,    setFromD]    = useState<Date>(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; });
  const [toD,      setToD]      = useState<Date>(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo,   setShowTo]   = useState(false);
  const [content,  setContent]  = useState<ReportContent>({ energy: true, ai: true, cost: true, co2: false, efficiency: false });
  const [generating, setGenerating] = useState(false);
  const [generated,  setGenerated]  = useState(false);
  const toggle = (k: keyof ReportContent) => setContent(p => ({ ...p, [k]: !p[k] }));

  const generate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); setTimeout(() => setGenerated(false), 3500); }, 2000);
  };

  // Modals
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
  const [delSerial,   setDelSerial]   = useState("");
  const [delPass,     setDelPass]     = useState("");
  const [delDone,     setDelDone]     = useState(false);

  const fmts: { id: FileFormat; icon: React.ReactNode; color: string }[] = [
    { id: "PDF",   icon: <FileText className="w-4 h-4" />,        color: "from-red-400 to-rose-500" },
    { id: "CSV",   icon: <FileSpreadsheet className="w-4 h-4" />, color: "from-emerald-400 to-teal-500" },
    { id: "Excel", icon: <FileBarChart2 className="w-4 h-4" />,   color: "from-green-500 to-emerald-600" },
  ];

  const contentItems: { key: keyof ReportContent; label: string; icon: React.ReactNode }[] = [
    { key: "energy",     label: "Energy Consumption", icon: <Zap className="w-3.5 h-3.5" /> },
    { key: "ai",         label: "AI Predictions",     icon: <Brain className="w-3.5 h-3.5" /> },
    { key: "cost",       label: "Cost Analysis",      icon: <DollarSign className="w-3.5 h-3.5" /> },
    { key: "co2",        label: "CO2 Impact",         icon: <Leaf className="w-3.5 h-3.5" /> },
    { key: "efficiency", label: "Efficiency Score",   icon: <BarChart2 className="w-3.5 h-3.5" /> },
  ];


  return (
    <>
      {/* ── Outer wrapper: single col mobile, two cols desktop ── */}
      <div className="max-w-lg lg:max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* ════════════ HERO — Cover + Centered Avatar ════════════ */}
        {/* Hero spans full width on both layouts */}
        <div className="relative mb-24">
          {/* Cover photo — shorter height */}
          <div className="h-36 lg:h-52 rounded-3xl overflow-hidden relative bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 shadow-xl shadow-indigo-200/30 dark:shadow-indigo-900/20">
            {coverUrl
              ? <img
                  src={coverUrl}
                  alt="cover"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: `center ${coverOffsetY}%` }}
                />
              : (
                <>
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.2) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
                  <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 10% 80%,rgba(255,255,255,0.12) 0%,transparent 55%),radial-gradient(ellipse at 90% 10%,rgba(255,255,255,0.08) 0%,transparent 50%)" }} />
                  <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-white/5" />
                  <div className="absolute -top-8 right-16 w-32 h-32 rounded-full bg-white/5" />
                </>
              )}
            {/* Settings gear only */}
            <button
              onClick={() => { setEditName(username); setEditSerial(deviceId); setEditEmail(email); setEditDeviceUse(deviceUse); setEditAvatar(avatarUrl); setEditCover(coverUrl); setEditCoverOffsetY(coverOffsetY); setShowSettings(true); }}
              className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-black/20 hover:bg-black/40 backdrop-blur-sm flex items-center justify-center border border-white/20 transition-all group">
              <Settings className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>

          {/* Centered Avatar — Instagram story ring (gradient) around it */}
          <div className="absolute -bottom-16 left-0 right-0 flex flex-col items-center">
            <div className="relative">
              {/* Gradient story ring */}
              <svg
                width="140" height="140"
                className="-rotate-90 absolute inset-0"
                style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%) rotate(-90deg)" }}
              >
                <defs>
                  <linearGradient id="storyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%"   stopColor="#f59e0b" />
                    <stop offset="33%"  stopColor="#f97316" />
                    <stop offset="66%"  stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <circle cx="70" cy="70" r="64" fill="none" stroke="#e2e8f0" strokeWidth="4" className="dark:stroke-slate-800" />
                <circle
                  cx="70" cy="70" r="64" fill="none"
                  stroke="url(#storyGrad)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 64}`}
                  strokeDashoffset={`${2 * Math.PI * 64 * (1 - energyScore / 100)}`}
                  style={{ transition: "stroke-dashoffset 1s ease" }}
                />
              </svg>
              {/* Score label inside ring top */}
              <div className="w-[140px] h-[140px] flex items-center justify-center relative">
                <div className="w-28 h-28 rounded-full ring-4 ring-white dark:ring-slate-950 overflow-hidden bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center shadow-xl">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                    : <User className="w-12 h-12 text-white/90" />}
                </div>
              </div>
              {/* Score badge bottom of ring */}
              <div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-md"
                style={{ background: energyScore >= 75 ? "#22c55e" : energyScore >= 50 ? "#f59e0b" : "#ef4444" }}
              >
                {energyScore}/100
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e, setAvatarUrl, "veam-avatar")} />
            </div>
          </div>
        </div>

        {/* Username + status (centered) */}
        <div className="text-center mb-5 pt-2">
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{username}</h1>
          {email && (
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{email}</p>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-1.5">
            <div className={"w-1.5 h-1.5 rounded-full " + (connected ? "bg-emerald-400 animate-pulse" : "bg-gray-300 dark:bg-slate-600")} />
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {connected ? "Device online — receiving live data" : "No device connected"}
            </span>
          </div>
          {/* Device use badge */}
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
            {deviceUse === "household" ? <Home className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
            {deviceUse === "household" ? "For Household" : "For Business"}
          </div>
        </div>

        {/* ═══ Desktop two-col / Mobile single-col ═══ */}
        <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6 lg:items-start">

        {/* ── LEFT COLUMN ── */}
        <div className="space-y-4">

          {/* ── Quick Stats ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Hardware", value: "ESP32",   sub: "PZEM-004T",                             icon: <Cpu className="w-4 h-4" />,      c: "from-violet-500 to-purple-600" },
              { label: "Signal",   value: connected ? "Online" : "Offline",
                                   sub: connected ? "Live feed" : "No signal",                     icon: <Activity className="w-4 h-4" />, c: connected ? "from-emerald-400 to-teal-500" : "from-gray-400 to-gray-500" },
              { label: "Plan",     value: "Monitor", sub: "AI Insights",                           icon: <Brain className="w-4 h-4" />,    c: "from-indigo-500 to-blue-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-3.5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className={"w-8 h-8 rounded-xl bg-gradient-to-br " + s.c + " flex items-center justify-center mb-2.5 shadow-md"}>
                  <span className="text-white">{s.icon}</span>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Account Integration ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Account</p>
            <button className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-200 group">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 shadow-sm border border-gray-100 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">Sync with Google Account</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Link for backup and cloud sync</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </button>
          </div>

          {/* ── Device Information ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-3">Device Information</p>
            <div className="space-y-0">
              {[
                { label: "Serial ID",   value: deviceId,            mono: true,  color: "" },
                { label: "Hardware",    value: "ESP32 + PZEM-004T", mono: false, color: "" },
                { label: "Connection",  value: connected ? "Connected" : "Disconnected",
                  mono: false, color: connected ? "text-emerald-500" : "text-gray-400 dark:text-slate-600" },
                { label: "Data Source", value: "Google Sheets",     mono: false, color: "text-indigo-500" },
              ].map((r, i, arr) => (
                <div key={r.label} className={"flex items-center justify-between py-3 " + (i < arr.length - 1 ? "border-b border-gray-50 dark:border-slate-800" : "")}>
                  <span className="text-xs text-gray-500 dark:text-slate-400">{r.label}</span>
                  <span className={"text-xs font-semibold " + (r.color || "text-gray-800 dark:text-slate-200") + (r.mono ? " font-mono bg-gray-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg" : "")}>
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Change Password ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <button
              onClick={() => setShowPassword(p => !p)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-500 to-gray-700 flex items-center justify-center flex-shrink-0 shadow-md">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Change Password</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Update your account password</p>
              </div>
              <ChevronRight className={"w-4 h-4 text-gray-300 dark:text-slate-600 transition-transform duration-200 " + (showPassword ? "rotate-90" : "")} />
            </button>

            {showPassword && (
              <div className="px-5 pb-5 space-y-3 border-t border-gray-50 dark:border-slate-800 pt-4">
                {/* Old password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Current Password</label>
                  <div className="relative">
                    <input
                      type={showOld ? "text" : "password"}
                      value={oldPass}
                      onChange={e => setOldPass(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all" />
                    <button onClick={() => setShowOld(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {/* New password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full h-11 px-4 pr-11 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all" />
                    <button onClick={() => setShowNew(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Strength bar */}
                  {newPass.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {[1,2,3,4].map(lvl => (
                        <div key={lvl} className={"h-1 flex-1 rounded-full transition-all " + (newPass.length >= lvl * 2 ? (newPass.length >= 8 ? "bg-emerald-400" : newPass.length >= 5 ? "bg-amber-400" : "bg-red-400") : "bg-gray-100 dark:bg-slate-700")} />
                      ))}
                    </div>
                  )}
                </div>
                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPass}
                      onChange={e => setConfirmPass(e.target.value)}
                      placeholder="Repeat new password"
                      className={"w-full h-11 px-4 pr-11 rounded-xl border text-sm focus:outline-none transition-all " +
                        (confirmPass.length > 0 && confirmPass !== newPass
                          ? "border-red-300 dark:border-red-800 focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:bg-slate-800 dark:text-white"
                          : "border-gray-200 dark:border-slate-700 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 dark:bg-slate-800 dark:text-white")} />
                    <button onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPass.length > 0 && confirmPass !== newPass && (
                    <p className="text-[11px] text-red-500">Passwords do not match</p>
                  )}
                </div>

                {/* Forgot password */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setForgotSent(true); setTimeout(() => setForgotSent(false), 3000); }}
                    className="text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
                    {forgotSent ? "Reset link sent (Demo Mode)" : "Forgot my password"}
                  </button>
                  <Button
                    onClick={savePassword}
                    disabled={!passValid}
                    className="h-9 px-5 bg-gradient-to-r from-slate-600 to-gray-800 hover:from-slate-700 hover:to-gray-900 text-white rounded-xl text-xs font-semibold disabled:opacity-40 transition-all">
                    {passSaved
                      ? <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" />Updated!</span>
                      : <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Save Password</span>}
                  </Button>
                </div>
                <p className="text-[10px] text-gray-300 dark:text-slate-700 text-center">Demo mode — password changes are not persisted</p>
              </div>
            )}
          </div>

        </div>{/* end LEFT COLUMN */}

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-4 mt-4 lg:mt-0">

          {/* ── Energy Report Center ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 flex items-center gap-3 relative overflow-hidden">
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.2) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.2) 1px,transparent 1px)", backgroundSize: "20px 20px" }} />
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center relative">
                <FileBarChart2 className="w-4 h-4 text-white" />
              </div>
              <div className="relative">
                <p className="text-sm font-bold text-white">Energy Report Center</p>
                <p className="text-[11px] text-indigo-200">Export and analyze your data</p>
              </div>
              <span className="ml-auto relative text-[10px] bg-white/20 text-white px-2.5 py-1 rounded-full font-bold border border-white/20 tracking-wide">DEMO</span>
            </div>
            <div className="p-5 space-y-5">
              {/* Date Range */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Date Range
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "From", date: fromD, show: showFrom, setShow: setShowFrom,
                      setDate: (d: Date) => { setFromD(d); if (d > toD) setToD(d); setShowFrom(false); },
                      align: "left-0", min: undefined as Date | undefined },
                    { label: "To",   date: toD,   show: showTo,   setShow: setShowTo,
                      setDate: (d: Date) => { setToD(d); setShowTo(false); },
                      align: "right-0", min: fromD },
                  ].map((c) => (
                    <div key={c.label} className="relative">
                      <button
                        onClick={() => { c.setShow(!c.show); (c.label === "From" ? setShowTo : setShowFrom)(false); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-400 bg-gray-50 dark:bg-slate-800 transition-all text-left">
                        <div className={"w-1 h-8 rounded-full flex-shrink-0 " + (c.label === "From" ? "bg-indigo-400" : "bg-purple-400")} />
                        <div>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{c.label}</p>
                          <p className="text-xs font-bold text-gray-800 dark:text-white">{fmtDate(c.date)}</p>
                        </div>
                      </button>
                      {c.show && (
                        <div className={"absolute top-full mt-2 z-30 " + c.align}>
                          <MiniCalendar value={c.date} onChange={c.setDate} minDate={c.min} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* File Format */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">File Format</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {fmts.map((f) => (
                    <button key={f.id} onClick={() => setFormat(f.id)}
                      className={"flex flex-col items-center gap-2 py-3.5 rounded-xl border-2 transition-all duration-200 " +
                        (format === f.id
                          ? "border-indigo-500 bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 shadow-sm"
                          : "border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800")}>
                      <div className={"w-9 h-9 rounded-xl bg-gradient-to-br " + f.color + " flex items-center justify-center shadow-md"}>
                        <span className="text-white">{f.icon}</span>
                      </div>
                      <span className={"text-xs font-bold " + (format === f.id ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-slate-500")}>{f.id}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Content */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">Include in Report</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {contentItems.map((item) => (
                    <button key={item.key} onClick={() => toggle(item.key)}
                      className={"flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 " +
                        (content[item.key]
                          ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                          : "bg-gray-50 dark:bg-slate-800 border border-transparent hover:border-gray-200 dark:hover:border-slate-700")}>
                      <span className={content[item.key] ? "text-indigo-500" : "text-gray-300 dark:text-slate-600"}>
                        {content[item.key] ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </span>
                      <span className={"text-xs flex items-center gap-2 font-medium " + (content[item.key] ? "text-indigo-700 dark:text-indigo-300" : "text-gray-500 dark:text-slate-500")}>
                        <span className={content[item.key] ? "text-indigo-400" : "text-gray-300 dark:text-slate-600"}>{item.icon}</span>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Generate */}
              {generated ? (
                <div className="w-full h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">+</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Report Ready — Demo Mode</span>
                </div>
              ) : (
                <Button onClick={generate}
                  disabled={generating || !Object.values(content).some(Boolean)}
                  className="w-full h-12 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-600 hover:from-indigo-600 hover:via-purple-600 hover:to-violet-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-300/40 dark:shadow-indigo-900/40 transition-all duration-300 disabled:opacity-50">
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FileBarChart2 className="w-4 h-4" />
                      Generate Report
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* ── Footer Actions ── */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-3 shadow-sm space-y-1">
            <button onClick={() => setShowPrivacy(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 transition-all group">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex-1 text-left">
                Privacy and Data Policy
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </button>
            <div className="h-px bg-gray-50 dark:bg-slate-800 mx-4" />
            <button onClick={() => { setShowDelete(true); setDelDone(false); setDelSerial(""); setDelPass(""); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-all group">
              <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <span className="text-sm font-medium text-red-400 group-hover:text-red-600 transition-colors flex-1 text-left">Delete My Account</span>
            </button>
          </div>

          <div className="text-center py-2">
            <p className="text-[10px] text-gray-300 dark:text-slate-700 font-medium tracking-wide">
              VEAM v1.0 — veam-energy.vercel.app
            </p>
          </div>
        </div>{/* end RIGHT COLUMN */}
        </div>{/* end desktop grid */}
      </div>

      {/* SETTINGS DRAWER */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 flex flex-col max-h-[90vh] sm:max-h-[85vh]">
            <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-slate-700" />
            </div>
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Edit Profile</p>
                <p className="text-[11px] text-gray-400 dark:text-slate-500">Customize your account</p>
              </div>
              <button onClick={() => setShowSettings(false)}
                className="ml-auto w-8 h-8 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4 text-gray-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto flex-1">

              {/* ── Photos row ── */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Photos</label>
                <div className="flex gap-3">
                  {/* Avatar picker */}
                  <button
                    onClick={() => editAvatarRef.current?.click()}
                    className="flex-1 relative group rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 bg-gray-50 dark:bg-slate-800/50"
                    style={{ height: "80px" }}
                  >
                    {editAvatar
                      ? <img src={editAvatar} alt="avatar preview" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                            <Camera className="w-4 h-4 text-indigo-400" />
                          </div>
                          <span className="text-[9px] font-semibold text-gray-400">Profile</span>
                        </div>
                    }
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                      <Camera className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                  <input ref={editAvatarRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setEditAvatar(ev.target?.result as string); r.readAsDataURL(f); }} />

                  {/* Cover picker */}
                  <button
                    onClick={() => editCoverRef.current?.click()}
                    className="flex-[2] relative group rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-200 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/20 dark:to-purple-900/20"
                    style={{ height: "80px" }}
                  >
                    {editCover
                      ? <img
                          src={editCover}
                          alt="cover preview"
                          className="w-full h-full object-cover"
                          style={{ objectPosition: `center ${editCoverOffsetY}%` }}
                        />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                            <ImagePlus className="w-4 h-4 text-indigo-400" />
                          </div>
                          <span className="text-[9px] font-semibold text-gray-400">Cover Photo</span>
                        </div>
                    }
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                      <ImagePlus className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                  <input ref={editCoverRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = (ev) => setEditCover(ev.target?.result as string); r.readAsDataURL(f); }} />
                </div>

                {/* Cover position slider — only show when a cover image exists */}
                {editCover && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 flex items-center gap-1">
                        <MoveVertical className="w-3 h-3" />
                        Cover position
                      </span>
                      <span className="text-[10px] font-mono text-indigo-400">{Math.round(editCoverOffsetY)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0} max={100} step={1}
                      value={editCoverOffsetY}
                      onChange={(e) => setEditCoverOffsetY(Number(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #6366f1 ${editCoverOffsetY}%, #e2e8f0 ${editCoverOffsetY}%)`
                      }}
                    />
                    <div className="flex justify-between text-[9px] text-gray-300 dark:text-slate-700">
                      <span>Top</span><span>Center</span><span>Bottom</span>
                    </div>
                  </div>
                )}

                {/* Remove buttons */}
                {(editAvatar || editCover) && (
                  <div className="flex gap-2">
                    {editAvatar && (
                      <button onClick={() => setEditAvatar("")} className="text-[10px] text-red-400 hover:text-red-500 transition-colors">
                        Remove profile photo
                      </button>
                    )}
                    {editAvatar && editCover && <span className="text-[10px] text-gray-200 dark:text-slate-700">·</span>}
                    {editCover && (
                      <button onClick={() => setEditCover("")} className="text-[10px] text-red-400 hover:text-red-500 transition-colors">
                        Remove cover
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Display Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                  placeholder="VEAM User"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-slate-600 pointer-events-none" />
                  <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Device Use</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { id: "household", label: "For Household", icon: <Home className="w-4 h-4" /> },
                    { id: "business",  label: "For Business",  icon: <Building2 className="w-4 h-4" /> },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEditDeviceUse(opt.id)}
                      className={"flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 " +
                        (editDeviceUse === opt.id
                          ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400"
                          : "border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-600"
                        )}
                    >
                      {opt.icon}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Device Serial ID</label>
                <input type="text" value={editSerial} onChange={(e) => setEditSerial(e.target.value.toUpperCase())}
                  placeholder="VEAM-2026-XXXXXX"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 transition-all" />
              </div>
              <Button onClick={saveSettings}
                className="w-full h-11 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30 transition-all">
                {settingsSaved
                  ? <span className="flex items-center gap-2"><Save className="w-4 h-4" />Saved!</span>
                  : <span className="flex items-center gap-2"><Save className="w-4 h-4" />Save Changes</span>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVACY MODAL */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPrivacy(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <p className="text-sm font-bold text-white">Privacy and Data Policy</p>
              <button onClick={() => setShowPrivacy(false)}
                className="ml-auto w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
            <div className="p-5 space-y-2.5 max-h-[55vh] overflow-y-auto">
              {[
                { title: "Data Collection", text: "VEAM collects electrical parameters (voltage, current, power, frequency) from your IoT device. No personal data is shared with third parties." },
                { title: "Data Storage",    text: "All energy data is stored securely in your linked Google Sheets account. VEAM does not retain data on external servers." },
                { title: "AI Analysis",     text: "Energy data is sent to Groq AI for analysis. This data contains no personally identifiable information." },
                { title: "Your Rights",     text: "You can request deletion of all your data at any time by deleting your account." },
              ].map((s) => (
                <div key={s.title} className="p-3.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">{s.title}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-slate-800">
              <Button onClick={() => setShowPrivacy(false)}
                className="w-full h-10 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold">
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDelete(false)} />
          <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {!delDone ? (
              <>
                <div className="bg-gradient-to-r from-red-500 to-rose-600 px-5 py-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <Trash2 className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white">Delete Account</p>
                  <button onClick={() => setShowDelete(false)}
                    className="ml-auto w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30">
                    <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
                      This action is <strong>permanent</strong>. All your energy data, settings, and device configuration will be deleted.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Device Serial ID</label>
                    <input type="text" value={delSerial} onChange={(e) => setDelSerial(e.target.value.toUpperCase())}
                      placeholder={deviceId}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Account Password</label>
                    <input type="password" value={delPass} onChange={(e) => setDelPass(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/30 transition-all" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <Button onClick={() => setShowDelete(false)} variant="outline"
                      className="h-11 rounded-xl border-gray-200 dark:border-slate-700 dark:text-slate-300">Cancel</Button>
                    <Button onClick={() => setDelDone(true)}
                      disabled={delSerial !== deviceId || delPass.length < 4}
                      className="h-11 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md disabled:opacity-50">
                      Confirm Delete
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mx-auto">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-sm font-black">+</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Request Received</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">Demo Mode — no actual data was deleted.</p>
                <Button onClick={() => setShowDelete(false)}
                  className="w-full h-10 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-semibold">
                  Close
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
