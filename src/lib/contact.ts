/**
 * Contact / bug-report submission.
 *
 * Primary path: AJAX POST to Formspree (https://formspree.io). Free tier is
 * 50 submissions/month. Set VITE_FORMSPREE_ID in .env to enable.
 *
 * Fallback: if no Formspree ID is set (or the POST fails), open a mailto:
 * link addressed to VITE_CONTACT_EMAIL with a pre-filled subject and body.
 * The visitor's mail client then sends the message — zero signup required.
 */

const FORMSPREE_ID = (import.meta.env.VITE_FORMSPREE_ID as string | undefined)?.trim() ?? '';
const CONTACT_EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() || 'muhammadkonecom@gmail.com';

export type ContactTopic = 'bug' | 'feature' | 'question' | 'other';

export interface ContactSubmission {
  email: string;
  topic: ContactTopic;
  subject: string;
  message: string;
}

const TOPIC_LABELS: Record<ContactTopic, string> = {
  bug: 'Bug report',
  feature: 'Feature request',
  question: 'Question',
  other: 'Other',
};

export function topicLabel(topic: ContactTopic): string {
  return TOPIC_LABELS[topic];
}

export function isContactFormConfigured(): boolean {
  return FORMSPREE_ID.length > 0;
}

function buildMailtoHref(submission: ContactSubmission): string {
  const subject = `[Spec Builder] ${TOPIC_LABELS[submission.topic]}: ${submission.subject}`.trim();
  const body = [
    `Topic: ${TOPIC_LABELS[submission.topic]}`,
    `From: ${submission.email}`,
    '',
    submission.message,
  ].join('\n');
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export async function submitContact(submission: ContactSubmission): Promise<{ deliveredVia: 'formspree' | 'mailto' }> {
  if (FORMSPREE_ID) {
    try {
      const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: submission.email,
          topic: TOPIC_LABELS[submission.topic],
          subject: submission.subject,
          message: submission.message,
          _subject: `[Spec Builder] ${TOPIC_LABELS[submission.topic]}: ${submission.subject}`,
        }),
      });
      if (res.ok) return { deliveredVia: 'formspree' };
    } catch {
      // fall through to mailto
    }
  }

  const href = buildMailtoHref(submission);
  if (typeof window !== 'undefined') {
    window.location.href = href;
  }
  return { deliveredVia: 'mailto' };
}
