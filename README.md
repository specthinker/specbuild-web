# Spec Builder

A focused web app for turning a rough idea into a clean, AI-ready software spec — in under a minute.

**[Open the app](https://specthinker.github.io/specbuild-web/)**

## What it does

Spec Builder gives you a structured form covering the seven sections every good spec needs: Goal, Scope, Files, Rules, Acceptance Criteria, Verification, and Output. Fill them in, and you get a polished Markdown, plain-text, or HTML spec you can hand to any AI coding agent.

## Who it's for

1. **Harness engineers** who don't want to keep going back and forth with prompts — draft the spec once, hand it to your agent, get to building.
2. **Vibe coders** who want to save tokens — the LLM doesn't get it the first time, so stop paying for retries. Give it a spec.
3. **People at AI-native companies** whose boss wants them using AI — use Spec Builder to save time writing prompts and ship faster.

## Pricing

Two free specs to try it. From there:

- **Basic — $5/mo** — 30 specs a month.

See the live [pricing page](https://specthinker.github.io/specbuild-web/#pricing) for the latest.

## Tech

Vite + React + TypeScript. AI Polish runs through a small backend that auto-falls-back across Deepseek and OpenRouter. No accounts, no DB on the client — just a signed session cookie.
