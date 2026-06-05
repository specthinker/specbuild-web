import { ArrowRight, Check, Clipboard, Code2, FileText, GitBranch, Lightbulb, ListChecks, Moon, RefreshCcw, Sparkles, Sun, Target, Wand2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import * as api from './lib/api';

const STRIPE = {
  basicPaymentLink: 'https://buy.stripe.com/8x2dR90rw3otcSp4aS6Zy00',
  proPaymentLink: 'https://buy.stripe.com/dRm9AT3DI9MR9GddLs6Zy02',
  lifetimePaymentLink: 'https://buy.stripe.com/5kQfZh5LQ3ot5pX22K6Zy01',
} as const;

type Format = 'markdown' | 'plain' | 'html';
type Theme = 'dark' | 'light';
type Plan = 'free' | 'basic' | 'pro' | 'lifetime';

const PLAN_LIMITS: Record<Plan, { specs: number; polish: number }> = {
  free: { specs: 2, polish: 2 },
  basic: { specs: 30, polish: 30 },
  pro: { specs: 100, polish: 100 },
  lifetime: { specs: Number.POSITIVE_INFINITY, polish: Number.POSITIVE_INFINITY },
};

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

const POLISH_SYSTEM_PROMPT = [
  'You are a spec editor. Reformat the user spec for clarity, structure, and consistency.',
  'Preserve all original content and intent. Do not add features, change scope, or invent requirements.',
  'Use bullet points for lists. Use clear section headers. Keep the original language.',
  'If a section is empty or unclear, leave it as-is. Output valid Markdown only.',
].join(' ');

type SpecSection = {
  id: string;
  title: string;
  required: boolean;
  placeholder: string;
  prompts: string[];
};

type SpecValues = Record<string, string>;

const sections: SpecSection[] = [
  {
    id: 'goal',
    title: 'Goal / outcome',
    required: true,
    placeholder: 'Build a complete website that helps users create structured specs.',
    prompts: ['What should be accomplished?', 'What should the user-visible result be?'],
  },
  {
    id: 'context',
    title: 'Background / context',
    required: false,
    placeholder: 'Users need a guided way to write clear specs without starting from a blank page.',
    prompts: ['Why is this needed?', 'What existing constraints matter?'],
  },
  {
    id: 'requirements',
    title: 'Requirements',
    required: true,
    placeholder: 'The app must validate required fields, support optional fields, and generate output in three formats.',
    prompts: ['What must be true?', 'Which inputs, states, and edge cases matter?'],
  },
  {
    id: 'scope',
    title: 'Scope',
    required: true,
    placeholder: 'Change React source, TypeScript components, styling, and formatter utilities. Do not change unrelated backend or auth files.',
    prompts: ['What files or folders should change?', 'What should not change?'],
  },
  {
    id: 'acceptance',
    title: 'Acceptance criteria',
    required: true,
    placeholder: 'The app loads without errors, validates required fields, and generates readable Markdown, plain text, and HTML.',
    prompts: ['What should accepted look like?', 'What are the pass/fail checks?'],
  },
  {
    id: 'implementation',
    title: 'Implementation notes',
    required: false,
    placeholder: 'Use controlled React inputs, typed section data, and separate formatting logic from UI code.',
    prompts: ['What approach should be used?', 'Which patterns or helpers should be reused?', 'What about testing?'],
  },
  {
    id: 'testing',
    title: 'Testing / validation',
    required: false,
    placeholder: 'Run the TypeScript build, test desktop and mobile layouts, and verify every output format.',
    prompts: ['What tests should be run?', 'What manual checks should pass?'],
  },
];

const formatOptions: Array<{ id: Format; label: string; icon: typeof FileText }> = [
  { id: 'markdown', label: 'Markdown', icon: FileText },
  { id: 'plain', label: 'Plain text', icon: ListChecks },
  { id: 'html', label: 'HTML', icon: Code2 },
];

const initialValues = sections.reduce<SpecValues>((values, section) => {
  values[section.id] = '';
  return values;
}, {});

function splitLines(value: string) {
  return value
    .split('\\n')
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

function getFilledSections(values: SpecValues) {
  return sections
    .map((section) => ({ section, lines: splitLines(values[section.id] ?? '') }))
    .filter(({ lines }) => lines.length > 0);
}

function formatSpec(values: SpecValues, format: Format) {
  const filledSections = getFilledSections(values);

  if (filledSections.length === 0) {
    return '';
  }

  if (format === 'markdown') {
    return filledSections
      .map(({ section, lines }) => `## ${section.title}\\n${lines.map((line) => `- ${line}`).join('\\n')}`)
      .join('\\n\\n');
  }

  if (format === 'html') {
    const body = filledSections
      .map(({ section, lines }) => {
        const items = lines.map((line) => `    <li>${escapeHtml(line)}</li>`).join('\\n');
        return `  <section>\\n    <h2>${escapeHtml(section.title)}</h2>\\n    <ul>\\n${items}\\n    </ul>\\n  </section>`;
      })
      .join('\\n');

    return `<article class=\"spec\">\\n${body}\\n</article>`;
  }

  return filledSections
    .map(({ section, lines }) => `${section.title}\\n${lines.map((line) => `- ${line}`).join('\\n')}`)
    .join('\\n\\n');
}

export function App() {
  const [values, setValues] = useState<SpecValues>(initialValues);
  const [format, setFormat] = useState<Format>('markdown');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('specthinker-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  const [plan, setPlan] = useState<Plan>(() => {
    const saved = localStorage.getItem('specthinker-plan');
    return saved === 'basic' || saved === 'pro' || saved === 'lifetime' ? saved : 'free';
  });
  const [polishedSpec, setPolishedSpec] = useState<string | null>(null);
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(false);
  const [specsUsed, setSpecsUsed] = useState<number>(0);
  const [backendReady, setBackendReady] = useState<boolean>(api.isConfigured());
  const [cliSection, setCliSection] = useState<'install' | 'usage' | 'why'>('install');

  const isPremium = plan !== 'free';
  const limits = PLAN_LIMITS[plan];
  const specsRemaining = Math.max(0, limits.specs - specsUsed);
  const limitReached = !Number.isFinite(limits.specs) ? false : specsUsed >= limits.specs;
  const apiConfigured = api.isConfigured();

  const missingRequired = useMemo(
    () => sections.filter((section) => section.required && !values[section.id].trim()).map((section) => section.id),
    [values],
  );
  const generatedSpec = useMemo(() => formatSpec(values, format), [values, format]);
  const canGenerate = missingRequired.length === 0;

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
        const info = await api.fetchSession();
        if (cancelled) return;
        setBackendReady(true);
        if (info.plan !== plan) setPlan(info.plan);
        setSpecsUsed(info.used.specs);
      } catch {
        try {
          const info = await api.bootstrapSession();
          if (cancelled) return;
          setBackendReady(true);
          if (info.plan !== plan) setPlan(info.plan);
          setSpecsUsed(info.used.specs);
        } catch {
          if (!cancelled) setBackendReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#success') return;
    const params = new URLSearchParams(window.location.search);
    const planFromUrl = params.get('plan');
    const nextPlan: Plan =
      planFromUrl === 'basic' || planFromUrl === 'pro' || planFromUrl === 'lifetime'
        ? planFromUrl
        : 'pro';
    setPlan(nextPlan);
    setSpecsUsed(0);
    setShowWelcomeBanner(true);
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
    const timer = window.setTimeout(() => setShowWelcomeBanner(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);

  function updateValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setCopied(false);
    setPolishedSpec(null);
    setPolishError(null);
  }

  async function copySpec() {
    setAttemptedSubmit(true);
    if (!canGenerate || !generatedSpec) return;
    if (limitReached) {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (apiConfigured && backendReady) {
      setQuotaMessage(null);
    }
    await navigator.clipboard.writeText(generatedSpec);
    setCopied(true);
    if (apiConfigured) {
      try {
        const info = await api.bootstrapSession();
        setSpecsUsed(info.used.specs);
      } catch {
        // ignore — backend may be down; copy still worked
      }
    } else {
      setSpecsUsed((c) => c + 1);
    }
  }

  async function polishWithAi() {
    setAttemptedSubmit(true);
    if (!canGenerate || !generatedSpec) return;
    if (limitReached) {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!apiConfigured) return;
    setIsPolishing(true);
    setPolishError(null);
    setQuotaMessage(null);
    try {
      const { polished } = await api.polishSpec(generatedSpec);
      setPolishedSpec(polished);
      try {
        const info = await api.fetchSession();
        setSpecsUsed(info.used.specs);
      } catch {
        // ignore
      }
    } catch (err) {
      if (err instanceof api.QuotaExceededError) {
        setQuotaMessage(err.message);
        setSpecsUsed(limits.specs);
      } else if (err instanceof api.LlmUnavailableError) {
        setPolishError(err.message);
      } else if (err instanceof api.NotConfiguredError) {
        setPolishError('AI polish is not configured yet.');
      } else {
        setPolishError('AI polish failed. Your spec was not modified.');
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
      setAttemptedSubmit(false);
      setCopied(false);
      setPolishedSpec(null);
      setPolishError(null);
      setQuotaMessage(null);
      setPlan('free');
      setSpecsUsed(0);
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
          <span>
            Welcome to {PLAN_LABELS[plan]}!{' '}
            {plan === 'lifetime' ? 'Unlimited specs unlocked.' : `${limits.specs} specs / month unlocked.`}
          </span>
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
                {canGenerate ? 'Ready' : `${missingRequired.length} missing`}
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
              {polishedSpec && <span className="preview-badge">Polished</span>}
              <pre className="preview" aria-live="polite">
                {canGenerate && generatedSpec
                  ? (polishedSpec || generatedSpec)
                  : 'Fill in the required sections to generate a spec preview.'}
              </pre>
            </div>

            <div className="action-buttons">
              <button
                className="primary-button"
                type="button"
                onClick={copySpec}
                disabled={!canGenerate || limitReached}
              >
                <Clipboard size={18} aria-hidden="true" />
                {copied ? 'Copied' : isPremium ? 'Copy polished spec' : 'Copy spec'}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={polishWithAi}
                disabled={!canGenerate || limitReached || isPolishing || !apiConfigured}
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

            {plan === 'free' && !quotaMessage && (
              <p className="free-generations-text">
                {specsRemaining} of {limits.specs} free specs remaining.
              </p>
            )}
            {plan === 'free' && quotaMessage && (
              <p className="free-generations-text">
                <a href="#pricing" onClick={(e) => { e.preventDefault(); document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  Upgrade to keep generating
                </a>
                .
              </p>
            )}
            {plan !== 'free' && (
              <p className="free-generations-text">
                {Number.isFinite(limits.specs) ? `${specsRemaining} of ${limits.specs} specs remaining this month.` : 'Unlimited specs.'}
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
            <h2 className="section-title">Pick the plan that fits your workflow.</h2>
            <p className="section-subtitle">
              Start free with 2 spec generations. Upgrade when you need unlimited access, advanced
              AI polishing, or lifetime updates.
            </p>
          </div>

          <div className="pricing-grid">
            <article className="pricing-card">
              <header className="pricing-card-header">
                <h3>Basic</h3>
                <p className="pricing-card-tagline">For solo builders exploring the tool.</p>
              </header>
              <div className="pricing-card-price">
                <span className="pricing-amount">$5</span>
                <span className="pricing-period">/month</span>
              </div>
              <ul className="pricing-card-features">
                <li><Check size={16} aria-hidden="true" /><span>Unlimited spec generations</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Basic AI polishing</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Markdown, HTML, and plain text export</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Cancel anytime</span></li>
              </ul>
              <a
                className="pricing-card-button"
                href={STRIPE.basicPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Subscribe to Basic plan for $5 per month"
              >
                Choose Basic
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>

            <article className="pricing-card featured">
              <header className="pricing-card-header">
                <h3>Pro</h3>
                <p className="pricing-card-tagline">For AI builders shipping every week.</p>
              </header>
              <div className="pricing-card-price">
                <span className="pricing-amount">$15</span>
                <span className="pricing-period">/month</span>
              </div>
              <ul className="pricing-card-features">
                <li><Check size={16} aria-hidden="true" /><span>Everything in Basic</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Advanced AI polishing</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Priority email support</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Early access to new formats</span></li>
              </ul>
              <a
                className="pricing-card-button primary"
                href={STRIPE.proPaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Subscribe to Pro plan for $15 per month"
              >
                Choose Pro
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>

            <article className="pricing-card">
              <header className="pricing-card-header">
                <h3>Lifetime</h3>
                <p className="pricing-card-tagline">Pay once, own it forever.</p>
              </header>
              <div className="pricing-card-price">
                <span className="pricing-amount">$100</span>
                <span className="pricing-period">one-time</span>
              </div>
              <ul className="pricing-card-features">
                <li><Check size={16} aria-hidden="true" /><span>Unlimited specs, forever</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Premium AI polishing</span></li>
                <li><Check size={16} aria-hidden="true" /><span>All future updates included</span></li>
                <li><Check size={16} aria-hidden="true" /><span>Priority support for life</span></li>
              </ul>
              <a
                className="pricing-card-button"
                href={STRIPE.lifetimePaymentLink}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buy Lifetime plan for $100 one-time"
              >
                Buy Lifetime
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            </article>
          </div>

          <p className="pricing-footnote">
            All plans include AI Polish, the spec builder, and Markdown / HTML / plain text export.
            Subscriptions are billed monthly. Lifetime is a one-time payment.
            Need a team plan? <a href="mailto:hello@specbuild.dev">Contact us</a>.
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