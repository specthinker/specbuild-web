import { Check, Clipboard, Code2, FileText, ListChecks, Moon, RefreshCcw, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
    prompts: ['What approach should be used?', 'Which patterns or helpers should be reused?'],
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
    .split('\n')
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
  const [values, setValues] = useState<SpecValues>(initialValues);
  const [format, setFormat] = useState<Format>('markdown');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('specthinker-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  const missingRequired = useMemo(
    () => sections.filter((section) => section.required && !values[section.id].trim()).map((section) => section.id),
    [values],
  );
  const generatedSpec = useMemo(() => formatSpec(values, format), [values, format]);
  const canGenerate = missingRequired.length === 0;

  useEffect(() => {
    localStorage.setItem('specthinker-theme', theme);
  }, [theme]);

  function updateValue(id: string, value: string) {
    setValues((current) => ({ ...current, [id]: value }));
    setCopied(false);
  }

  async function copySpec() {
    setAttemptedSubmit(true);
    if (!canGenerate || !generatedSpec) {
      return;
    }

    await navigator.clipboard.writeText(generatedSpec);
    setCopied(true);
  }

  function resetForm() {
    setValues(initialValues);
    setAttemptedSubmit(false);
    setCopied(false);
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <section className="workspace" aria-labelledby="page-title">
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
                ? generatedSpec
                : 'Fill in the required sections to generate a spec preview.'}
            </pre>

            <button className="primary-button" type="button" onClick={copySpec}>
              <Clipboard size={18} aria-hidden="true" />
              {copied ? 'Copied' : 'Copy generated spec'}
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
