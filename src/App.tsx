import { ArrowRight, Check, Clipboard, Code2, FileText, GitBranch, Lightbulb, ListChecks, Moon, RefreshCcw, Sparkles, Sun, Target, Wand2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import * as api from './lib/api';
import type { Format, SectionKey, Sections } from './lib/api';

const STRIPE = {
  basicPaymentLink: 'https://buy.stripe.com/8x2dR90rw3otcSp4aS6Zy00',
} as const;

type Theme = 'dark' | 'light';
type Plan = 'free' | 'basic';

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  basic: 'Basic',
};

type SpecSection = {
  id: SectionKey;
  title: string;
  required: boolean;
  placeholder: string;
  prompts: string[];
};

const sections: SpecSection[] = [
  {
    id: 'goal',
    title: 'Goal',
    required: true,
    placeholder: 'Build a website that helps users turn rough ideas into AI-ready specs.',
    prompts: ['What are we building?', 'Why?', 'What is the smallest successful outcome?'],
  },
  {
    id: 'scope',
    title: 'Scope',
    required: true,
    placeholder: 'In: change the React form, add a render endpoint call. Out: do not change the auth flow.',
    prompts: ['What is included?', 'What is excluded?', 'What assumptions may be made?'],
  },
  {
    id: 'files',
    title: 'Files',
    required: true,
    placeholder: 'May change: src/App.tsx, src/lib/api.ts. Must not change: vite.config.ts. New: src/components/TitleInput.tsx.',
    prompts: ['What files or directories may change?', 'What must not change?', 'What new files may be created?'],
  },
  {
    id: 'rules',
    title: 'Rules',
    required: true,
    placeholder: 'TypeScript only. Use the existing src/lib/api.ts client. Follow the styling tokens in src/styles.css.',
    prompts: ['Languages to use?', 'Libraries or frameworks to use?', 'Existing patterns to follow?', 'Constraints that must not be violated?'],
  },
  {
    id: 'acceptanceCriteria',
    title: 'Acceptance Criteria',
    required: true,
    placeholder: 'Happy: form submits, preview renders, Copy button copies valid markdown. Error: backend 503 shows inline error.',
    prompts: ['Happy path?', 'Error / failure path?', 'Edge cases?', 'Definition of done?'],
  },
  {
    id: 'verification',
    title: 'Verification',
    required: false,
    placeholder: 'Run npm run build. Manually click Copy on three formats. Confirm preview matches form values.',
    prompts: ['Tests to add or update?', 'Manual checks to perform?', 'Evidence required before completion?'],
  },
  {
    id: 'output',
    title: 'Output',
    required: false,
    placeholder: 'Deliver: working form, populated preview, copied spec. Summarize: any new files added. Flag: any open questions.',
    prompts: ['What deliverables are expected?', 'What summary should be provided?', 'What remaining risks or open questions?'],
  },
];

const formatOptions: Array<{ id: Format; label: string; icon: typeof FileText }> = [
  { id: 'markdown', label: 'Markdown', icon: FileText },
  { id: 'plain', label: 'Plain text', icon: ListChecks },
  { id: 'html', label: 'HTML', icon: Code2 },
];

const initialValues: Sections = {
  goal: '',
  scope: '',
  files: '',
  rules: '',
  acceptanceCriteria: '',
  verification: '',
  output: '',
};

const sectionNameToKey: Array<[RegExp, SectionKey]> = [
  [/goal|outcome/i, 'goal'],
  [/scope/i, 'scope'],
  [/files?|directories?/i, 'files'],
  [/rules?|constraints?/i, 'rules'],
  [/acceptance|done/i, 'acceptanceCriteria'],
  [/verif|test|evidence|manual/i, 'verification'],
  [/output|deliver|summary|risk|open\s*questions?/i, 'output'],
];

function mapSectionNameToKey(name: string): SectionKey | null {
  for (const [pattern, key] of sectionNameToKey) {
    if (pattern.test(name)) return key;
  }
  return null;
}

interface ParsedPolished {
  title: string;
  sections: Partial<Sections>;
}

function parsePolishedContent(content: string): ParsedPolished {
  const lines = content.split(/\r?\n/);
  let title = '';
  const sectionsMap: Partial<Sections> = {};
  let currentKey: SectionKey | null = null;
  let currentBody: string[] = [];

  const flush = () => {
    if (currentKey) {
      sectionsMap[currentKey] = currentBody.join('\n').trim();
    }
  };

  for (const line of lines) {
    const h1 = line.match(/^#\s+(.+?)\s*$/);
    const h2 = line.match(/^#{2,3}\s+(.+?)\s*$/);
    if (h1 && !h2) {
      title = h1[1].trim();
    } else if (h2) {
      flush();
      currentKey = mapSectionNameToKey(h2[1].trim());
      currentBody = [];
    } else if (currentKey) {
      currentBody.push(line);
    }
  }
  flush();

  return { title, sections: sectionsMap };
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getFilledSections(values: Sections) {
  return sections
    .map((section) => ({ section, lines: splitLines(values[section.id] ?? '') }))
    .filter(({ lines }) => lines.length > 0);
}

function formatLabel(format: Format): string {
  if (format === 'markdown') return 'as Markdown';
  if (format === 'html') return 'as HTML';
  return 'as text';
}

function buildSectionsForBackend(values: Sections): Sections {
  return {
    goal: values.goal ?? '',
    scope: values.scope ?? '',
    files: values.files ?? '',
    rules: values.rules ?? '',
    acceptanceCriteria: values.acceptanceCriteria ?? '',
    verification: values.verification ?? '',
    output: values.output ?? '',
  };
}

function formatSpecClientSide(values: Sections, format: Format): string {
  const filledSections = getFilledSections(values);

  if (filledSections.length === 0) {
    return '';
  }

  if (format === 'markdown') {
    return filledSections
      .map(({ section, lines }) => `## ${section.title}\n${lines.map((line) => `- ${line}`).join('\n')}`)
      .join('\n\n');
  }

  if (format === 'html') {
    const body = filledSections
      .map(({ section, lines }) => {
        const items = lines.map((line) => `    <li>${escapeHtml(line)}</li>`).join('\n');
        return `  <section>\n    <h2>${escapeHtml(section.title)}</h2>\n    <ul>\n${items}\n    </ul>\n  </section>`;
      })
      .join('\n');

    return `<article class="spec">\n${body}\n</article>`;
  }

  return filledSections
    .map(({ section, lines }) => `${section.title}\n${lines.map((line) => `- ${line}`).join('\n')}`)
    .join('\n\n');
}

export function App() {
  const [values, setValues] = useState<Sections>(initialValues);
  const [format, setFormat] = useState<Format>('markdown');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('specthinker-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  const [title, setTitle] = useState<string>('Untitled spec');
  const [plan, setPlan] = useState<Plan>(() => {
    const saved = localStorage.getItem('specthinker-plan');
    return saved === 'basic' ? 'basic' : 'free';
  });
  const [polishedSpec, setPolishedSpec] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [quota, setQuota] = useState<api.QuotaState | null>(null);
  const [quotaExhausted, setQuotaExhausted] = useState(false);
  const [lastProvider, setLastProvider] = useState<string | null>(null);
  const [backendReady, setBackendReady] = useState<boolean>(api.isConfigured());
  const [cliSection, setCliSection] = useState<'install' | 'usage' | 'why'>('install');
  const [clientId] = useState<string>(() => api.getOrCreateClientId());

  const isPremium = plan !== 'free';
  const apiConfigured = api.isConfigured();
  const missingRequired = useMemo(
    () =>
      sections
        .filter((section) => section.required && !values[section.id].trim())
        .map((section) => section.id),
    [values],
  );
  const canGenerate = useMemo(
    () =>
      sections.every((section) => !section.required || values[section.id].trim().length > 0) &&
      title.trim().length > 0,
    [values, title],
  );
  const generatedSpec = useMemo(() => formatSpecClientSide(values, format), [values, format]);

  useEffect(() => {
    localStorage.setItem('specthinker-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('specthinker-plan', plan);
  }, [plan]);

  useEffect(() => {
    if (!apiConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        await api.getHealth();
        if (cancelled) return;
        setBackendReady(true);
        try {
          const q = await api.getQuota(clientId);
          if (!cancelled) {
            setQuota(q);
            setQuotaExhausted(q.used >= q.limit);
          }
        } catch {
          // quota fetch is best-effort
        }
      } catch {
        if (!cancelled) setBackendReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiConfigured, clientId]);

  useEffect(() => {
    if (window.location.hash !== '#success') return;
    const params = new URLSearchParams(window.location.search);
    const planFromUrl = params.get('plan');
    setPlan(planFromUrl === 'basic' ? 'basic' : 'free');
    setShowWelcomeBanner(true);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    const timer = window.setTimeout(() => setShowWelcomeBanner(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  function updateValue(id: SectionKey, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setCopied(false);
    setPolishedSpec(null);
    setPolishError(null);
  }

  function updateTitle(value: string) {
    setTitle(value);
    setCopied(false);
    setPolishedSpec(null);
    setPolishError(null);
  }

  async function copySpec() {
    setAttemptedSubmit(true);
    if (!canGenerate) return;
    if (quotaExhausted) {
      setQuotaMessage('Daily polish quota reached. Resets at midnight UTC.');
      return;
    }
    setPolishError(null);
    setQuotaMessage(null);
    try {
      const text = apiConfigured
        ? await api.renderUnsavedSpec({ title: title.trim(), sections: buildSectionsForBackend(values) }, format)
        : formatSpecClientSide(values, format);
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      if (err instanceof api.NotConfiguredError) {
        setPolishError('Backend not configured.');
      } else {
        setPolishError(err instanceof Error ? err.message : 'Copy failed.');
      }
    }
  }

  async function polishWithAi() {
    if (!canGenerate) return;
    if (!apiConfigured || !backendReady) return;
    if (quotaExhausted) {
      setQuotaMessage('Daily polish quota reached. Resets at midnight UTC.');
      return;
    }
    setIsPolishing(true);
    setPolishError(null);
    setQuotaMessage(null);
    try {
      const res = await api.polishSpec({
        title: title.trim(),
        sections: buildSectionsForBackend(values),
        clientId,
      });
      setLastProvider(res.provider);
      const parsed = parsePolishedContent(res.content);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.sections.goal !== undefined) setValues((current) => ({ ...current, ...parsed.sections }));
      setPolishedSpec(res.content);
      setQuota(res.quota);
      setQuotaExhausted(res.quota.used >= res.quota.limit);
    } catch (err) {
      if (err instanceof api.QuotaExceededError) {
        setQuotaMessage(err.message);
        setQuotaExhausted(true);
        if (err.limit > 0) setQuota({ used: err.used, limit: err.limit, resetsAtEpochMillis: err.resetsAtEpochMillis });
      } else if (err instanceof api.LlmUnavailableError) {
        const tried = err.providers.length > 0 ? ` Tried: ${err.providers.map((p) => p.split(':')[0]).join(', ')}.` : '';
        setPolishError(`AI polish is temporarily down.${tried}`);
      } else if (err instanceof api.NotConfiguredError) {
        setPolishError('AI polish is not configured yet.');
      } else {
        setPolishError(err instanceof Error ? err.message : 'AI polish failed. Your spec was not modified.');
      }
    } finally {
      setIsPolishing(false);
    }
  }

  function resetForm() {
    if (
      window.confirm(
        'Reset the form, clear premium state, and start over? This is for testing.',
      )
    ) {
      setValues(initialValues);
      setTitle('Untitled spec');
      setAttemptedSubmit(false);
      setCopied(false);
      setPolishedSpec(null);
      setPolishError(null);
      setQuotaMessage(null);
      setPlan('free');
    }
  }

  const cliMarkdownBySection: Record<typeof cliSection, string> = {
    install: `
## Installation

### From source (recommended)

\`\`\`bash
git clone https://github.com/YOUR_USERNAME/ai-agent-spec-generator.git
cd ai-agent-spec-generator
chmod +x spec_cli.py
\`\`\`

### From Homebrew tap

\`\`\`bash
brew install YOUR_TAP/spec-gen
\`\`\`
`,
    usage: `
## Usage

Generate a Markdown spec (default):

\`\`\`bash
python3 spec_cli.py gen --format markdown
# or simply
python3 spec_cli.py gen
\`\`\`

Generate an HTML spec:

\`\`\`bash
python3 spec_cli.py gen --format html
\`\`\`

Generate a plain text spec:

\`\`\`bash
python3 spec_cli.py gen --format text
\`\`\`
`,
    why: `
## Why use this tool?

* **Standard planning** — a shared template for goals, scope, rules, and acceptance.
* **Multiple formats** — Markdown, HTML, and plain text out of the box.
* **Easy to use** — one command, no setup ceremony.
`,
  };

  const cliMarkdown = cliMarkdownBySection[cliSection];

  return (
    <main className="app-shell" data-theme={theme}>
      {showWelcomeBanner && (
        <div className="premium-banner" role="status">
          <Sparkles size={18} aria-hidden="true" />
          <span>Welcome to {PLAN_LABELS[plan]}!</span>
          <button
            type="button"
            className="premium-banner-close"
            onClick={() => setShowWelcomeBanner(false)}
            aria-label="Dismiss"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <section className="hero-section workspace" aria-labelledby="page-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Spec Builder</p>
            <h1 id="page-title">Create a complete software spec</h1>
          </div>
          <div className="topbar-actions">
            <a
              className="ghost-button"
              href="#pricing"
              onClick={(event) => {
                event.preventDefault();
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Pricing
            </a>
            {isPremium && <span className="premium-badge">{PLAN_LABELS[plan]}</span>}
            <button
              className="ghost-button"
              type="button"
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
            <button className="ghost-button" type="button" onClick={resetForm}>
              <RefreshCcw size={18} aria-hidden="true" />
              Reset
            </button>
          </div>
        </header>

        <div className="builder-grid">
          <form className="spec-form" onSubmit={(event) => event.preventDefault()}>
            <label className="field-group title-field">
              <span className="field-heading">
                <span>Spec title</span>
                <span className="badge required">Required</span>
              </span>
              <span className="field-prompts">A short, descriptive name for this spec.</span>
              <input
                type="text"
                className="title-input"
                value={title}
                onChange={(event) => updateTitle(event.target.value)}
                placeholder="My Spec"
                aria-invalid={attemptedSubmit && !title.trim()}
              />
            </label>

            {sections.map((section) => {
              const hasError = attemptedSubmit && missingRequired.includes(section.id);

              return (
                <label className="field-group" key={section.id}>
                  <span className="field-heading">
                    <span>{section.title}</span>
                    <span className={section.required ? 'badge required' : 'badge optional'}>
                      {section.required ? 'Required' : 'Optional'}
                    </span>
                  </span>
                  <span className="field-prompts">{section.prompts.join(' ')}</span>
                  <textarea
                    value={values[section.id]}
                    onChange={(event) => updateValue(section.id, event.target.value)}
                    placeholder={section.placeholder}
                    aria-invalid={hasError}
                    aria-describedby={hasError ? `${section.id}-error` : undefined}
                  />
                  {hasError && (
                    <span className="error-text" id={`${section.id}-error`}>
                      This section is required before generating the spec.
                    </span>
                  )}
                </label>
              );
            })}
          </form>

          <aside className="output-panel" aria-label="Generated spec">
            <div className="output-header">
              <div>
                <p className="eyebrow">Output</p>
                <h2>Generated spec</h2>
              </div>
              <div className="status-pill">
                <Check size={16} aria-hidden="true" />
                {canGenerate ? 'Ready' : `${missingRequired.length + (title.trim() ? 0 : 1)} missing`}
              </div>
            </div>

            <div className="format-tabs" role="tablist" aria-label="Output format">
              {formatOptions.map((option) => {
                const Icon = option.icon;

                return (
                  <button
                    className={format === option.id ? 'format-tab active' : 'format-tab'}
                    type="button"
                    key={option.id}
                    onClick={() => setFormat(option.id)}
                    aria-pressed={format === option.id}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="preview-wrapper">
              {polishedSpec && <span className="preview-badge">Polished{lastProvider ? ` · ${lastProvider}` : ''}</span>}
              <pre className="preview" aria-live="polite">
                {canGenerate && generatedSpec
                  ? (polishedSpec || generatedSpec)
                  : 'Fill in the title and required sections to generate a spec preview.'}
              </pre>
            </div>

            <div className="action-buttons">
              <button
                className="primary-button"
                type="button"
                onClick={copySpec}
                disabled={!canGenerate}
              >
                <Clipboard size={18} aria-hidden="true" />
                {copied ? 'Copied' : `Copy ${formatLabel(format)}`}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={polishWithAi}
                disabled={!canGenerate || isPolishing || !apiConfigured || !backendReady || quotaExhausted}
              >
                <Wand2 size={18} aria-hidden="true" />
                {isPolishing ? 'Polishing…' : polishedSpec ? 'Re-polish' : 'Polish with AI'}
              </button>
            </div>

            {!apiConfigured && (
              <p className="backend-notice">
                <strong>Backend not configured.</strong> AI Polish is disabled. Set
                <code>VITE_API_URL</code> in your <code>.env</code> to enable it.
              </p>
            )}
            {apiConfigured && !backendReady && (
              <p className="backend-notice">
                <strong>Backend unreachable.</strong> AI Polish won't work until the backend is up.
              </p>
            )}

            {polishError && <p className="error-banner">{polishError}</p>}
            {quotaMessage && <p className="quota-banner">{quotaMessage}</p>}

            {apiConfigured && backendReady && quota && (
              <p className="free-generations-text">
                {quota.used} of {quota.limit} polishes used today
                {lastProvider ? ` · last call: ${lastProvider}` : ''}.
              </p>
            )}
          </aside>
        </div>
      </section>

      {/* AI Polish Section — product explainer */}
      <section className="section-wrapper">
        <div className="local-model-section">
          <div className="explain-grid">
            <div className="explain-text">
              <span className="section-eyebrow">specs instead of prompts for your agent</span>
              <h2 className="section-title">Stop re-prompting. Hand your agent a spec.</h2>
              <p>
                Every back-and-forth with your AI agent burns tokens. Every "what do you mean by
                that?" costs you a turn. Specs are the fix, a single, structured document that
                says exactly what you want, in a format any agent can follow on the first try.
              </p>
              <p>
                Use Spec Builder on the left to draft one. Copy the output, paste it into your
                agent's prompt, and let it cook.
              </p>
              <a
                className="ghost-button explain-cta"
                href="#pricing"
                onClick={(event) => {
                  event.preventDefault();
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                See pricing
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>

            <div className="explain-visual" aria-hidden="true">
              <div className="spec-doc">
                <div className="spec-doc-title">spec.md</div>
                <div className="spec-line line-1"># Goal</div>
                <div className="spec-line line-2">Build a todo app.</div>
                <div className="spec-line line-3"># Scope</div>
                <div className="spec-line line-4">Single user, web only.</div>
                <div className="spec-line line-5"># Rules</div>
                <div className="spec-line line-6">TypeScript + React.</div>
              </div>
              <div className="thinking-row">
                <div className="lightbulb-wrap">
                  <Lightbulb size={28} className="lightbulb" />
                </div>
                <div className="arrow-line" />
                <div className="llm-pill">LLM</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Marketing Section */}
      <section className="section-wrapper">
        <div className="marketing-section">
          <div className="marketing-content">
            <div className="marketing-headline">
              <span className="section-eyebrow">Built for harness engineers</span>
              <h2 className="section-title">What language does your agent speak? Is it a spec?</h2>
              <p>
                Do you double, triple, quadruple prompt just to get your agent what you want? Send
                it a spec instead.
              </p>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <span className="feature-icon"><Target size={22} aria-hidden="true" /></span>
                <h3>Define your vision</h3>
                <p>Clearly articulate goals and outcomes without ambiguity. Guide your AI with precision and intent.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon"><GitBranch size={22} aria-hidden="true" /></span>
                <h3>Structure for success</h3>
                <p>Break complex tasks into manageable sections. Cover every critical detail before you ship.</p>
              </article>
              <article className="feature-card">
                <span className="feature-icon"><Sparkles size={22} aria-hidden="true" /></span>
                <h3>AI-ready output</h3>
                <p>Generate specs in formats optimized for direct input into large language models and agents.</p>
              </article>
            </div>

            <div className="workflow-grid">
              <div className="workflow-step">
                <span className="workflow-step-num">1</span>
                <h4>Answer guided prompts</h4>
                <p>Walk through structured sections that capture every angle of your project.</p>
              </div>
              <div className="workflow-step">
                <span className="workflow-step-num">2</span>
                <h4>Export and ship</h4>
                <p>Copy Markdown, HTML, or plain text straight into your repo or agent config.</p>
              </div>
            </div>

            <div className="community-cta">
              <h2 className="section-title">Prefer the terminal?</h2>
              <p>
                Spec Builder is also a command-line tool. Pipe it into scripts, run it in CI, or use
                it anywhere you'd reach for a shell.
              </p>
              <a
                className="call-to-action-button"
                href="https://github.com/specthinker/specthinker-cli"
                target="_blank"
                rel="noopener noreferrer"
              >
                Use our CLI tool
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CLI Section */}
      <section className="section-wrapper">
        <div className="cli-section">
          <div className="section-header">
            <span className="section-eyebrow">CLI Version</span>
            <h2 className="section-title">Ship specs from the terminal.</h2>
            <p className="section-subtitle">
              The same spec engine, packaged for your shell. Perfect for CI pipelines, scripts,
              and developers who live in the command line.
            </p>
          </div>
          <div className="cli-layout">
            <div className="cli-intro">
              <div className="cli-tabs" role="tablist" aria-label="CLI documentation sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={cliSection === 'install'}
                  className={cliSection === 'install' ? 'cli-tab active' : 'cli-tab'}
                  onClick={() => setCliSection('install')}
                >
                  Installation
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={cliSection === 'usage'}
                  className={cliSection === 'usage' ? 'cli-tab active' : 'cli-tab'}
                  onClick={() => setCliSection('usage')}
                >
                  Usage
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={cliSection === 'why'}
                  className={cliSection === 'why' ? 'cli-tab active' : 'cli-tab'}
                  onClick={() => setCliSection('why')}
                >
                  Why use it
                </button>
              </div>
            </div>
            <div className="cli-content" role="tabpanel">
              <Markdown>{cliMarkdown}</Markdown>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="section-wrapper" id="pricing">
        <div className="pricing-section">
          <div className="section-header">
            <span className="section-eyebrow">Pricing</span>
            <h2 className="section-title">One simple plan. Cancel anytime.</h2>
            <p className="section-subtitle">
              Try Spec Builder free. Upgrade to Basic for AI Polish and unlimited exports.
            </p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card featured">
              <header className="pricing-card-header">
                <h3>Basic</h3>
                <p className="pricing-card-tagline">For solo builders shipping with AI agents.</p>
              </header>
              <div className="pricing-card-price">
                <span className="pricing-amount">$5</span>
                <span className="pricing-period">/month</span>
              </div>
              <ul className="pricing-card-features">
                <li><Check size={16} aria-hidden="true" /><span>Unlimited spec generations</span></li>
                <li><Check size={16} aria-hidden="true" /><span>AI Polish with Deepseek / OpenRouter fallback</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Markdown, HTML, and plain text export</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Cancel anytime</span></li>
              </ul>
              <a
                className="pricing-card-button primary"
                href={STRIPE.basicPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Subscribe to Basic plan for $5 per month"
              >
                Choose Basic
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>
          </div>

          <p className="pricing-footnote">
            Billed monthly. Cancel anytime. Need a team plan? <a href="mailto:hello@specbuild.dev">Contact us</a>.
          </p>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-content">
          <p>Tired of double, triple, quadruple prompting for your AI to make something? Spec Builder gives you a clearly defined spec for your AI agents.</p>
          <div className="site-footer-links">
            <a href="#top">Back to top</a>
            <a href="#features">Features</a>
            <a href="#cli">CLI</a>
            <a href="#pricing">Pricing</a>
          </div>
          <p>&copy; {new Date().getFullYear()} Spec Builder. Crafted for builders.</p>
        </div>
      </footer>
    </main>
  );
}