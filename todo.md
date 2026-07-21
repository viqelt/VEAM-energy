# VEAM — Development Tracker

> **Visual Energy Analytics & Monitoring**  
> Master 2 Graduation Project — Industrial Electrotechnics  
> Mohamed Cherif Messaadia University, Souk Ahras, Algeria 🇩🇿

---

## ✅ Completed

### Hardware
- [x] ESP32 + PZEM-004T module + Open CT sensor integration
- [x] Real-time data transmission to Google Sheets via HTTP POST
- [x] Single current clamp NILM-ready hardware setup

### Web Dashboard (React / TypeScript / Vite)
- [x] Real-time monitoring — Voltage, Current, Active Power, Power Factor, Frequency
- [x] Interactive graphs & historical data visualization (Recharts)
- [x] Sonelgaz-accurate bill calculator (correct TVA rates & billing periods)
- [x] NILM-inspired appliance detection via Groq AI (openai/gpt-oss-120b)
- [x] WhatsApp alert notifications
- [x] User profile & settings page
- [x] Firebase Authentication (Email / Password)
- [x] Vercel serverless proxy for Groq API key security

### ML Research (Standalone)
- [x] DSUAL dataset integration (ualm2.h5 — 6 OZM meters, Almeria University)
- [x] K-Means clustering pipeline v2 (Hungarian algorithm + SMOTE + rolling power-range feature)
- [x] K-Means accuracy: ~63.49% (Silhouette: 0.454)
- [x] Random Forest classifier — superseded K-Means, 99.33% accuracy on DSUAL dataset
- [x] Standalone HTML comparison page — K-Means vs Groq AI (GitHub Pages)
- [x] IEEE-style scientific article finalized (peer-reviewed corrections applied)

### Deployment
- [x] Deployed on Vercel — [veam-energy.vercel.app](https://veam-energy.vercel.app)
- [x] pnpm lockfile & Vercel build pipeline stable
- [x] Groq model migration: llama-3.3-70b-versatile (deprecated) → openai/gpt-oss-120b

---

## 🔄 In Progress

- [ ] Jury / committee presentation preparation
- [ ] Final documentation review
- [ ] NILM classification bug — intermittent "Unknown" results in AIPrediction.tsx (traced to token truncation; max_completion_tokens: 4096 + reasoning_effort: "low" partially resolved)

---

## 🚀 Future Improvements

- [ ] Multi-room / multi-sensor support
- [ ] Mobile app (React Native)
- [ ] On-device ML model (TensorFlow Lite on ESP32)
- [ ] Chatbot assistant on Help & Contact page
- [ ] Export energy reports as PDF
- [ ] Deterministic local rule-based JS fallback for device classification (remove Groq API dependency for standard cases)
- [ ] Multi-tenant data architecture: migrate from single shared Google Sheet to Firebase Firestore with per-user device pairing, enabling multiple customers to register and use isolated dashboards (required before productization)
- [ ] Adaptive tariff optimization: recommend optimal operating times for high-power appliances based on Sonelgaz tariff periods and historical user behavior

### Agentic NILM (research direction — post-PFE scope)
- [ ] **Phase 1 — Confidence-gated loop (minimal, defensible scope):** retry Groq analysis with additional context (previous days' data) when NILM confidence < 70%. Add basic sanity-check rules (e.g. flag implausible wattage readings based on configurable appliance power ranges) before triggering re-analysis. Keep the majority of the pipeline local and deterministic, invoking the LLM only for ambiguous or low-confidence cases.
- [ ] **Phase 2 — Multi-agent pipeline (larger vision, not recommended before PFE defense):**
  - Agent 1 — Data cleaning: removes noise/outliers from raw ESP32 readings before analysis
  - Agent 2 — NILM inference: runs appliance detection (current rule engine + Groq)
  - Agent 3 — Result review: sanity-checks Agent 2's output against configurable appliance power ranges (e.g. flags an implausible fridge reading) and triggers re-analysis on contradiction
  - Agent 4 — Trend comparison: compares today's usage pattern against historical data (e.g. AC running 16h vs 4h last week) and triggers a user alert on significant deviation
  - Agent 5 — Learning loop: if the user corrects a misclassification, update local rule/confidence weights to improve future inference, without immediately retraining the underlying ML model
  - Moves the system toward an Agentic NILM architecture, where autonomous agents iteratively validate, refine, and improve appliance disaggregation results — not an established academic term, but a useful architectural direction and a stronger differentiator for a startup pitch than a PFE feature, given the added orchestration and testing complexity

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32, PZEM-004T, Open CT sensor |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| AI Engine | Groq AI — openai/gpt-oss-120b |
| Auth | Firebase Authentication |
| Deployment | Vercel (serverless functions) |
| Data Backend | Google Sheets API (single-tenant, see Future Improvements) |
| ML Research | Python, Scikit-learn, Random Forest, SMOTE |

---

*Last updated: July 2026*