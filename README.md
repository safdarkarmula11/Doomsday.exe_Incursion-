# Content & Marketing Studio — ID Card Designer

Incursion hackathon (ACM NIT Surat), **Track 4: Content & Marketing Studio**.
Describe an event in plain English and get print-ready ID cards for everyone, with ACM NIT Surat and SVNIT logos and a colour for each role.

**Live:** https://content-studio-sz54.onrender.com (free plan: the first load after idle takes about 50 seconds)

## How it works

1. **Request** – describe the event in plain English.
2. **Questions** – the app reads your text and asks only for what is missing (name, date, venue, roles, fields on the card, attendance link). It never invents event details.
3. **Drafts** – 3 distinct designs (Campus, Midnight, Aurora), each shown for every role. More designs (Noir, Geometric, your own) can be added.
4. **Editor** – click a layer to change its position, size, colour, text or font, or type a plain-English change such as "make the name bigger".
5. **People** – import a CSV (name, role, ID, optional photo link) and preview real cards.
6. **Export** – pre-flight check, then PDF (print-ready, with 3 mm bleed and crop marks), PNG (300 dpi), SVG, or print sheets (A4/A3) with a QR code per person.

No image-generation model is used. Cards are drawn as SVG from templates, so text and logos stay sharp at card size (CR80, 54 × 85.6 mm).

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind 4 · Prisma + PostgreSQL (Neon) · Zod · PapaParse · `qrcode` · Puppeteer (PDF/PNG) · pdf-lib · Hugging Face Inference API (optional, for reading the request and plain-English edits; a rule-based fallback works without it).

## Run locally

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL (and HF_TOKEN if you have one)
npx prisma db push          # creates the tables
npm run dev                 # http://localhost:3000
```

Needs Node 22+ and a PostgreSQL database. For PDF/PNG export run `npx puppeteer browsers install chrome` once, or set `PUPPETEER_EXECUTABLE_PATH` to an installed Chrome or Chromium.

### Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `APP_PASSCODE` | recommended | Turns on a passcode gate. Everything except the landing page then asks for it. Leave empty for open access on your own PC. |
| `DATABASE_URL` | yes | PostgreSQL URL. On Neon use the direct (non-pooled) string with `?sslmode=require`. |
| `HF_TOKEN` | no | Hugging Face token. Without it the app uses simple rule-based parsing. |
| `HF_MODEL` | no | Default `Qwen/Qwen2.5-7B-Instruct`. |
| `LLM_MODE` | no | `huggingface` (default) or `local`. |
| `PUPPETEER_EXECUTABLE_PATH` | no | Set automatically in the Docker image. |

## Deploy (Neon + Render)

1. Create a Neon project and copy the direct connection string.
2. Push this repo to GitHub.
3. On Render choose **New → Blueprint**, select the repo (it reads `render.yaml`) and set `DATABASE_URL`.
4. The `Dockerfile` installs Chromium and fonts (Liberation, DejaVu, FreeSans for Hindi and Gujarati), runs `prisma db push`, then starts the app.
5. Check `/api/health` returns `{"ok":true}`, then run one full flow and export a PDF.

The free Render plan has 512 MB of memory. Exports run one at a time to stay within it.

## People CSV

Columns are matched by name, so common variants work (`Name`, `Role`, `ID Number`, `Photo Link`). Other columns are kept.

```csv
Name,Role,ID Number,Photo Link,Department
Aarav Sharma,participant,PART-001,/sample-photos/p01.jpg,Computer Science
```

- Roles must match the event's roles; unknown roles can be mapped or skipped during import.
- Photo links must start with `https://` (or `/` for files in `public/`). People without a photo get their initials.
- Samples: `public/sample-people.csv` (no photos) and `public/sample-people-photos.csv` (12 people with placeholder avatars).

## Attendance QR codes and check-in

On the Questions step, click **Use this app's built-in check-in page**. Each card's QR then opens `/checkin/<project>/<ID>`; the person is marked as arrived and the phone shows their name, role and time. Scanning twice shows "Already checked in", and Undo removes a check-in.

`/checkin/<project>` is the staff list: arrived count per role, search, manual check-in, and a CSV download. Check-ins are kept if you import the people list again. The page asks for the passcode when `APP_PASSCODE` is set, so staff enter it once on their phone.

You can also type any other link; the person's ID is appended to it.

## Passcode

With `APP_PASSCODE` set, visitors see only the landing page until they enter it at `/unlock`. The passcode is never stored in the cookie, wrong guesses are rate-limited, and changing the passcode signs everyone out. Add it in Render under Environment.

## Keeping the free Render plan awake

Render's free plan sleeps after about 15 minutes. To avoid a 50-second first load, create a free monitor (for example UptimeRobot) that requests `https://<your-app>.onrender.com/api/health` every 5 minutes.

## Project layout

```
src/app/                 pages and API routes
src/lib/renderer/        SVG card renderer (text fitting, QR, images, gradients, shapes)
src/lib/templates/       built-in card designs (JSON)
src/lib/export/          PDF, PNG, sheets, bleed and crop marks, pre-flight checks
src/lib/                 event data, people import, editor config, LLM helpers
prisma/schema.prisma     database tables
Dockerfile, render.yaml  deployment
```

## Known limits

- Portrait cards only (CR80 54 × 85.6 mm).
- Card fonts are system fonts (Arial, Verdana, Georgia and similar).
- A PDF for everyone is split into parts of 50 cards.
- Hindi and Gujarati CSV headers are not matched automatically; names in those scripts render correctly.
- Posters and banners are not built; the ID card flow comes first.