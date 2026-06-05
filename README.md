# Spec Builder

A focused web app for turning a rough idea into a clean, AI-ready software spec — in under a minute.

**[Open the app](https://specthinker.github.io/specbuild-web/)**

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
- **Pro — $15/mo** — 100 specs a month.
- **Lifetime — $100 once** — unlimited specs, forever.

See the live [pricing page](https://specthinker.github.io/specbuild-web/#pricing) for the latest.

## Tech

Vite + React + TypeScript. AI Polish runs through a small backend that auto-falls-back across Deepseek and OpenRouter. No accounts, no DB on the client — just a signed session cookie.
