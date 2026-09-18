# Bokix

Bokix är en modern, webbaserad bokförings- och faktureringstjänst anpassad för svenska småföretag och entreprenörer.

---

## 🛠 Teknikstack

- **Frontend:** React 19, Vite, Tailwind CSS, Lucide Icons
- **Backend / API:** Node.js & Express / Vercel Serverless
- **Databas & Auth:** Supabase (PostgreSQL)
- **Tester:** Vitest, Playwright

---

## 🚀 Kom igång lokalt

### 1. Förutsättningar
- [Node.js](https://nodejs.org/) (version 18 eller senare)
- npm

### 2. Installation
Installera projektets beroenden:

```bash
npm install
```

### 3. Miljövariabler
Kopiera mallen `.env.example` till en ny fil med namnet `.env`:

```bash
cp .env.example .env
```

Fyll i nödvändiga lokala utvecklingsnycklar i `.env` vid behov (se `.env.example` för tillgängliga variabler).

### 4. Starta utvecklingsservern
Starta appen lokalt:

```bash
npm run dev
```

Appen öppnas vanligtvis på `http://localhost:5173`.

---

## 🧪 Skript och kommandon

- `npm run dev` – Startar lokal utvecklingsserver (Vite + backend)
- `npm test` – Kör hela testsviten med Vitest
- `npm run lint` – Kör oxlint för snabb kodgranskning
- `npm run build` – Bygger produktionspaketet
