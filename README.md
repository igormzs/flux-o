# 📊 Flux-o — Personal Finance Tracker

**Flux-o** is a slick, modern personal finance tracker designed to help you track spending effortlessy, analyze budgets with clean visualizations, and keep your financial health in check.

---

## ✨ Features

- **Dashboard**: Complete overview of your total balance, income, and recent transactions.
- **Visual Insights**: Charts and breakdowns to help you understand spending habits.
- **Secure Authentication**: Powerded by Supabase supporting Email sign-ins and Google OAuth.
- **User Profile Management**: Save settings, customize thresholds, manage active sessions.
- **Mobile First Design**: Fully responsive navigation seamlessly morphing from side navigations on desktop to bottom actions triggers on mobile.

---

## 🛠️ Built With

### Frontend Stack
- **[Vite](https://vitejs.dev/)** + **[React 18](https://react.dev/)** + **[TypeScript](https://www.typescriptlang.org/)** — for speeds and typesafety.
- **TailwindCSS** + **Shadcn/UI** — modular interface style & component standards.
- **[Framer Motion](https://www.framer.com/motion/)** — Micro-animations, slick transitions.
- **[Recharts](https://recharts.org/)** — Composited data visualizations.

### Infrastructure / Tools
- **[Supabase](https://supabase.com/)** — Auth system, Postgres storage endpoint.
- **TanStack React Query (v5)** — Synchronized caching datasets providers.
- **Vercel** — Automated production hosting deployment pipelines.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have **Node.js** (v18+) and **npm** installed.

### Setup Instructions

1. **Clone the repository**
   ```sh
   git clone https://github.com/igormzs/flux-o.git
   cd flux-o
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL="https://your-project.supabase.co"
   VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```
   *(Find these in your Supabase Dashboard → Settings → API)*

4. **Run local Server**
   ```sh
   npm run dev
   ```
   The app will typically load on `http://localhost:8080`

---

## ☁️ Deployment (Vercel)

This project includes a `vercel.json` file maintaining Single-Page Application (SPA) Router compatibility.

When deploying to Vercel:
1. Connect your Github Repo.
2. In **Project Settings → Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Trigger a Build (any git push to `main` auto-triggers deployment pipelines).

> ⚠️ **Important**: Ensure your Vercel URL is added to your Supabase Project **Authentication → URL Configuration** (Redirect URLs) list to enable OAuth/Magic credentials properly.
