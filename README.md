# 🚀 CarbonX — Carbon Footprint Platform

> **A premium, modern web application** that helps individuals **understand, track, and reduce** their personal carbon footprint through simple lifestyle inputs, glassmorphic interactive charts, and AI-personalized insights.

Built with a **Python / FastAPI** backend and a **React + TypeScript** frontend, using **Google Gemini (Vertex AI)** for personalized advice and **Firestore** for tracking, designed with an ultra-premium, high-tech carbon-graphite and indigo-violet-magenta theme, and fully verified with **100% test coverage** on both backend and frontend.

---

## ✨ Features

- **Understand**: Input your lifestyle data (transportation, home energy, diet, and goods spending) to calculate your annual footprint broken down by category, compared against both the global average and a sustainable, Paris-aligned target.
- **Track**: Save snapshots of your footprint over time anonymously (tracked via a persistent device ID stored in `localStorage`) to visualize your trends.
- **Reduce**: Receive personalized, quantified actions targeting your highest emission categories first.
- **AI-Personalized Insights**: Powered by Google Gemini (Vertex AI) with a robust, deterministic rule-based engine fallback for offline and local development.
- **Premium High-Tech Design**: A beautiful, dark space-graphite to obsidian theme featuring glowing indigo/violet glassmorphic cards, typography from Google Fonts (**Outfit**), neon glowing accent states, custom scrollbars, and smooth `@keyframes` chart animations.
- **100% Test Coverage**: Both backend (`pytest`) and frontend (`vitest`) are covered with 100% statement and branch test coverage.
- **Accessibility (a11y)**: Built to comply with WCAG AA accessibility standards. Features semantic HTML5, explicit keyboard focus outlines, skip-to-main content navigation, and screen-reader polite status live announcements.

---

## 🛠️ Tech Stack & Architecture

```text
Browser (React + TS, Vite)              Local / Cloud Run
  • Glassmorphic UI + Charts   ──HTTP──► FastAPI Backend
  • Persistent Device ID                  ├─ POST /api/calculate  (Carbon engine)
                                          ├─ POST /api/insights   (Gemini / Rules)
                                          ├─ POST /api/entries     (Save snapshot)
                                          └─ GET  /api/entries/{id} (History & trends)
                                              │
                                              ├─► Vertex AI (Gemini)
                                              └─► Firestore (Native)
```

- **Frontend**: React 18, TypeScript 5, Vite 6, Vitest 2.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2.
- **Services**: Google Gemini (Vertex AI), Google Cloud Firestore.

---

## 🚀 Running Locally

### 1. Clone & Setup
First, clone the repository and navigate to the project directory:
```bash
git clone https://github.com/Arjun9311/Carbon-Footprint-Awareness-Platform.git
cd Carbon-Footprint-Awareness-Platform
```

### 2. Run the Backend (FastAPI)
Create a virtual environment, install dependencies, and launch the server.
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements-dev.txt

# Create .env from template (defaults to offline/local fallback settings):
cp .env.example .env

# Run with hot reloading on http://localhost:8000:
uvicorn app.main:app --reload
```

### 3. Run the Frontend (Vite + React)
Install npm dependencies and launch the dev server.
```bash
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173/ in your browser. API calls are proxied to port 8000.
```

---

## 🧪 Testing & Code Quality

Both backend and frontend are strictly typed and verified to have **100% test coverage**.

### Backend Tests (pytest)
Runs calculations, validation bounds, Firestore mock repository, Gemini parsing fallback, and endpoint tests:
```bash
cd backend
pytest --cov=app
```
*Achieved Coverage: **100.00%***

### Frontend Tests (vitest)
Runs component renders, hook states, accessibility assertions, and localStorage device ID persistence tests:
```bash
cd frontend
npm run test:coverage
```
*Achieved Coverage: **100% Statements, 100% Branches, 100% Functions, 100% Lines***

> **Note on Node v24/25 compatibility**: 
> Node v24/25 introduces an experimental native global `localStorage` object which conflicts with JSDOM's mock storage. We resolved this inside [`frontend/src/test/setup.ts`](frontend/src/test/setup.ts) by detecting the presence of the native read-only global and configuring a robust in-memory mock fallback, ensuring flawless test runs in all environments.

---

## 📦 Docker Container Build

To build and run the entire application (SPA + API) as a single container:
```bash
docker build -t carbon-platform .
docker run -p 8080:8080 -e USE_GEMINI=false -e USE_FIRESTORE=false carbon-platform
# Open http://localhost:8080
```

---

## ☁️ Google Cloud Run Deployment

Deploy the container directly to Cloud Run:
```bash
gcloud config set project virtual-prompt-week-3
gcloud run deploy carbon-platform \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars PROJECT_ID=virtual-prompt-week-3,REGION=us-central1,USE_GEMINI=true,USE_FIRESTORE=true
```

Ensure the runtime service account has `roles/aiplatform.user` (Gemini) and `roles/datastore.user` (Firestore) IAM roles.
