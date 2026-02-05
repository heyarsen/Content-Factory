import { LegalDocument } from './legalContent'
import { Language } from '../locales'
import { COOKIE_POLICY_VERSION, PRIVACY_POLICY_VERSION } from '../lib/privacyConfig'

export type ComplianceDocuments = {
  privacyPolicy: LegalDocument
  terms: LegalDocument
  cookiePolicy: LegalDocument
  acceptableUse: LegalDocument
  subprocessors: LegalDocument
  dpa: LegalDocument
}

const shared: ComplianceDocuments = {
  privacyPolicy: {
    title: 'Privacy Policy',
    intro: [
      `Effective date: ${PRIVACY_POLICY_VERSION}`,
      'This Privacy Policy explains how [COMPANY LEGAL NAME] ("Company", "we", "us") collects, uses, discloses, and protects personal data when you use ai-smm.co (the "Service"). This is a baseline policy for GDPR + CCPA/CPRA compliance and includes placeholders you must replace before launch.',
    ],
    sections: [
      {
        heading: '1. Who we are',
        paragraphs: [
          '[COMPANY LEGAL NAME], [REGISTERED ADDRESS], is the data controller for the Service. Privacy contact: [PRIVACY CONTACT EMAIL].',
        ],
      },
      {
        heading: '2. Personal data we collect',
        paragraphs: [
          'Account data: name, email, password hash, authentication IDs, language, timezone, and subscription status.',
          'Content data: prompts, scripts, video metadata, captions, scheduled posts, and connected social account identifiers.',
          'Billing data: transaction IDs, plan, payment timestamps, and payment status (full card data is handled by payment processors).',
          'Support data: ticket messages and attachments you submit.',
          'Usage data: device, browser, IP address, log timestamps, and activity metadata (see Cookie Policy for details).',
        ],
      },
      {
        heading: '3. Sources of data',
        paragraphs: [
          'We collect data directly from you, automatically from your device, and from third parties you connect (e.g., social platforms) and service providers (e.g., payment and analytics vendors).',
        ],
      },
      {
        heading: '4. Purposes and legal bases (EEA/UK)',
        paragraphs: [
          'We process personal data to provide the Service, maintain security, respond to support, process payments, and improve the platform.',
          'Legal bases include contract performance, legitimate interests, consent (for non-essential cookies/marketing), and legal obligations.',
        ],
      },
      {
        heading: '5. Sharing and disclosures',
        paragraphs: [
          'We share data with subprocessors listed on the Subprocessors page, professional advisers, and authorities where required. We do not sell personal information.',
          'We may disclose data in connection with a corporate transaction (merger, acquisition, or asset sale).',
        ],
      },
      {
        heading: '6. International transfers',
        paragraphs: [
          'Where data is transferred internationally, we rely on mechanisms such as Standard Contractual Clauses (SCCs) and/or the EU-U.S. Data Privacy Framework (DPF), as applicable. [INSERT TRANSFER MECHANISM DETAILS].',
        ],
      },
      {
        heading: '7. Data retention',
        paragraphs: [
          'We retain data per the Retention Policy. Examples: account data for the duration of the account; logs retained 30–90 days; backups retained [X days]. See docs/legal/RETENTION.md for defaults.',
        ],
      },
      {
        heading: '8. Your rights',
        paragraphs: [
          'EEA/UK: access, rectification, deletion, restriction, portability, and objection; you can withdraw consent at any time.',
          'California: right to know, delete, correct, opt-out of selling/sharing, and non-discrimination.',
          'Contact us at [PRIVACY CONTACT EMAIL] to exercise rights. We may verify your identity before responding.',
        ],
      },
      {
        heading: '9. Cookies and tracking',
        paragraphs: [
          'We use cookies and similar technologies. Non-essential cookies are blocked until you opt in. See the Cookie Policy for details and categories.',
        ],
      },
      {
        heading: '10. Security',
        paragraphs: [
          'We use administrative, technical, and physical safeguards such as access controls, encryption in transit, and audit logging. OAuth tokens are encrypted at rest.',
        ],
      },
      {
        heading: '11. Children',
        paragraphs: [
          'The Service is not intended for children under 16 (or the age required in your jurisdiction). We do not knowingly collect such data.',
        ],
      },
      {
        heading: '12. Changes',
        paragraphs: [
          'We may update this policy. Material changes will be posted with an updated effective date.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    intro: [
      'These Terms govern your use of ai-smm.co. By using the Service, you agree to these Terms and the Privacy Policy.',
    ],
    sections: [
      {
        heading: '1. Account and access',
        paragraphs: [
          'You must provide accurate information and keep your credentials secure. You are responsible for activities under your account.',
        ],
      },
      {
        heading: '2. Service usage',
        paragraphs: [
          'You may use the Service only in compliance with applicable laws and the Acceptable Use Policy.',
        ],
      },
      {
        heading: '3. Subscriptions and billing',
        paragraphs: [
          'Fees, billing cycles, and taxes are described at checkout. [REFUND POLICY DETAILS REQUIRED].',
        ],
      },
      {
        heading: '4. Intellectual property',
        paragraphs: [
          'You retain ownership of your content. We grant you a limited, non-exclusive right to use the Service. Our software and trademarks remain our property.',
        ],
      },
      {
        heading: '5. Third-party services',
        paragraphs: [
          'The Service integrates with third-party platforms; your use of those services is subject to their terms.',
        ],
      },
      {
        heading: '6. Termination',
        paragraphs: [
          'You can stop using the Service at any time. We may suspend or terminate accounts for violations or security risks.',
        ],
      },
      {
        heading: '7. Disclaimers',
        paragraphs: [
          'The Service is provided "as is" without warranties to the maximum extent permitted by law.',
        ],
      },
      {
        heading: '8. Limitation of liability',
        paragraphs: [
          'To the extent permitted by law, our liability is limited to the amount paid for the Service in the prior 12 months.',
        ],
      },
      {
        heading: '9. Governing law',
        paragraphs: [
          '[GOVERNING LAW/VENTUE PLACEHOLDER].',
        ],
      },
      {
        heading: '10. Contact',
        paragraphs: [
          'Legal contact: [LEGAL CONTACT EMAIL].',
        ],
      },
    ],
  },
  cookiePolicy: {
    title: 'Cookie Policy',
    intro: [
      `Effective date: ${COOKIE_POLICY_VERSION}`,
      'We use cookies and similar technologies to operate the Service. Non-essential cookies are blocked until you opt in.',
    ],
    sections: [
      {
        heading: '1. Categories',
        list: [
          'Necessary: required for authentication, security, and core features.',
          'Analytics: help us understand usage to improve the Service (e.g., Google Analytics).',
          'Marketing: used for advertising and conversion tracking (e.g., Meta Pixel).',
        ],
      },
      {
        heading: '2. Managing cookies',
        paragraphs: [
          'You can manage preferences using the cookie banner or via Settings → Privacy controls.',
        ],
      },
      {
        heading: '3. Cookies we set',
        paragraphs: [
          'Necessary cookies include session and security identifiers. Analytics/marketing cookies are only set after opt-in.',
        ],
      },
    ],
  },
  acceptableUse: {
    title: 'Acceptable Use Policy',
    intro: [
      'You agree not to misuse the Service. The following activities are prohibited.',
    ],
    sections: [
      {
        heading: '1. Prohibited activities',
        list: [
          'Illegal, harmful, or abusive content; harassment or threats.',
          'Infringing intellectual property rights or privacy.',
          'Attempting to bypass security or access other accounts.',
          'Spamming, scraping, or automated misuse without authorization.',
        ],
      },
      {
        heading: '2. Enforcement',
        paragraphs: [
          'We may suspend or terminate accounts for violations and cooperate with law enforcement.',
        ],
      },
    ],
  },
  subprocessors: {
    title: 'Subprocessors',
    intro: [
      'We use subprocessors to deliver the Service. This list must be reviewed and updated before launch.',
    ],
    sections: [
      {
        heading: 'Current subprocessors (placeholder)',
        list: [
          '[Subprocessor Name] — Hosting/Infrastructure — [Region]',
          '[Subprocessor Name] — Database (Supabase) — [Region]',
          '[Subprocessor Name] — Payments — [Region]',
          '[Subprocessor Name] — Analytics — [Region]',
          '[Subprocessor Name] — Email/Support — [Region]',
        ],
      },
      {
        heading: 'Updates',
        paragraphs: [
          'We will post changes with advance notice where required.',
        ],
      },
    ],
  },
  dpa: {
    title: 'Data Processing Addendum (DPA)',
    intro: [
      'This DPA applies to B2B customers who are controllers and appoint [COMPANY LEGAL NAME] as processor. Replace placeholders before use.',
    ],
    sections: [
      {
        heading: '1. Processing details',
        paragraphs: [
          'Subject matter: provision of the Service. Duration: term of the agreement. Nature: hosting and processing customer content and account data. Categories of data and data subjects are described in the Privacy Policy.',
        ],
      },
      {
        heading: '2. Processor obligations',
        paragraphs: [
          'We will process data only on documented instructions, apply security measures, assist with data subject requests, and notify of breaches without undue delay.',
        ],
      },
      {
        heading: '3. Subprocessors',
        paragraphs: [
          'We maintain a list of subprocessors and flow down contractual obligations.',
        ],
      },
      {
        heading: '4. International transfers',
        paragraphs: [
          '[INSERT SCC/DPF MECHANISM AND MODULES].',
        ],
      },
      {
        heading: '5. Audit',
        paragraphs: [
          'We will make available information reasonably necessary to demonstrate compliance.',
        ],
      },
    ],
  },
}

export const complianceContent: Record<Language, ComplianceDocuments> = {
  en: shared,
  es: shared,
  de: shared,
  ru: shared,
  uk: shared,
}
