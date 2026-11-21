# Fortuna.io

Mobile-first personal finance app. Import your bank statements, let it categorize the transactions, and see how much you can still spend this month.

**Live:** https://fortuna-io.vercel.app

## Features

- **Statement import** (CSV, OFX and PDF), including Nubank account PDFs parsed in the browser with pdf.js
- **Automatic categorization** by merchant, with optional community learning: anonymous merchant → category votes aggregated daily by a serverless cron job
- **Smart transfers:** Pix between your own accounts is treated as a transfer, and investment redemptions are deducted from the invested amount instead of counting as income
- **"How much can I still spend"** panel for the current month
- **Insights and charts** by category and period
- **Privacy mode** that hides amounts on screen, and installable as a PWA

## Stack

- React 19, TypeScript, Vite, Tailwind CSS 4
- Firebase (Auth, Firestore) on the client, `firebase-admin` in Vercel Functions (`api/`)
- Recharts for charts, pdf.js for statement parsing
- Vitest for tests, ESLint

## Running locally

```bash
npm install
npm run dev
```

Create a `.env` with your own Firebase web config before starting (never commit it).

```bash
npm test          # unit tests
npm run lint
npm run typecheck
npm run build
```

## Project structure

```
api/           Vercel serverless functions (community aggregation cron)
src/pages/     Dashboard, Transactions, Import, Insights, Wallet, Settings
src/services/  Firebase auth and access
src/lib/       Pure logic: categories, transfers, insights, community learning
src/lib/import Statement parsers (CSV, OFX, PDF) and the transaction classifier
```
