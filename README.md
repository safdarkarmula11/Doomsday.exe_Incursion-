# Content & Marketing Studio

Track 4 | Incursion Hackathon | ACM NIT Surat

Turns a plain-English request into print-ready ID cards (PDF, PNG, SVG).

## Tech stack
Next.js, Tailwind CSS, react-konva, Puppeteer, PostgreSQL + Prisma, Hugging Face Inference API

## Setup
1. Clone the repo and run `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (your local PostgreSQL)
   - `HF_TOKEN` (free token from huggingface.co/settings/tokens)
3. Run `npx prisma generate`
4. Run `npm run dev` and open http://localhost:3000

## Team rules
- Pick a task from the task list, tell the group, then work on it
- Create a branch per task (`task-3-renderer`), never push straight to main
- Pull before you start, open a pull request when you finish
- Never commit `.env` or `node_modules`