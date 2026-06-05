# Spec — Payment Links, Post-Purchase UX, Theme Refresh & Real LLM Polish

## Goal
Wire the 3 Stripe Payment Links into the pricing section. Update the UI after a successful purchase so paying users see a clear "premium unlocked" state. Restyle the whole site around a new palette: navy primary `44589F`, peach soft accent `FBD1C8`, deep teal structural accent `3F635C`. Add subtle background noise. Add a real LLM-based spec reformatter (no fake "local AI" claims) with auto-fallback between the cheapest available models so users get the impression of unlimited capacity.

## Critical honesty note (kept in spec for the record)
The previous build claimed a "local AI model" but it was a `setTimeout` + string-replace mock. This release removes that claim entirely. The new "AI Polish" feature calls real LLMs. To keep the LLM call from a static frontend, the API key is shipped in the bundle, which means anyone can extract it and run up your bill. This is acceptable for a low-traffic / personal project. For real production traffic, move the key to a serverless proxy (Vercel/Cloudflare Worker). A future spec will cover that move.

## Non-goals
- No accounts, no DB. All tier enforcement is client-side via localStorage.
- No Stripe webhook. Post-purchase detection is client-side via URL hash.
- No "local model" framing anywhere in copy, UI, or code.
- No new sections, copy, or marketing pages beyond what the new tier limits require.

## Tier structure (correct, as specified)

| Plan | Price | Specs / month | AI Polish | Polish cap |
|------|-------|---------------|-----------|------------|
| Free | $0 | 2 lifetime (then paywall) | Yes | 2 lifetime |
| Basic | $5/mo | 30 | Yes | 30 / month |
| Pro | $15/mo | 100 | Yes | 100 / month |
| Lifetime | $100 one-time | Unlimited | Yes | Unlimited |

"Specs" = one full generate-and-copy action (filling required fields and pressing the primary button).
"AI Polish" = one LLM reformat call on the user's filled-in spec.

The count is per spec generation, not per field. One generation = one spec, regardless of which sections were filled.

### Edge cases for counting
- **Pressing the button with required fields empty** — no count is consumed. Validation fails first.
- **Pressing the button multiple times with the same valid spec** — each successful press counts as one. There is no debounce; if the user spams the button, they burn their quota. This is by design for now and noted in the UI.
- **Reaching the free limit (2)** — user is redirected to `#pricing`. Copy button is disabled. The "X free generations left" text is replaced with "Limit reached — upgrade to keep generating."
- **Reaching the Basic / Pro monthly limit** — same behavior as the free limit, with a message that says "You've used all 30 specs this month. Resets on {date}." The reset date is calculated once when the user first hits the cap and is shown in the message.
- **Month rollover for Basic / Pro** — the period start is stored in `localStorage` as `specthinker-period-start` (ISO date). On every count update, we check if `now - periodStart >= 30 days`. If yes, reset count to 0 and update periodStart to now.
- **30-day vs calendar month** — the spec uses 30-day rolling windows, not calendar months, because that's simpler and matches how Stripe billing periods usually feel. Open question flagged below.
- **Lifetime user** — no count, no period. The "limit reached" branch never fires.
- **Reset button in topbar** — clears all spec-related localStorage (`spec-gen-count`, `is-premium-user`, `specthinker-plan`, `specthinker-period-start`). This is for testing. There will be a confirm prompt before clearing.
- **User clears their own localStorage** — they go back to free. This is a known limitation of client-side enforcement. Acceptable for now.
- **User edits the count in DevTools** — same as above, not preventable client-side. Fine for v1.

## LLM Polish feature (replaces the fake "local AI")

### Behavior
- After the user generates a spec and clicks "Polish with AI" (new button on the output panel, separate from the existing "Copy" button), the app calls an LLM to reformat the spec.
- The LLM receives a system prompt: "You are a spec editor. Reformat the user's spec for clarity and structure. Preserve all content. Do not add features. Output valid Markdown." Plus the spec content.
- Result replaces the spec in the preview, with a small "Polished" badge in the top-right of the preview.

### Models and fallback
**Available cheap models (real options, with current public pricing for context, do your own research before going live):**
- **Deepseek Chat** — `deepseek-chat` model. ~$0.14/M input, $0.28/M output. Supports CORS for browser calls. Cheapest reliable option as of late 2025.
- **OpenRouter free models** — Several providers route free models through OpenRouter. The actual model used depends on the free-tier availability. Examples: `meta-llama/llama-3.1-8b-instruct:free`, `google/gemini-2.0-flash-exp:free`. CORS-friendly. Free but rate-limited.
- **OpenRouter paid (cheap)** — `deepseek/deepseek-chat` via OpenRouter, same pricing as direct Deepseek but with CORS guaranteed. This is the safest fallback.
- **MiniMax M3** — listed in the prompt as a model. There is no widely-available public API endpoint for "MiniMax M3" as of my knowledge cutoff. I will treat this as a placeholder model name and route to whatever the cheapest available model is via OpenRouter at the time. If you have a specific endpoint in mind, name it explicitly and I'll wire it.

**Fallback order (silently tried in sequence):**
1. Deepseek Chat direct (`https://api.deepseek.com/chat/completions`)
2. OpenRouter `deepseek/deepseek-chat`
3. OpenRouter free tier (rotates among whatever's free)
4. Surface a friendly error to the user only if all three fail

**Error detection for fallback:**
- HTTP 429 (rate limit) → fallback
- HTTP 402 / 403 with `insufficient_quota` in body → fallback
- HTTP 5xx → fallback
- Network error / CORS error → fallback
- HTTP 400 with `context_length_exceeded` → do not fallback, show the user "Your spec is too long for the AI to polish in one pass. Try removing optional sections."
- HTTP 401 → do not fallback, show "AI service is misconfigured." (This is a config error, not a rate limit.)

**Implementation:** A `callLlmWithFallback(prompt, systemPrompt)` helper that tries each provider in order, catches the right errors, and returns the first successful response. The frontend never knows which provider actually answered.

### What the user sees
- Button: "Polish with AI" (with a sparkles icon)
- Click it: button shows a spinner with "Polishing..." text
- On success: preview updates, button changes to "Polished" with a checkmark for 2 seconds, then back to "Polish with AI"
- On final failure: button shows "Polish unavailable" with a tooltip explaining the AI services are busy, and the original spec is preserved
- Polish calls count against the same monthly limit as spec generations (since both consume LLM tokens)

## Pricing buttons (replace placeholders)
- Basic $5/mo button → `https://buy.stripe.com/8x2dR90rw3otcSp4aS6Zy00`
- Pro $15/mo button → `https://buy.stripe.com/dRm9AT3DI9MR9GddLs6Zy02`
- Lifetime $100 button → `https://buy.stripe.com/5kQfZh5LQ3ot5pX22K6Zy01`
- Each link opens in a new tab with `rel="noopener noreferrer"`
- Stripe redirect URLs are configured to send the user back to `https://specthinker.github.io/specbuild-web/#success` after payment

## Post-purchase detection
When the user lands on the site with `#success` in the URL:
- Set `isPremiumUser` to `true` in localStorage (key: `is-premium-user`, value: `"true"`)
- Set the plan from `?plan=basic|pro|lifetime` query param. If missing, default to "pro" since the modal is generic. (User can correct it via a dropdown in their account settings... no account yet, so just persist whatever Stripe sent.)
- Set `specthinker-period-start` to today's ISO date
- Reset `spec-gen-count` to 0
- Smoothly scroll to the top of the page so they land on the spec builder
- Show a one-time toast: "Welcome to {Plan}! {quota} specs / month unlocked." Auto-dismisses after 6 seconds with a manual close button
- The topbar gains a "Pro" / "Lifetime" badge next to the theme toggle
- The "X free generations left" text disappears permanently for premium users
- The "Copy" button label changes to "Copy polished spec" for premium users
- A new "Polish with AI" button appears on the output panel

## Theme refresh

### Color tokens
**Dark mode:**
- `--page-bg`: `#0E1422` (deep navy, near-black)
- `--noise-dot`: `rgba(251, 209, 200, 0.06)` (peach-tinted dots at low alpha)
- `--text`: `#F5F2EC` (warm off-white)
- `--muted`: `#8C97B0` (desaturated navy)
- `--panel`: `rgba(28, 38, 60, 0.85)` (translucent navy)
- `--panel-strong`: `#1A2238` (solid navy)
- `--border`: `#2B3650` (navy with mid alpha)
- `--field`: `#0A0F1A` (very deep navy)
- `--field-border`: `#3A4666` (lighter navy for inputs)
- `--accent`: `#44589F` (the navy you specified — primary)
- `--accent-strong`: `#5A6FB8` (lighter navy for hover)
- `--accent-text`: `#FBD1C8` (the peach — text on accent)
- `--green`: `#3F635C` (the deep teal — structural/success)
- `--green-panel`: `rgba(63, 99, 92, 0.18)` (teal at low alpha for backgrounds)
- `--required-bg`: `#5A2A1F` (muted brick — required indicators, doesn't fight the new palette)
- `--required-text`: `#FBD1C8` (peach — same as accent text, consistent)
- `--optional-bg`: `rgba(63, 99, 92, 0.22)` (teal-tinted)
- `--optional-text`: `#A8C9C0` (light teal)
- `--preview-bg`: `#0A0F1A` (matches field)
- `--preview-text`: `#FBD1C8` (peach text on deep navy code blocks)
- `--shadow-color`: `rgba(14, 20, 34, 0.6)` (navy shadow)

**Light mode:**
- `--page-bg`: `#F4F1EC` (warm off-white)
- `--text`: `#1A2238` (deep navy)
- `--muted`: `#5A6580`
- `--panel`: `rgba(255, 252, 248, 0.94)`
- `--panel-strong`: `#FFFFFF`
- `--border`: `#D8D2C3`
- `--field`: `#FFFFFF`
- `--field-border`: `#C9C2B2`
- `--accent`: `#44589F` (same navy)
- `--accent-strong`: `#364580` (darker navy for hover on light)
- `--accent-text`: `#FBD1C8` (same peach)
- `--green`: `#3F635C` (same teal)
- `--green-panel`: `#E8F0EE`
- `--required-bg`: `#F7D8CC`
- `--required-text`: `#5A2A1F`
- `--optional-bg`: `#D8E5E0`
- `--optional-text`: `#2A4A42`
- `--preview-bg`: `#1A2238` (dark navy code block on light page)
- `--preview-text`: `#FBD1C8`
- `--shadow-color`: `rgba(68, 88, 159, 0.15)` (navy-tinted shadow)

### Background noise
- Inline SVG turbulence filter as a `data:` URI in a fixed pseudo-element on `.app-shell::after`
- Opacity: `0.04` dark mode, `0.03` light mode
- `pointer-events: none`, `z-index: 0`, above page background, below content
- The existing radial dot pattern (`.app-shell::before`) is kept but its opacity is reduced from `0.55` to `0.3` so the two patterns don't fight

## Component changes

### `App.tsx`
- Update `STRIPE.*PaymentLink` constants with real URLs
- Add a `useEffect` that watches `window.location.hash`. On `#success`, read query params, set `isPremiumUser`, set plan, set period start, reset count, scroll to top, show banner
- Add a `plan` state and a `periodStart` state, both persisted to localStorage
- Add a `polishSpecWithAi()` async function that:
  - Checks the quota (same limit as spec generation)
  - Calls `callLlmWithFallback()` from a new `lib/llm.ts` module
  - Stores the result in `polishedSpec` state
  - Increments the spec count (polishes count as a spec)
  - Handles errors with the silent fallback + user-friendly final error
- Add a new "Polish with AI" button next to the existing "Copy" button on the output panel
- Add a `PremiumBanner` component at the top of `<main>` (inline, not a modal)
- Add a `premium-badge` span in the topbar
- Update the "X free generations left" paragraph to be conditional and to show period-reset info when the limit is hit
- Update the "Copy" button label conditional
- Remove the existing `polishSpecLocally()` mock and any "local AI" / "Polished by Local AI" copy from the UI
- Update the local model section in the page to NOT mention a local AI model. Rename to "AI Polish" and update copy to reflect the real LLM behavior (calls happen on a server, latency, possible failures, privacy note)

### `lib/llm.ts` (new file)
- Exports `callLlmWithFallback(messages, options): Promise<{ text, providerUsed }>`
- Tries Deepseek direct → OpenRouter Deepseek → OpenRouter free tier
- Returns the first successful response, or throws a structured `LlmError` if all fail
- API keys are read from `import.meta.env.VITE_DEEPSEEK_API_KEY` and `import.meta.env.VITE_OPENROUTER_API_KEY` (Vite env vars, prefixed `VITE_` to be exposed to the client)
- **Documented warning at the top of the file:** these keys are exposed to all users. Anyone can extract them and run up the bill.

### `styles.css`
- Swap all color tokens per the table above
- Add `.bg-noise` styles
- Add `.premium-badge`, `.premium-banner` styles
- Reduce existing dot pattern opacity
- Verify shadows, hovers, focus rings all look right with new colors

## Acceptance criteria
- Clicking any of the 3 pricing buttons opens the correct Stripe URL in a new tab
- Returning to the site with `#success` in the URL shows the welcome banner, removes the free counter, persists premium state
- Reloading the page preserves premium state
- "Reset" button in topbar clears all spec-related localStorage after a confirm prompt
- The site background is navy, accent buttons are navy with peach text, check icons are teal — in both light and dark mode
- The noise overlay is visible but very subtle
- "Polish with AI" button appears for premium users, calls a real LLM, returns reformatted text
- When Deepseek is rate-limited, the app silently falls back to OpenRouter without the user noticing
- When all providers fail, the user sees a friendly "Polish unavailable" message and the original spec is preserved
- The "X free generations left" copy is gone. The free tier shows "2 free specs remaining" (or similar) until 0, then "Limit reached"
- No mention of "local AI" or "local model" anywhere in user-facing copy. The marketing section that previously mentioned "local AI" is updated
- Basic / Pro / Lifetime correctly enforce 30 / 100 / unlimited specs per 30-day period
- Build passes. No console errors.

## Open questions (need your answers before I implement)
1. **30-day rolling vs calendar month** — defaulting to 30-day rolling. OK?
2. **Polish calls counting against the same quota as spec generation** — defaulting to yes (both consume tokens). OK?
3. **What to call the third model fallback** — I'll label it "OpenRouter free tier" in the code, but the user never sees this. Confirm this is fine.
4. **The fake "local model" section** — currently a full marketing section talks about local polishing. I'll rewrite this section to be the "AI Polish" section (a real feature, no fake claims) or delete it entirely. I'd recommend keeping it as a real "AI Polish" section since it adds value. OK?
5. **Where to put the API keys** — `.env` file in the repo is committed by default in most setups. I'll add `.env` to `.gitignore` and put placeholder values in `.env.example`. The user adds their real keys locally. OK?
