# Spec Builder

A focused web app for turning a rough idea into a clean, AI-ready software spec — in under a minute.

**[Open the app](https://specthinker.github.io/specbuild-web/)**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/specthinker/specbuild-web)

## What it does

Spec Builder gives you a structured form covering the seven sections every good spec needs: Goal, Scope, Files, Rules, Acceptance Criteria, Verification, and Output. Fill them in, and you get a polished Markdown, plain-text, or HTML spec you can hand to any AI coding agent.

## Why it exists

Most people start a new project by opening their main AI agent and typing a paragraph. The agent then asks six follow-up questions before it can even start. That costs tokens, time, and context window — and the spec it eventually produces lives only in that chat, where it dies the moment the session ends.

Spec Builder exists to fix that:

- **Stop wasting tokens on planning prompts.** Draft the spec once in a fast, cheap form, then paste the finished document into your main agent. Your main agent goes straight to building.
- **Get to a usable spec in one pass, not ten messages.** The required/optional structure of the form surfaces the questions you didn't know you needed to answer.
- **Keep the spec outside the chat.** Your spec is a file you own — copy it into a repo, share it with a teammate, reuse it for the next project in the same domain.
- **One-click AI Polish.** Hit the button and a real language model tightens the wording, fixes vague scope, and reformats the document for agent consumption. Counted against your monthly quota, never silent.
- **Dark or light, Markdown or HTML.** It looks the way you want and exports the format you need.

## Who it's for

- Solo developers starting a new project and tired of writing "make me a todo app" prompts.
- Engineers scoping work for a contractor or open-source contributor and want a shared spec format.
- Teams that want a lightweight planning ritual before kicking off an AI agent.

## Pricing

Two free specs to try it. From there:

- **Basic — $5/mo** — 30 specs a month.

See the live [pricing page](https://specthinker.github.io/specbuild-web/#pricing) for the latest.

## Contact form

The **Contact** link in the top nav opens a bug-report / feedback form. Delivery is wired to [Formspree](https://formspree.io) (free, ~2 min setup, 50 submissions/month). If `VITE_FORMSPREE_ID` is left empty, the form falls back to opening the visitor's mail app with a pre-filled message to `VITE_CONTACT_EMAIL` — still works, just less polished.

To enable proper form delivery:

1. Sign up at https://formspree.io using the address you want submissions delivered to (default: `muhammadkonecom@gmail.com`).
2. Click **New Form** and set the notification email to that same address.
3. Copy the form ID (looks like `xyzabc123`) from the form's endpoint URL.
4. Add it to `.env`:
   ```
   VITE_CONTACT_EMAIL=muhammadkonecom@gmail.com
   VITE_FORMSPREE_ID=xyzabc123
   ```
5. Redeploy. The Contact page will now show "Delivered via secure form" and POST submissions to Formspree, which forwards them to your inbox.

## Tech

Vite + React + TypeScript. AI Polish runs through a small backend that auto-falls-back across Deepseek and OpenRouter. No accounts, no DB on the client — just a signed session cookie.

## Deploying to Render

The repo ships a `render.yaml` blueprint so the frontend can sit next to the backend on Render.

**One-click:** click the **Deploy to Render** badge at the top of this README. Render reads `render.yaml`, creates a static site, builds with `npm install && npm run build`, publishes `dist/`, and wires the env vars below.

**Manual:**

1. Push this repo to GitHub.
2. In Render, **New → Static Site** → connect the repo.
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add env vars:
   - `VITE_API_URL` — `https://specbuild-backend.onrender.com` (or your backend URL)
   - `VITE_CONTACT_EMAIL` — the address contact-form submissions should go to
   - `VITE_FORMSPREE_ID` — Formspree form ID (see [Contact form](#contact-form) above). Leave empty to fall back to a `mailto:` link.

Render serves `VITE_*` env vars at **build time** and bakes them into the bundle, so any change requires a rebuild / redeploy.

> Don't forget to whitelist the new Render frontend URL in your backend's CORS allow-list (Spring's `CorsConfiguration` / `allowedOrigins`).
