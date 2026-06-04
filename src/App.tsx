import { ArrowRight, Check, Clipboard, Code2, FileText, GitBranch, ListChecks, Moon, RefreshCcw, Sparkles, Sun, Target } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'react-markdown';

type Format = 'markdown' | 'plain' | 'html';
type Theme = 'dark' | 'light';

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

// Mock function for local model polishing
async function polishSpecLocally(spec: string): Promise<string> {
  // Simulate API call or local model processing
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`**[Polished by Local AI]**\\n${spec.replace(/errors|mistakes/gi, 'improvements').replace(/clear/gi, 'highly clear and concise')}`);
    }, 1500);
  });
}

// Payment Modal Component
interface PaymentModalProps {
  onClose: () => void;
  onPurchase: (plan: string) => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ onClose, onPurchase }) => {
  const handleCheckout = (plan: string) => {
    alert(`Initiating ${plan} checkout via Stripe... (Mock)`);
    // In a real application, you would integrate with Stripe.js here
    // For now, we'll simulate a successful purchase.
    onPurchase(plan);
  };

  return (
    <div className="payment-modal-overlay">
      <div className="payment-modal">
        <h2>Unlock unlimited spec generations</h2>
        <p>Generate 2 specs for free. For unlimited access, choose a plan:</p>
        <div className="payment-plans">
          <div className="plan-card">
            <h3>Basic</h3>
            <p className="price">$5<small>/month</small></p>
            <ul>
              <li><Check size={16} aria-hidden="true" /><span>Unlimited specs</span></li>
              <li><Check size={16} aria-hidden="true" /><span>Basic polishing</span></li>
            </ul>
            <button onClick={() => handleCheckout('Basic Monthly')}>Choose Basic</button>
          </div>
          <div className="plan-card featured">
            <h3>Pro</h3>
            <p className="price">$15<small>/month</small></p>
            <ul>
              <li><Check size={16} aria-hidden="true" /><span>Unlimited specs</span></li>
              <li><Check size={16} aria-hidden="true" /><span>Advanced polishing</span></li>
              <li><Check size={16} aria-hidden="true" /><span>Priority support</span></li>
            </ul>
            <button onClick={() => handleCheckout('Pro Monthly')}>Choose Pro</button>
          </div>
          <div className="plan-card">
            <h3>Lifetime</h3>
            <p className="price">$100<small>/one-time</small></p>
            <ul>
              <li><Check size={16} aria-hidden="true" /><span>Unlimited specs, forever</span></li>
              <li><Check size={16} aria-hidden="true" /><span>Premium polishing</span></li>
              <li><Check size={16} aria-hidden="true" /><span>All future updates</span></li>
            </ul>
            <button onClick={() => handleCheckout('Lifetime')}>Buy Lifetime</button>
          </div>
        </div>
        <button className="ghost-button" onClick={onClose}>No thanks, I'll stick to free</button>
      </div>
    </div>
  );
};

export function App() {
  const [values, setValues] = useState<SpecValues>(initialValues);
  const [format, setFormat] = useState<Format>('markdown');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('specthinker-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  // New state for local model and payment
  const [localModelPolishedSpec, setLocalModelPolishedSpec] = useState<string | null>(null);
  const [specGenerationCount, setSpecGenerationCount] = useState<number>(() => {
    const savedCount = localStorage.getItem('spec-gen-count');
    return savedCount ? parseInt(savedCount, 10) : 0;
  });
  const [isPremiumUser, setIsPremiumUser] = useState<boolean>(() => {
    const savedPremium = localStorage.getItem('is-premium-user');
    return savedPremium === 'true';
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cliSection, setCliSection] = useState<'install' | 'usage' | 'why'>('install');

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
    localStorage.setItem('spec-gen-count', specGenerationCount.toString());
  }, [specGenerationCount]);

  useEffect(() => {
    localStorage.setItem('is-premium-user', isPremiumUser.toString());
  }, [isPremiumUser]);

  function updateValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setCopied(false);
    setLocalModelPolishedSpec(null); // Reset polished spec on input change
  }

  async function copySpec() {
    setAttemptedSubmit(true);
    if (!canGenerate || !generatedSpec) {
      return;
    }

    if (!isPremiumUser && specGenerationCount >= 2) {
      setShowPaymentModal(true);
      return;
    }

    // Polish spec with local model mock
    const polished = await polishSpecLocally(generatedSpec);
    setLocalModelPolishedSpec(polished);
    
    await navigator.clipboard.writeText(polished); // Copy polished spec
    setCopied(true);

    if (!isPremiumUser) {
      setSpecGenerationCount((prevCount) => prevCount + 1);
    }
  }

  function resetForm() {
    setValues(initialValues);
    setAttemptedSubmit(false);
    setCopied(false);
    setLocalModelPolishedSpec(null);
  }

  const handlePurchaseSuccess = (plan: string) => {
    setIsPremiumUser(true);
    setShowPaymentModal(false);
    alert(`Successfully purchased ${plan} plan! You are now a premium user.`);
  };

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
      <section className="hero-section workspace" aria-labelledby="page-title">
        <header className="topbar">
          <div>
            <p className="eyebrow">Spec Builder</p>
            <h1 id="page-title">Create a complete software spec</h1>
          </div>
          <div className="topbar-actions">
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

            <pre className="preview" aria-live="polite">
              {canGenerate && generatedSpec
                ? (localModelPolishedSpec || generatedSpec)
                : 'Fill in the required sections to generate a spec preview.'}
            </pre>
            <button className="primary-button" type="button" onClick={copySpec}>
              <Clipboard size={18} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy generated spec and Polish with AI'}
            </button>
             {!isPremiumUser && (
              <p className="free-generations-text">
                {2 - specGenerationCount} free generations left.
              </p>
            )}
          </aside>
        </div>
      </section>

      {/* Local Model Section */}
      <section className="section-wrapper">
        <div className="local-model-section">
          <div className="local-model-content">
            <div className="local-model-text">
              <span className="section-eyebrow">Local AI Polishing</span>
              <h2 className="section-title">Polished specs without leaving your machine.</h2>
              <p>
                Enhance your spec with our local AI model. It cleans up grammar, clarifies phrasing,
                and optimizes for AI agent consumption — all running directly on your PC.
              </p>
              <p>
                Activates automatically after you generate a spec, keeping every iteration private
                and lightning fast.
              </p>
              <ul className="local-model-features">
                <li>
                  <Check size={18} aria-hidden="true" />
                  <span>Runs entirely on-device — your spec never leaves the browser.</span>
                </li>
                <li>
                  <Check size={18} aria-hidden="true" />
                  <span>Context-aware rewrites tuned for AI agent prompts.</span>
                </li>
                <li>
                  <Check size={18} aria-hidden="true" />
                  <span>Sub-second polish with no API rate limits or usage fees.</span>
                </li>
              </ul>
            </div>
            <div className="local-model-visual" aria-hidden="true">
              <span className="polish-tag">Polished output</span>
              <pre>
{`## Goal / Outcome
- Build a complete website that helps users
  <span class="diff-old">create clear specs</span><span class="diff-new">produce structured, AI-ready specifications</span>.
- Deliver a guided workflow that removes
  <span class="diff-old">errors</span><span class="diff-new">ambiguity</span> from planning.`}
              </pre>
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

      {/* Marketing Section */}
      <section className="section-wrapper">
        <div className="marketing-section">
          <div className="marketing-content">
            <div className="marketing-headline">
              <span className="section-eyebrow">Built for AI builders</span>
              <h2 className="section-title">Craft perfect AI agent specs, effortlessly.</h2>
              <p>
                Tired of ambiguous instructions and inconsistent outputs from your AI agents?
                Spec Builder turns rough ideas into structured blueprints that any model can follow.
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
                <h4>Polish with local AI</h4>
                <p>Sharpen wording and tighten scope without sending data to the cloud.</p>
              </div>
              <div className="workflow-step">
                <span className="workflow-step-num">3</span>
                <h4>Export and ship</h4>
                <p>Copy Markdown, HTML, or plain text straight into your repo or agent config.</p>
              </div>
            </div>

            <div className="community-cta">
              <h2 className="section-title">Join a growing community of AI innovators.</h2>
              <p>
                Whether you're a seasoned AI developer or just starting out, Spec Builder is your
                essential companion for bringing agent ideas to life.
              </p>
              <button type="button" className="call-to-action-button">
                Start building your perfect spec
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-footer-content">
          <p>Spec Builder — turn fuzzy ideas into specs that AI agents actually understand.</p>
          <div className="site-footer-links">
            <a href="#top">Back to top</a>
            <a href="#features">Features</a>
            <a href="#cli">CLI</a>
            <a href="#pricing">Pricing</a>
          </div>
          <p>&copy; {new Date().getFullYear()} Spec Builder. Crafted for builders.</p>
        </div>
      </footer>

      {showPaymentModal && (
        <PaymentModal
          onClose={() => setShowPaymentModal(false)}
          onPurchase={handlePurchaseSuccess}
        />
      )}
    </main>
  );
}