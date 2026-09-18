# ⚙️ GearGuard — AI-Powered Gearbox Health Monitoring System

<div align="center">

![GearGuard Banner](https://img.shields.io/badge/GearGuard-Predictive%20Maintenance-blueviolet?style=for-the-badge&logo=gear&logoColor=white)

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-gearguard.onrender.com-brightgreen?style=for-the-badge)](https://gearguard-75bz.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-meet--manav%2Fgearguard-black?style=for-the-badge&logo=github)](https://github.com/meet-manav/gearguard)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)

</div>

---

## 🌐 Live Demo

> **👉 [https://gearguard-75bz.onrender.com](https://gearguard-75bz.onrender.com)**

> ⚠️ *Note: The app may take 30–50 seconds to wake up on first visit (free tier sleep mode). Please wait a moment and refresh.*

---

## 📖 About

**GearGuard** is a real-time gearbox health monitoring and predictive maintenance system. It uses vibration signal analysis and AI-driven diagnostics to detect gearbox faults — helping prevent costly breakdowns before they happen.

The system simulates live sensor telemetry and can analyze uploaded vibration data files to classify gearbox conditions instantly.

---

## ✨ Features

- 📡 **Real-Time Telemetry Stream** — Live vibration signal visualization with RPM, RMS, Kurtosis & Crest Factor metrics
- 🤖 **AI Fault Detection** — Automatically classifies gearbox condition into:
  - ✅ Healthy
  - ⚠️ Surface Wear
  - 🔄 Misalignment
  - 💥 Broken Tooth
- 📂 **Custom File Upload** — Upload your own vibration data (CSV, TXT, images, PDFs) for instant analysis
- 📊 **Interactive Dashboard** — Live-updating charts with fault severity indicators
- 🔬 **Frequency Spectrum Analysis** — FFT-based frequency domain visualization
- 🎛️ **Condition Simulator** — Switch between gearbox conditions to simulate different fault states
- ⏸️ **Start / Pause Control** — Manual control over the telemetry stream

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript, Chart.js |
| **Backend** | Python, FastAPI, Uvicorn |
| **Data Processing** | Pandas, NumPy, SciPy, Scikit-learn |
| **Deployment** | Render (Cloud) |

---

## 🚀 Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/meet-manav/gearguard.git
cd gearguard

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start the server
uvicorn backend.app:app --host 0.0.0.0 --port 8000

# 4. Open in browser
# Visit: http://127.0.0.1:8000
```

---

## 📁 Project Structure

```
gearguard/
├── backend/
│   └── app.py          # FastAPI backend — signal processing & API routes
├── frontend/
│   ├── index.html      # Main dashboard UI
│   ├── css/
│   │   └── styles.css  # Dashboard styling
│   └── js/
│       └── app.js      # Frontend logic & telemetry stream
├── dataset/            # Gearbox vibration datasets
├── requirements.txt    # Python dependencies
├── render.yaml         # Render deployment config
└── README.md
```

---

## 📸 Screenshots

> Dashboard with real-time telemetry, fault classification, and signal visualization.

---

## 👨‍💻 Author

**Manav Chavda**
- GitHub: [@meet-manav](https://github.com/meet-manav)

---

<div align="center">
  Made with ❤️ for Predictive Maintenance
</div>
