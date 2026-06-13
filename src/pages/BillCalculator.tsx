import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Zap,
  Flame,
  Calculator,
  ChevronDown,
  ChevronUp,
  Save,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";

// ── Sonelgaz electricity tranches ─────────────────────────────────────────
function calcElecBill(dailyKwh: number, days: number): number {
  const kwh = dailyKwh * days;
  const t1 = 125 * (days / 30);
  const t2 = 250 * (days / 30);
  const t3 = 1000 * (days / 30);
  let bill = 0;
  if (kwh <= t1) {
    bill = kwh * 1.7787;
  } else if (kwh <= t2) {
    bill = t1 * 1.7787 + (kwh - t1) * 4.1789;
  } else if (kwh <= t3) {
    bill = t1 * 1.7787 + t1 * 4.1789 + (kwh - t2) * 4.8120;
  } else {
    bill = t1 * 1.7787 + t1 * 4.1789 + (t3 - t2) * 4.8120 + (kwh - t3) * 5.48;
  }
  return Math.round(bill);
}

// ── Sonelgaz gas tranches (annual Th) ─────────────────────────────────────
function calcGasBill(th: number): number {
  if (th <= 0) return 0;
  let bill = 0;
  if (th <= 2500)       bill = th * 0.168;
  else if (th <= 5000)  bill = 2500 * 0.168 + (th - 2500) * 0.324;
  else if (th <= 15000) bill = 2500 * 0.168 + 2500 * 0.324 + (th - 5000) * 0.402;
  else                  bill = 2500 * 0.168 + 2500 * 0.324 + 10000 * 0.402 + (th - 15000) * 0.60;
  return Math.round(bill);
}

// ── Default tax config — based on real Sonelgaz bill ──────────────────────
const DEFAULT_TAXES = {
  tva9:        { label: "TVA 9%",              value: 9,   unit: "%",  enabled: true,  desc: "Taxe sur énergie (taux réduit)" },
  tva19:       { label: "TVA 19%",             value: 19,  unit: "%",  enabled: true,  desc: "Taxe sur redevances & services" },
  redevance:   { label: "Redevances Fixes",    value: 164, unit: "DA", enabled: true,  desc: "Abonnement réseau HT" },
  habitation:  { label: "Taxe d'Habitation",   value: 200, unit: "DA", enabled: true,  desc: "Services municipaux" },
  droitFixe:   { label: "Droit Fixe",          value: 100, unit: "DA", enabled: true,  desc: "Droit fixe sur consommation" },
  timbre:      { label: "Timbre Fiscal",        value: 37,  unit: "DA", enabled: true,  desc: "Appliqué une fois par facture" },
};

type TaxKey = keyof typeof DEFAULT_TAXES;

interface TaxItem {
  label: string;
  value: number;
  unit: string;
  enabled: boolean;
  desc: string;
}

// ── Animated number ────────────────────────────────────────────────────────
function AnimatedValue({ target }: { target: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const dur = 800;
    const start = Date.now();
    const from = count;
    const animate = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(from + (target - from) * e));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target]);
  return <span>{count.toLocaleString()}</span>;
}

// ── Tranche badge ──────────────────────────────────────────────────────────
function TrancheBadge({ kwh, days }: { kwh: number; days: number }) {
  const scaled1 = 125 * (days / 30);
  const scaled2 = 250 * (days / 30);
  const scaled3 = 1000 * (days / 30);
  let tranche = 1;
  let color = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";
  if (kwh > scaled3) { tranche = 4; color = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"; }
  else if (kwh > scaled2) { tranche = 3; color = "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"; }
  else if (kwh > scaled1) { tranche = 2; color = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"; }
  return (
    <span className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + color}>
      Tranche {tranche}
    </span>
  );
}

export default function BillCalculator() {
  const [dailyKwh, setDailyKwh]       = useState<string>("21.6");
  const [billingDays, setBillingDays]  = useState<30 | 60 | 70>(70);
  const [gasTh, setGasTh]             = useState<string>("0");
  const [includeGas, setIncludeGas]   = useState(false);
  const [taxes, setTaxes]             = useState<Record<TaxKey, TaxItem>>(DEFAULT_TAXES);
  const [showTaxPanel, setShowTaxPanel] = useState(false);
  const [taxSaved, setTaxSaved]       = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("veam_taxes_v2");
      if (saved) setTaxes(JSON.parse(saved));
      const savedKwh = localStorage.getItem("veam_calc_kwh");
      if (savedKwh) setDailyKwh(savedKwh);
      const savedGas = localStorage.getItem("veam_calc_gas");
      if (savedGas) setGasTh(savedGas);
    } catch { /* ignore */ }
  }, []);

  const saveTaxes = () => {
    localStorage.setItem("veam_taxes_v2", JSON.stringify(taxes));
    localStorage.setItem("veam_calc_kwh", dailyKwh);
    localStorage.setItem("veam_calc_gas", gasTh);
    setTaxSaved(true);
    setTimeout(() => setTaxSaved(false), 2000);
  };

  const resetTaxes = () => {
    setTaxes(DEFAULT_TAXES);
    localStorage.removeItem("veam_taxes_v2");
  };

  const updateTax = (key: TaxKey, field: "value" | "enabled", val: number | boolean) => {
    setTaxes(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  const kwh          = parseFloat(dailyKwh) || 0;
  const th           = parseFloat(gasTh)    || 0;
  const elecCost     = calcElecBill(kwh, billingDays);
  const gasCost      = includeGas ? calcGasBill(th) : 0;
  const energyTotal  = elecCost + gasCost;
  const totalKwh     = kwh * billingDays;

  // TVA 9% applies to energy (electricity + gas)
  const tva9Val      = taxes.tva9.enabled   ? Math.round(energyTotal * (taxes.tva9.value / 100))   : 0;
  // TVA 19% applies to redevances fixes only
  const redevanceVal = taxes.redevance.enabled ? taxes.redevance.value : 0;
  const tva19Val     = taxes.tva19.enabled  ? Math.round(redevanceVal * (taxes.tva19.value / 100)) : 0;
  const habitationVal= taxes.habitation.enabled ? taxes.habitation.value : 0;
  const droitFixeVal = taxes.droitFixe.enabled  ? taxes.droitFixe.value  : 0;
  const timbreVal    = taxes.timbre.enabled      ? taxes.timbre.value     : 0;

  const totalTaxes   = tva9Val + tva19Val + redevanceVal + habitationVal + droitFixeVal + timbreVal;
  const grandTotal   = energyTotal + totalTaxes;

  const taxColors: Record<TaxKey, string> = {
    tva9:       "from-purple-500 to-violet-600",
    tva19:      "from-pink-500 to-rose-600",
    redevance:  "from-slate-500 to-gray-600",
    habitation: "from-blue-500 to-indigo-600",
    droitFixe:  "from-emerald-500 to-teal-600",
    timbre:     "from-amber-500 to-orange-600",
  };

  const periodLabel = billingDays === 30 ? "Monthly" : billingDays === 60 ? "Bi-Monthly" : "Bi-Monthly (~70 days)";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="relative rounded-2xl overflow-hidden h-36 md:h-44">
        <img
          src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&q=80"
          alt="Bill Calculator"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 to-indigo-900/70 flex items-center px-6 md:px-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calculator className="w-5 h-5 text-indigo-300" />
              <span className="text-indigo-300 text-sm font-medium">Sonelgaz-Based Estimation</span>
            </div>
            <h2 className="text-white text-xl md:text-2xl font-bold">Bill Calculator</h2>
            <p className="text-slate-300 text-sm mt-1">Estimate your electricity & gas bill with real Algerian tariffs</p>
          </div>
        </div>
      </div>

      {/* Billing Period Toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Billing Period:</span>
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {([30, 60, 70] as const).map(d => (
            <button
              key={d}
              onClick={() => setBillingDays(d)}
              className={"text-xs font-semibold px-4 py-1.5 rounded-lg transition-all " +
                (billingDays === d
                  ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300")}
            >
              {d === 30 ? "1 Month" : d === 60 ? "2 Months" : "~70 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Electricity Input */}
      <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-none dark:bg-gray-900 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Electricity Consumption</CardTitle>
            <p className="text-xs text-gray-400">Average daily usage</p>
          </div>
          {kwh > 0 && <TrancheBadge kwh={totalKwh} days={billingDays} />}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Daily Consumption (kWh)</label>
            <div className="relative">
              <input
                type="number"
                value={dailyKwh}
                onChange={e => setDailyKwh(e.target.value)}
                placeholder="e.g. 21.6"
                className="w-full h-10 px-3 pr-16 text-sm rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-indigo-400 bg-gray-50 dark:bg-gray-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">kWh/day</span>
            </div>
          </div>

          {kwh > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tarification — {billingDays} days</p>
              {[
                { range: "0 – " + Math.round(125*(billingDays/30)) + " kWh", rate: "1.7787", color: "bg-green-500" },
                { range: Math.round(125*(billingDays/30)) + " – " + Math.round(250*(billingDays/30)) + " kWh", rate: "4.1789", color: "bg-blue-500" },
                { range: Math.round(250*(billingDays/30)) + " – " + Math.round(1000*(billingDays/30)) + " kWh", rate: "4.8120", color: "bg-amber-500" },
                { range: "> " + Math.round(1000*(billingDays/30)) + " kWh", rate: "5.48", color: "bg-red-500" },
              ].map(t => (
                <div key={t.rate} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center gap-2">
                    <div className={"w-2 h-2 rounded-full flex-shrink-0 " + t.color} />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.range}</span>
                  </div>
                  <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{t.rate} DA/kWh</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Total ({Math.round(totalKwh)} kWh)</span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400">{elecCost.toLocaleString()} DA</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gas Input */}
      <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-none dark:bg-gray-900 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 to-teal-500" />
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Gas Consumption</CardTitle>
            <p className="text-xs text-gray-400">Consumption per billing period (Thermies)</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={"text-xs font-medium " + (includeGas ? "text-gray-900 dark:text-white" : "text-gray-400")}>
              {includeGas ? "ON" : "OFF"}
            </span>
            <Switch checked={includeGas} onCheckedChange={setIncludeGas} />
          </div>
        </CardHeader>
        <CardContent className={"space-y-4 transition-opacity duration-300 " + (includeGas ? "opacity-100" : "opacity-40 pointer-events-none")}>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Consumption (Th)</label>
            <div className="relative">
              <input
                type="number"
                value={gasTh}
                onChange={e => setGasTh(e.target.value)}
                placeholder="e.g. 5496"
                className="w-full h-10 px-3 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-emerald-400 bg-gray-50 dark:bg-gray-800 dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">Th</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tarification gaz</p>
            {[
              { range: "0 – 2,500 Th",      rate: "0.168", color: "bg-green-500"  },
              { range: "2,500 – 5,000 Th",  rate: "0.324", color: "bg-blue-500"   },
              { range: "5,000 – 15,000 Th", rate: "0.402", color: "bg-amber-500"  },
              { range: "> 15,000 Th",        rate: "0.60", color: "bg-red-500"    },
            ].map(t => (
              <div key={t.rate} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                  <div className={"w-2 h-2 rounded-full flex-shrink-0 " + t.color} />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.range}</span>
                </div>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{t.rate} DA/Th</span>
              </div>
            ))}
            {includeGas && th > 0 && (
              <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 mt-2">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Gas Total ({th} Th)</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{gasCost.toLocaleString()} DA</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Taxes & Fees */}
      <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-none dark:bg-gray-900 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 to-purple-600" />
        <CardHeader className="pb-3 flex flex-row items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white">Taxes & Fees</CardTitle>
            <p className="text-xs text-gray-400">Editable — saved per device</p>
          </div>
          <button
            onClick={() => setShowTaxPanel(p => !p)}
            className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 transition-colors"
          >
            {showTaxPanel ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Edit</>}
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(taxes) as [TaxKey, TaxItem][]).map(([key, tax]) => (
              <div key={key} className={"flex items-center justify-between px-2.5 py-2 rounded-xl transition-opacity " + (tax.enabled ? "bg-gray-50 dark:bg-gray-800" : "bg-gray-50/50 dark:bg-gray-800/50 opacity-50")}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={"w-2 h-2 rounded-full flex-shrink-0 bg-gradient-to-r " + taxColors[key]} />
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{tax.label}</span>
                </div>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 flex-shrink-0 ml-1">
                  {tax.unit === "%" ? "+" + tax.value + "%" : "+" + tax.value + " DA"}
                </span>
              </div>
            ))}
          </div>

          {showTaxPanel && (
            <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
              {(Object.entries(taxes) as [TaxKey, TaxItem][]).map(([key, tax]) => (
                <div key={key} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800">
                  <div className={"w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 " + taxColors[key]}>
                    <span className="text-white text-[10px] font-bold">{tax.unit === "%" ? "%" : "DA"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{tax.label}</p>
                    <p className="text-[10px] text-gray-400 truncate">{tax.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      value={tax.value}
                      onChange={e => updateTax(key, "value", parseFloat(e.target.value) || 0)}
                      className="w-16 h-8 px-2 text-xs text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:border-violet-400"
                    />
                    <Switch checked={tax.enabled} onCheckedChange={v => updateTax(key, "enabled", v)} />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  onClick={saveTaxes}
                  className="flex-1 h-9 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white rounded-xl text-xs font-medium"
                >
                  {taxSaved
                    ? <span>✅ Saved!</span>
                    : <span className="flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Save Settings</span>}
                </Button>
                <Button onClick={resetTaxes} variant="outline" className="h-9 px-3 rounded-xl text-xs border-gray-200 dark:border-gray-700 dark:text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bill Summary */}
      <Card className="border-0 shadow-md shadow-gray-100 dark:shadow-none dark:bg-gray-900 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 to-purple-600" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calculator className="w-4 h-4 text-indigo-500" />
            Bill Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[
            { label: "Electricity (" + Math.round(totalKwh) + " kWh)", value: elecCost, color: "text-amber-600 dark:text-amber-400", show: true },
            { label: "Gas (" + th + " Th)", value: gasCost, color: "text-emerald-600 dark:text-emerald-400", show: includeGas && th > 0 },
            { label: taxes.redevance.label, value: redevanceVal, color: "text-slate-600 dark:text-slate-400", show: taxes.redevance.enabled },
            { label: taxes.tva9.label + " (sur énergie)", value: tva9Val, color: "text-purple-600 dark:text-purple-400", show: taxes.tva9.enabled },
            { label: taxes.tva19.label + " (sur redevances)", value: tva19Val, color: "text-pink-600 dark:text-pink-400", show: taxes.tva19.enabled && taxes.redevance.enabled },
            { label: taxes.habitation.label, value: habitationVal, color: "text-blue-600 dark:text-blue-400", show: taxes.habitation.enabled },
            { label: taxes.droitFixe.label, value: droitFixeVal, color: "text-emerald-600 dark:text-emerald-400", show: taxes.droitFixe.enabled },
            { label: taxes.timbre.label, value: timbreVal, color: "text-amber-600 dark:text-amber-400", show: taxes.timbre.enabled },
          ].filter(item => item.show).map((item, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
              <span className={"text-xs font-semibold " + item.color}>+{item.value.toLocaleString()} DA</span>
            </div>
          ))}

          <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-100 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  Estimated {periodLabel} Bill
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">incl. all taxes & fees</p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    <AnimatedValue target={grandTotal} />
                  </span>
                  <span className="text-sm font-medium text-gray-400">DA</span>
                </div>
              </div>
            </div>
            {totalTaxes > 0 && (
              <div className="mt-2 pt-2 border-t border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Taxes & Fees total</span>
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">+{totalTaxes.toLocaleString()} DA</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mt-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
              Estimation uniquement — basée sur les tarifs Sonelgaz en vigueur.
              La facture officielle reste la référence.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
