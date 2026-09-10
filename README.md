# 🎮 Game Hub — Cyberpunk Neon Web Arcade

A full-stack, responsive web arcade featuring 5 retro & modern puzzle/strategy games built with React 18, Vite, and Python Flask.

---

## 🕹️ Games Included
1. ⚔️ **Chess Arena** (Stockfish/Minimax AI with 3 difficulties, SAN move log, Tactical Hint engine, 6 Time Controls & Dice color roll)
2. 🧩 **Color Flow Puzzle** (50 mathematically verified solvable levels across 5 packs, A* hint solver, dynamic SVG pipe tracing)
3. 🐥 **Floppy Bird** (Cyberpunk arcade mechanics, 4 game modes, custom unlockable skins, progressive speed engine)
4. ❌⭕ **Tic Tac Toe** (Minimax invincible AI, probability bar, pass & play, 3 difficulty tiers, dice roll modal)
5. 🔢 **2048** (Classic tile slider with Lookahead AI auto-solver, multiple grid sizes 3×3 to 6×6, undo history)

---

## 🚀 Deployment Guide

### Part 1: Deploy Backend on Render (Python Web Service)

1. Sign in to [Render](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`GameHub`).
4. Configure the settings:
   - **Name**: `gamehub-backend` (or your choice)
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn server:app`
5. Under **Environment Variables**, add:
   - `JWT_SECRET`: (e.g. `your_strong_secret_key_2026`)
   - `GOOGLE_CLIENT_ID`: `744551691173-9hef8f2pe0kkulqte9m2k9g3migj89aj.apps.googleusercontent.com`
   - `FRONTEND_URL`: `https://your-frontend-app.vercel.app` (your Vercel URL once deployed)
6. Click **Deploy Web Service**.
7. Copy your Render service URL (e.g., `https://gamehub-backend.onrender.com`).

---

### Part 2: Deploy Frontend on Vercel

1. Sign in to [Vercel](https://vercel.com/).
2. Click **Add New…** → **Project**.
3. Import your GitHub repository (`GameHub`).
4. In **Project Configuration**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `VITE_API_URL`: `https://gamehub-backend.onrender.com` (Your Render backend URL from Part 1)
   - `VITE_GOOGLE_CLIENT_ID`: `744551691173-9hef8f2pe0kkulqte9m2k9g3migj89aj.apps.googleusercontent.com`
6. Click **Deploy**.
7. Your app will be live at `https://gamehub-xyz.vercel.app`!

---

### Part 3: Google Cloud OAuth Configuration

To allow Google Sign-In on your deployed Vercel domain:
1. Open [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Edit your **OAuth 2.0 Client ID**.
3. Under **Authorized JavaScript origins**, add:
   - `https://your-frontend-app.vercel.app`
   - `http://localhost:5173`
   - `http://localhost:5174`
4. Under **Authorized redirect URIs**, add:
   - `https://your-frontend-app.vercel.app`
5. Click **Save**.

---

## 💻 Local Development

### Backend
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python server.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
