/**
 * Thin client for the SpecBuild backend (Kotlin/Spring Boot).
 *
 * Source of truth: SPEC-auth.md + FRONTEND_INTEGRATION.md in the repo root.
 *
 * Base URL is read from VITE_API_URL. All endpoints live under /api/v1.
 * Auth: signed HttpOnly session cookie. Anonymous browsing also works
 * via a clientId in localStorage for quota tracking. Requests always send
 * cookies via `credentials: 'include'`.
 *
 * If VITE_API_URL is missing, all calls throw NotConfiguredError so the
 * frontend can show a friendly empty state.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '');
const API_BASE = API_URL ? `${API_URL}/api/v1` : '';

const CLIENT_ID_KEY = 'specbuild-client-id';

export class NotConfiguredError extends Error {
  constructor() {
    super('This feature is temporarily unavailable. Please try again in a moment.');
    this.name = 'NotConfiguredError';
  }
}

export class QuotaExceededError extends Error {
  readonly used: number;
  readonly limit: number;
  readonly resetsAtEpochMillis: number;
  readonly retryAfterSeconds: number;
  constructor(message: string, used: number, limit: number, resetsAtEpochMillis: number, retryAfterSeconds: number) {
    super(message);
    this.name = 'QuotaExceededError';
    this.used = used;
    this.limit = limit;
    this.resetsAtEpochMillis = resetsAtEpochMillis;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class LlmUnavailableError extends Error {
  readonly providers: string[];
  constructor(message: string, providers: string[]) {
    super(message);
    this.name = 'LlmUnavailableError';
    this.providers = providers;
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class VersionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionMismatchError';
  }
}

export class BackendError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'BackendError';
    this.status = status;
    this.code = code;
  }
}

export type SectionKey =
  | 'goal'
  | 'scope'
  | 'rules'
  | 'acceptanceCriteria'
  | 'verification'
  | 'output';

export type Sections = Record<SectionKey, string>;

export type Format = 'markdown' | 'plain' | 'html';

export interface Spec {
  id: string;
  title: string;
  sections: Sections;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface SpecSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateSpecRequest {
  title: string;
  sections: Sections;
}

export interface UpdateSpecRequest {
  title: string;
  sections: Sections;
  version: number;
}

export interface PolishRequest {
  title: string;
  sections: Sections;
  clientId: string;
}

export interface PolishResponse {
  content: string;
  provider: string;
  quota: {
    used: number;
    limit: number;
    resetsAtEpochMillis: number;
  };
}

export interface QuotaState {
  used: number;
  limit: number;
  resetsAtEpochMillis: number;
}

interface ErrorBody {
  error?: string;
  message?: string;
  details?: Record<string, unknown> | null;
}

function ensureConfigured() {
  if (!API_URL) {
    throw new NotConfiguredError();
  }
}

export function isConfigured(): boolean {
  return Boolean(API_URL);
}

export function getOrCreateClientId(): string {
  if (typeof window === 'undefined') return 'anonymous';
  let id = window.localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `cid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

async function readErrorBody(res: Response): Promise<ErrorBody> {
  try {
    return (await res.json()) as ErrorBody;
  } catch {
    return {};
  }
}

function throwForResponse(res: Response, body: ErrorBody): never {
  const code = body.error ?? `http_${res.status}`;
  const message = body.message ?? `Request failed (${res.status}).`;

  if (res.status === 429 && code === 'quota_exceeded') {
    const used = Number((body.details as { used?: number } | null)?.used ?? 0);
    const limit = Number((body.details as { limit?: number } | null)?.limit ?? 0);
    const resetsAtEpochMillis = Number(res.headers.get('Resets-At') ?? 0);
    const retryAfterSeconds = Number(res.headers.get('Retry-After') ?? 0);
    throw new QuotaExceededError(message, used, limit, resetsAtEpochMillis, retryAfterSeconds);
  }

  if (res.status === 503 && code === 'polish_unavailable') {
    const providers = ((body.details as { providers?: string[] } | null)?.providers ?? []) as string[];
    throw new LlmUnavailableError(message, providers);
  }

  if (res.status === 404) {
    throw new NotFoundError(message);
  }

  if (res.status === 409) {
    throw new VersionMismatchError(message);
  }

  throw new BackendError(message, res.status, code);
}

async function jsonRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  ensureConfigured();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    throwForResponse(res, body);
  }
  return (await res.json()) as T;
}

async function textRequest(path: string, init: RequestInit = {}): Promise<string> {
  ensureConfigured();
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await readErrorBody(res);
    throwForResponse(res, body);
  }
  return res.text();
}

function formatPath(format: Format): string {
  if (format === 'plain') return 'text';
  return format;
}

/* ----- Health ----- */
export async function getHealth(): Promise<{ status: 'UP' | 'DOWN' }> {
  ensureConfigured();
  const res = await fetch(`${API_URL}/actuator/health`, { credentials: 'include' });
  if (!res.ok) throw new BackendError(`Backend unhealthy (${res.status}).`, res.status, 'unhealthy');
  return (await res.json()) as { status: 'UP' | 'DOWN' };
}

/* ----- Specs CRUD ----- */
export function listSpecs(): Promise<SpecSummary[]> {
  return jsonRequest<SpecSummary[]>('/specs');
}

export function createSpec(req: CreateSpecRequest): Promise<Spec> {
  return jsonRequest<Spec>('/specs', { method: 'POST', body: JSON.stringify(req) });
}

export function getSpec(id: string): Promise<Spec> {
  return jsonRequest<Spec>(`/specs/${encodeURIComponent(id)}`);
}

export function updateSpec(id: string, req: UpdateSpecRequest): Promise<Spec> {
  return jsonRequest<Spec>(`/specs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(req),
  });
}

export function deleteSpec(id: string): Promise<void> {
  ensureConfigured();
  return fetch(`${API_BASE}/specs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  }).then((res) => {
    if (!res.ok) {
      return readErrorBody(res).then((body) => throwForResponse(res, body));
    }
  });
}

/* ----- Render ----- */
export function renderUnsavedSpec(req: CreateSpecRequest, format: Format): Promise<string> {
  return textRequest(`/specs/render?format=${formatPath(format)}`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function renderSavedSpec(id: string, format: Format): Promise<string> {
  return textRequest(`/specs/${encodeURIComponent(id)}/render?format=${formatPath(format)}`);
}

/* ----- LLM polish + quota ----- */
export function polishSpec(req: PolishRequest): Promise<PolishResponse> {
  return jsonRequest<PolishResponse>('/llm/polish', { method: 'POST', body: JSON.stringify(req) });
}

export function getQuota(clientId: string): Promise<QuotaState> {
  return jsonRequest<QuotaState>('/llm/quota', { method: 'POST', body: JSON.stringify({ clientId }) });
}

/* ----- Auth ----- */

export type Plan = 'free' | 'basic' | 'pro' | 'lifetime';

export interface AuthUser {
  userId: string;
  email: string | null;
  plan: Plan;
  isAnonymous: boolean;
  quota: QuotaState | null;
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super('Not signed in.');
    this.name = 'NotAuthenticatedError';
  }
}

/**
 * Returns the current signed-in user, or null if no session exists.
 *
 * Backend contract:
 *   GET /api/v1/auth/me
 *   200 -> AuthUser
 *   401 -> null (no session)
 */
export async function getMe(): Promise<AuthUser | null> {
  ensureConfigured();
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
  if (res.status === 401) return null;
  if (!res.ok) {
    const body = await readErrorBody(res);
    throwForResponse(res, body);
  }
  return (await res.json()) as AuthUser;
}

/**
 * Request a magic sign-in link by email.
 * Backend emails a one-click link; clicking it lands the user back on the
 * frontend at `?signed_in=1` with a session cookie set.
 *
 * Pass the anonymous `clientId` so the backend can merge the anon quota
 * counter into the new user on verify.
 *
 * Backend contract:
 *   POST /api/v1/auth/email/request  { email, redirect, clientId? }
 *   202 -> empty body (link sent, or silently no-op if email is invalid)
 */
export function requestEmailLink(email: string, clientId?: string): Promise<void> {
  ensureConfigured();
  const body: { email: string; redirect: string; clientId?: string } = {
    email,
    redirect: window.location.origin + window.location.pathname,
  };
  if (clientId) body.clientId = clientId;
  return fetch(`${API_BASE}/auth/email/request`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (res.ok || res.status === 202) return;
    const errBody = await readErrorBody(res);
    throwForResponse(res, errBody);
  });
}

/**
 * Returns the URL to navigate to in order to start Google OAuth.
 * The backend handles the OAuth dance and redirects back to the frontend
 * at `?signed_in=1` once a session cookie is set.
 */
export function googleSignInUrl(): string {
  ensureConfigured();
  const redirect = encodeURIComponent(window.location.origin + window.location.pathname);
  return `${API_BASE}/auth/google/start?redirect=${redirect}`;
}

/**
 * Ends the current session. Backend clears the cookie.
 *
 * Backend contract:
 *   POST /api/v1/auth/logout
 *   204
 */
export async function logout(): Promise<void> {
  ensureConfigured();
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok && res.status !== 401) {
    const body = await readErrorBody(res);
    throwForResponse(res, body);
  }
}
