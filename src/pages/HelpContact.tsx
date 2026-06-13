import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Mail,
  Send,
  User,
  MessageSquare,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  Zap,
  X,
  ChevronDown,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── VEAM Assistant System Prompt ─────────────────────────────────────────────
const VEAM_SYSTEM_PROMPT = `You are VEAM Assistant, a friendly and knowledgeable AI helper for VEAM (Voltage Energy Analysis & Monitor) — a smart home energy monitoring system designed for Algerian households.

VEAM COMPLETE KNOWLEDGE BASE:

1. LOGIN & ACCOUNT:
- Sign up: enter first name, last name, email, and password.
- Login: enter email and password.
- Forgot password: click "Forgot my password" and a reset link is sent to your email (currently disabled in Demo mode).
- After login, enter your Device Serial Number found on the device box.

2. HOME PAGE:
- Real-time data every 3 seconds: Voltage (V), Current (A), Power (W), Power Factor, Frequency (Hz).
- Sonelgaz Dynamic Tarification: estimates monthly bill in real time based on current power.
- Gas input: user manually enters the difference between current gas meter reading and last bill reading (in Thermies).
- Data stored on Google Sheets automatically when WiFi is available. If offline, saved in device memory and uploaded when connection is restored. Manual "Upload Data from Device" button is also available.
- Energy Score: rates consumption as Good, Fair, or Poor.
- Dark mode available via toggle in the top bar.

3. GRAPHS & ANALYSIS PAGE:
- Real data from Google Sheets.
- Shows: Average Power, Peak Power, Daily kWh, Average Voltage, Power Factor.
- Filters: Day (last 24h), 7 Days, Month (30 days).
- Charts: Energy vs Time, Peak Consumption, Voltage & Power Factor.
- Groq AI explains each chart in simple language. Text-to-speech button reads explanations aloud.

4. AI PREDICTION PAGE:
- Press "Upload" button to send data to Groq AI for analysis.
- Estimated Bill: shows projected bill if consumption continues at current rate (Last Month or All Data).
- Potential Savings: estimated savings if AI recommendations are followed.
- AI Recommendations: 3 personalized energy-saving tips.
- Stats: Daily Energy (kWh), Average Power (W), Peak Power (W), Peak Time.
- Top Energy Consumers (NILM-Inspired): divides data into 5 power regions (A to E) and estimates likely appliance categories based on power signatures (Power, Current, Power Factor, usage time).
  Region A: 0-400W (lights, chargers, routers)
  Region B: 400-800W (fans, small appliances)
  Region C: 800-1200W (computers, TVs, microwaves)
  Region D: 1200-1700W (washing machines, ovens)
  Region E: 1700W+ (air conditioners, water heaters, pumps)
- NILM-Inspired Appliance Detection means estimating appliance categories from a single power cable using real electrical data (Power, PF, Current) and Groq AI inference. It is inspired by NILM methodology but uses LLM-based classification, not a trained ML model.
- Before running the analysis: user must enter their home appliances (name, daily usage hours, quantity) to constrain and improve estimation accuracy.
- Each appliance shows: Average Power (W), Monthly Energy (kWh), Estimated Cost (DA).
- Carbon Footprint: kg of CO2 per month and equivalent km driven by car.
- Disclaimer: prediction is approximately 70-75% accurate and may vary.

5. NOTIFICATIONS PAGE:
- Shows Critical, Warning, and Info alerts.
- Set Power Limit (W) and Bill Limit (DA). Live alert appears when exceeded.
- WhatsApp Alerts: enter phone number with country code (e.g. +213XXXXXXXXX), enable toggle. VEAM sends WhatsApp message when limits are exceeded. Second phone number can be added.
- Test button available to verify WhatsApp connection.

6. BILL CALCULATOR PAGE:
- Estimates electricity and gas bill using official Sonelgaz tariffs.
- Billing periods: 1 Month, 2 Months, or Trimestre.
- Electricity tranches: 0-125 kWh at 1.7787 DA/kWh, 125-250 kWh at 4.1789 DA/kWh, 250-1000 kWh at 4.8120 DA/kWh, above 1000 kWh at 5.48 DA/kWh.
- Gas tranches: 0-2500 Th at 0.168 DA/Th, 2500-5000 Th at 0.324 DA/Th, 5000-15000 Th at 0.402 DA/Th, above 15000 Th at 0.60 DA/Th.
- Taxes: TVA 9%, TVA 19%, Redevances Fixes 164 DA, Taxe d'Habitation 200 DA, Droit Fixe 100 DA, Timbre Fiscal 37 DA.

7. PROFILE PAGE:
- Change password: enter old password, new password, confirm new password.
- Download energy report (Demo): choose date range, format (PDF, CSV, Excel), and content to include.

8. HELP & CONTACT PAGE:
- Contact form: Name, Email, Message (response within 24 hours).
- Email: viqsene@gmail.com
- FAQ: Device connects via WiFi using ESP32. Data updates every 3 seconds. AI accuracy is 85-92%.

9. HARDWARE:
- Device: ESP32 microcontroller + PZEM-004T V3.0 sensor.
- Measures: Voltage, Current, Active Power, Frequency, Power Factor, kWh.
- Offline storage in device memory when WiFi is unavailable.
- Serial number is on the device box, required for first login.

RULES:
- Be friendly, concise, and helpful.
- Use simple language for non-technical users.
- Answer only VEAM-related questions. Redirect other topics politely.
- Keep responses under 150 words unless truly needed.
- Always say NILM-Inspired when referring to appliance detection. It uses Groq AI inference on real power signatures, not a trained ML model or dedicated NILM dataset.
- If unsure, say: please contact support at viqsene@gmail.com.`;

// ─── Suggested Questions ──────────────────────────────────────────────────────
const SUGGESTIONS = [
  "How do I connect my device?",
  "How does NILM-Inspired detection work?",
  "How is my bill calculated?",
  "What do alert thresholds mean?",
];

// ─── AI Energy Orb SVG Component ─────────────────────────────────────────────
function EnergyOrb({ size = 28, pulse = true }: { size?: number; pulse?: boolean }) {
  return (
    <div
      style={{ width: size, height: size, position: "relative", flexShrink: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="orbGrad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </radialGradient>
          <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </radialGradient>
          <filter id="orbBlur">
            <feGaussianBlur stdDeviation="1.5" />
          </filter>
        </defs>
        {/* Outer glow */}
        <circle cx="14" cy="14" r="13" fill="url(#glowGrad)" filter="url(#orbBlur)" opacity="0.7" />
        {/* Main orb */}
        <circle cx="14" cy="14" r="10" fill="url(#orbGrad)" />
        {/* Shine highlight */}
        <ellipse cx="11" cy="10" rx="3.5" ry="2" fill="white" opacity="0.3" />
        {/* Energy bolt */}
        <path
          d="M15.5 7.5L11 14.5H14.5L12.5 20.5L18 13H14L15.5 7.5Z"
          fill="white"
          opacity="0.9"
        />
      </svg>
      {pulse && (
        <span
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            border: "2px solid rgba(99,102,241,0.4)",
            animation: "orbPulse 2s ease-in-out infinite",
          }}
        />
      )}
      <style>{`
        @keyframes orbPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.25); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Floating VEAM Chatbot Component ─────────────────────────────────────────
function VEAMAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    try {
      const conversationHistory = newMessages
        .map((m) => `${m.role === "user" ? "User" : "VEAM Assistant"}: ${m.content}`)
        .join("\n");

      const fullPrompt = `${VEAM_SYSTEM_PROMPT}\n\nConversation:\n${conversationHistory}\n\nVEAM Assistant:`;

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.text || "Sorry, I couldn't get a response. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please check your internet and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* ── Chat Panel ── */}
      <div
        className={`fixed bottom-24 right-5 z-50 w-[360px] max-w-[calc(100vw-24px)] transition-all duration-300 ease-out ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
        style={{ filter: "drop-shadow(0 20px 40px rgba(99,102,241,0.3))" }}
      >
        <div
          className="rounded-2xl overflow-hidden border border-indigo-100 dark:border-indigo-900 bg-white dark:bg-gray-900 flex flex-col"
          style={{ height: "520px" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 flex-shrink-0">
            <div className="flex items-center gap-3">
              <EnergyOrb size={32} pulse={false} />
              <div>
                <p className="text-white text-sm font-semibold leading-none">VEAM Assistant</p>
                <p className="text-indigo-200 text-xs mt-0.5">Powered by Groq AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {/* Minimize button */}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                aria-label="Minimize"
              >
                <ChevronDown className="w-4 h-4 text-white" />
              </button>
              {/* Close / fully dismiss button */}
              <button
                onClick={() => {
                  setOpen(false);
                  setMessages([]);
                  setShowSuggestions(true);
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/70 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
            {/* Welcome message */}
            {messages.length === 0 && (
              <div className="flex gap-2.5">
                <EnergyOrb size={28} pulse />
                <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm max-w-[240px]">
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
                    👋 Hi! I'm <strong>VEAM Assistant</strong>.
                    <br />I can help you understand your energy usage and VEAM features.
                  </p>
                </div>
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && messages.length === 0 && (
              <div className="flex flex-col gap-1.5 pl-9">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-xs px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-100 dark:border-indigo-800 font-medium"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Chat messages */}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && <EnergyOrb size={28} pulse={false} />}
                <div
                  className={`max-w-[230px] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-sm"
                      : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex gap-2.5">
                <EnergyOrb size={28} pulse />
                <div className="bg-white dark:bg-gray-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about VEAM..."
                disabled={loading}
                className="h-9 text-sm rounded-xl border-gray-200 dark:border-gray-700 focus:border-indigo-400 dark:bg-gray-800 dark:text-gray-100"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all"
              >
                {loading ? (
                  <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-1.5">For general inquiries and support</p>
          </div>
        </div>
      </div>

      {/* ── Floating Bubble Button ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl shadow-indigo-300/50 dark:shadow-indigo-900/50 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
        aria-label="Open VEAM Assistant"
      >
        {open ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <EnergyOrb size={30} pulse={false} />
        )}
        {/* Notification dot when closed */}
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-gray-900" />
        )}
      </button>
    </>
  );
}

// ─── Main HelpContact Page ─────────────────────────────────────────────────────
export default function HelpContact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setTimeout(() => {
      setStatus("sent");
      setName("");
      setEmail("");
      setMessage("");
      setTimeout(() => setStatus("idle"), 4000);
    }, 1500);
  };

  return (
    <>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Help & Contact</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Get in touch with our support team — or ask VEAM Assistant instantly ⚡
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-gray-900 dark:bg-gray-800 lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Send us a Message
                </CardTitle>
                <p className="text-xs text-gray-400">We typically respond within 24 hours</p>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Name
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="pl-10 h-11 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 focus:border-indigo-500 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                      Email
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="pl-10 h-11 border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 focus:border-indigo-500 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or question..."
                    rows={5}
                    className="border-gray-200 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100 focus:border-indigo-500 rounded-lg resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={status === "sending"}
                  className={`w-full sm:w-auto h-11 px-8 rounded-xl font-medium transition-all duration-300 ${
                    status === "sent"
                      ? "bg-green-500 hover:bg-green-600 shadow-green-200"
                      : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-indigo-200"
                  } text-white shadow-lg hover:shadow-xl`}
                >
                  {status === "sending" ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </div>
                  ) : status === "sent" ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Message Sent!</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      <span>Send Message</span>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Contact Info */}
          <div className="space-y-4">
            {/* AI Assistant Promo Card */}
            <Card className="border-0 shadow-md dark:bg-gray-800 overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-purple-600" />
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <EnergyOrb size={36} pulse />
                <div>
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    VEAM Assistant
                  </CardTitle>
                  <p className="text-xs text-gray-400">Instant AI support</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Get instant answers about device setup, dashboard features, billing, alerts, and NILM-Inspired appliance detection — powered by Groq AI.
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Online now — click the orb bubble</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-gray-900 dark:bg-gray-800">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Email Us
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <a
                  href="mailto:viqsene@gmail.com"
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm transition-colors group"
                >
                  <span>viqsene@gmail.com</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
                <p className="text-xs text-gray-400 mt-2">For general inquiries and support</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-gray-900 dark:bg-gray-800">
              <CardHeader className="pb-3 flex flex-row items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold text-gray-900 dark:text-gray-100">FAQ</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { q: "How does the IoT device connect?", a: "Via WiFi using ESP32 microcontroller" },
                  { q: "Is the data real-time?", a: "Yes, data updates every 3 seconds" },
                  { q: "How accurate is AI prediction?", a: "Approximately 70-75% accuracy" },
                ].map((faq, i) => (
                  <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{faq.q}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{faq.a}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating VEAM Assistant — renders outside the page flow */}
      <VEAMAssistant />
    </>
  );
}
