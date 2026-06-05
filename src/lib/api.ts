/**
 * Thin client for the SpecBuild backend.
 *
 * The backend is a Kotlin/Spring Boot service that:
 *   - Holds the LLM API keys server-side (never exposed to browsers)
 *   - Enforces per-user quotas atomically
 *   - Calls Deepseek / OpenRouter with a silent fallback chain
 *
 * Set VITE_API_URL in your .env to point at the deployed backend
 * (e.g. https://specbuild-backend.onrender.com).
 *
 * If VITE_API_URL is missing, all calls throw NotConfiguredError so the
 * frontend can show a friendly empty state.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');

export class NotConfiguredError extends Error {
  constructor() {
    super('Backend API not configured. Set VITE_API_URL in your .env file.');
    this.name = 'NotConfiguredError';
  }
}

export class QuotaExceededError extends Error {
  readonly resetAt: string | null;
  readonly message: string;
  constructor(message: string, resetAt: string | null) {
    super(message);
    this.name = 'QuotaExceededError';
    this.message = message;
    this.resetAt = resetAt;
  }
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired.');
    this.name = 'SessionExpiredError';
  }
}

export type Plan = 'free' | 'basic' | 'pro' | 'lifetime';

export interface SessionInfo {
  userId: string;
  plan: Plan;
  limits: { specsPerMonth: number; polishPerMonth: number };
  used: { specs: number; polish: number };
  periodStart: string;
}

export interface PolishResponse {
  polished: string;
  providerUsed: string;
}

function ensureConfigured() {
  if (!API_URL) {
    throw new NotConfiguredError();
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  ensureConfigured();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new SessionExpiredError();
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 429) {
    throw new QuotaExceededError(
      typeof data.message === 'string' ? data.message : 'Quota exceeded.',
      typeof data.resetAt === 'string' ? data.resetAt : null,
    );
  }

  if (res.status === 503) {
    throw new LlmUnavailableError(
      typeof data.message === 'string' ? data.message : 'AI service unavailable.',
    );
  }

  if (!res.ok) {
    throw new Error(
      typeof data.message === 'string' ? data.message : `Request failed (${res.status}).`,
    );
  }

  return data as T;
}

export async function bootstrapSession(): Promise<SessionInfo> {
  return request<SessionInfo>('/session', { method: 'POST' });
}

export async function fetchSession(): Promise<SessionInfo> {
  return request<SessionInfo>('/session', { method: 'GET' });
}

export async function polishSpec(spec: string): Promise<PolishResponse> {
  return request<PolishResponse>('/polish', {
    method: 'POST',
    body: JSON.stringify({ spec }),
  });
}

export function isConfigured(): boolean {
  return Boolean(API_URL);
}
