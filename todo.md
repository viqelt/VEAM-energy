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
- [x] NILM-inspired appliance detection via Groq AI (LLaMA 3.3 70B)
- [x] WhatsApp alert notifications
- [x] User profile & settings page
- [x] Firebase Authentication (Email / Password)
- [x] Vercel serverless proxy for Groq API key security

### ML Research (Standalone)
- [x] DSUAL dataset integration (ualm2.h5 — 6 OZM meters, Almeria University)
- [x] K-Means clustering pipeline v2 (Hungarian algorithm + SMOTE + rolling power-range feature)
- [x] K-Means accuracy: ~63.49% (Silhouette: 0.454)
- [x] Standalone HTML comparison page — K-Means vs Groq AI (GitHub Pages)
- [x] IEEE-style scientific article finalized (peer-reviewed corrections applied)

### Deployment
- [x] Deployed on Vercel — [veam-energy.vercel.app](https://veam-energy.vercel.app)
- [x] pnpm lockfile & Vercel build pipeline stable

---

## 🔄 In Progress

- [ ] Jury / committee presentation preparation
- [ ] Final documentation review

---

## 🚀 Future Improvements

- [ ] Multi-room / multi-sensor support
- [ ] Mobile app (React Native)
- [ ] Replace K-Means with Random Forest classifier for improved NILM accuracy
- [ ] On-device ML model (TensorFlow Lite on ESP32)
- [ ] Chatbot assistant on Help & Contact page
- [ ] Export energy reports as PDF

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32, PZEM-004T, Open CT sensor |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| AI Engine | Groq AI — LLaMA 3.3 70B |
| Auth | Firebase Authentication |
| Deployment | Vercel (serverless functions) |
| Data Backend | Google Sheets API |
| ML Research | Python, Scikit-learn, Random Forest, SMOTE |

---

*Last updated: June 2026*
