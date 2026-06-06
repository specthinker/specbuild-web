import { ArrowLeft, Bug, CheckCircle2, ExternalLink, Lightbulb, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { isContactFormConfigured, submitContact, topicLabel, type ContactSubmission, type ContactTopic } from '../lib/contact';

interface ContactPageProps {
  onBack: () => void;
}

const TOPICS: Array<{ id: ContactTopic; label: string; icon: typeof Bug; description: string }> = [
  { id: 'bug', label: 'Bug report', icon: Bug, description: 'Something is broken or behaving wrong.' },
  { id: 'feature', label: 'Feature request', icon: Lightbulb, description: 'An idea to make Spec Builder better.' },
  { id: 'question', label: 'Question', icon: MessageCircle, description: 'Help using Spec Builder.' },
  { id: 'other', label: 'Other', icon: Send, description: 'Anything else.' },
];

const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || 'muhammadkonecom@gmail.com';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function ContactPage({ onBack }: ContactPageProps) {
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [deliveredVia, setDeliveredVia] = useState<'formspree' | 'mailto' | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const formConfigured = isContactFormConfigured();

  function reset() {
    setEmail('');
    setTopic('bug');
    setSubject('');
    setMessage('');
    setStatus('idle');
    setErrorText(null);
    setDeliveredVia(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === 'sending') return;
    setErrorText(null);
    if (!email.trim() || !message.trim()) {
      setErrorText('Email and message are required.');
      return;
    }
    if (message.trim().length < 10) {
      setErrorText('Please add a few more details (at least 10 characters).');
      return;
    }
    setStatus('sending');
    try {
      const submission: ContactSubmission = {
        email: email.trim(),
        topic,
        subject: subject.trim() || topicLabel(topic),
        message: message.trim(),
      };
      const result = await submitContact(submission);
      setDeliveredVia(result.deliveredVia);
      setStatus('sent');
    } catch (err) {
      setStatus('error');
      setErrorText(err instanceof Error ? err.message : 'Could not send. Please try again or email us directly.');
    }
  }

  if (status === 'sent') {
    return (
      <section className="contact-page workspace" aria-labelledby="contact-title">
        <button type="button" className="contact-back" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Spec Builder
        </button>
        <div className="contact-card contact-success" role="status">
          <CheckCircle2 size={36} aria-hidden="true" className="contact-success-icon" />
          <h1 className="contact-title">Thanks — message received.</h1>
          <p className="contact-sub">
            {deliveredVia === 'formspree'
              ? 'Your message was sent through the contact form. I\u2019ll reply to the email you provided.'
              : (
                <>
                  Your mail app should be opening with a pre-filled message to{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Hit send to deliver it.
                </>
              )}
          </p>
          <div className="contact-success-actions">
            <button type="button" className="primary-button" onClick={reset}>
              Send another
            </button>
            <button type="button" className="ghost-button" onClick={onBack}>
              Back to Spec Builder
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="contact-page workspace" aria-labelledby="contact-title">
      <button type="button" className="contact-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" />
        Back to Spec Builder
      </button>

      <div className="contact-card">
        <header className="contact-header">
          <span className="section-eyebrow">Contact &amp; bug reports</span>
          <h1 id="contact-title" className="contact-title">Hit a wall? Tell me about it.</h1>
          <p className="contact-sub">
            Found a bug, got a feature idea, or stuck on something? Send a quick note and I&apos;ll get back to you.
            {' '}
            <a className="contact-mailto-fallback" href={`mailto:${CONTACT_EMAIL}`}>
              <ExternalLink size={13} aria-hidden="true" />
              or email {CONTACT_EMAIL} directly
            </a>
          </p>
        </header>

        <form className="contact-form" onSubmit={onSubmit} noValidate>
          <fieldset className="contact-fieldset">
            <legend className="contact-legend">What kind of message is this?</legend>
            <div className="contact-topic-grid">
              {TOPICS.map((option) => {
                const Icon = option.icon;
                const active = topic === option.id;
                return (
                  <label
                    key={option.id}
                    className={active ? 'contact-topic-card active' : 'contact-topic-card'}
                  >
                    <input
                      type="radio"
                      name="contact-topic"
                      value={option.id}
                      checked={active}
                      onChange={() => setTopic(option.id)}
                    />
                    <Icon size={18} aria-hidden="true" />
                    <span className="contact-topic-label">{option.label}</span>
                    <span className="contact-topic-desc">{option.description}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="contact-field">
            <span className="contact-field-label">Your email <span className="badge required">Required</span></span>
            <span className="contact-field-hint">So I can reply.</span>
            <input
              type="email"
              className="contact-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="contact-field">
            <span className="contact-field-label">Short summary <span className="badge optional">Optional</span></span>
            <span className="contact-field-hint">A one-line title. Defaults to the topic.</span>
            <input
              type="text"
              className="contact-input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={topic === 'bug' ? 'Polish button doesn’t do anything' : undefined}
              maxLength={120}
            />
          </label>

          <label className="contact-field">
            <span className="contact-field-label">What happened? <span className="badge required">Required</span></span>
            <span className="contact-field-hint">
              {topic === 'bug'
                ? 'Steps to reproduce, what you expected, and what actually happened. Browser + OS helps.'
                : 'Tell me what you’d like, or what you’re trying to do.'}
            </span>
            <textarea
              className="contact-textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={7}
              placeholder={
                topic === 'bug'
                  ? '1. Open the app\n2. Fill the Goal field with…\n3. Click "Polish with AI"\n\nExpected: …\nActual: …\n\nBrowser: Chrome 124 on macOS 14.4'
                  : 'Describe what you’re trying to do and what would help.'
              }
              required
              minLength={10}
            />
          </label>

          {errorText && <p className="contact-error" role="alert">{errorText}</p>}

          <div className="contact-form-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={status === 'sending'}
            >
              <Send size={16} aria-hidden="true" />
              {status === 'sending' ? 'Sending…' : 'Send message'}
            </button>
            <span className="contact-delivery-note">
              {formConfigured
                ? 'Delivered via secure form.'
                : <>Not configured yet — sending will open your mail app addressed to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>}
            </span>
          </div>
        </form>
      </div>
    </section>
  );
}
