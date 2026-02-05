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
      'This Privacy Policy explains how ФОП ЯШУНІН АРСЕНІЙ ЮРІЙОВИЧ ("Company", "we", "us") collects, uses, discloses, and protects personal data when you use ai-smm.co (the "Service").',
    ],
    sections: [
      {
        heading: '1. Who we are',
        paragraphs: [
          'ФОП ЯШУНІН АРСЕНІЙ ЮРІЙОВИЧ, Окіпної 4, 153, Київ, Україна, is the data controller for the Service. Privacy contact: privacy@ai-smm.co.',
        ],
      },
      {
        heading: '2. Personal data we collect',
        paragraphs: [
          'Account data: name, email, password hash, language, timezone, and subscription status.',
          'Authentication data: OAuth identifiers, session tokens, and security logs.',
          'Content data: prompts, scripts, video metadata, captions, and scheduled posts.',
          'Connected accounts: social platform account identifiers and connection status.',
          'Billing data: transaction IDs, plan, payment timestamps, and payment status (full card data is handled by payment processors).',
          'Support data: ticket messages and attachments you submit.',
          'Usage data: device, browser, IP address, log timestamps, and activity metadata (see Cookie Policy for details).',
          'Media assets: avatars and generated media.',
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
          'Where personal data is transferred outside the EEA/UK, we rely on an adequacy decision where available (for example, the EU–US Data Privacy Framework where applicable) and/or Standard Contractual Clauses, plus supplementary measures as needed.',
        ],
      },
      {
        heading: '7. Data retention',
        paragraphs: [
          'We retain data per the Retention Policy. Examples: account data for the duration of the account; logs retained 60 days; backups retained 30 days.',
          'Deletion requests are fulfilled within 30 days after a 30-day grace period, unless a longer period is required by law.',
        ],
      },
      {
        heading: '8. Your rights',
        paragraphs: [
          'EEA/UK: access, rectification, deletion, restriction, portability, and objection; you can withdraw consent at any time.',
          'California: right to know, delete, correct, opt-out of selling/sharing, and non-discrimination.',
          'Contact us at privacy@ai-smm.co to exercise rights. We may verify your identity before responding.',
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
          'Fees, billing cycles, and taxes are described at checkout. No free trial is offered. Subscription fees are non-refundable except where required by law. If you believe you were charged in error, contact support; we will review billing issues and correct errors as appropriate. Cancellation takes effect at the end of the current billing period; we do not provide prorated refunds.',
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
          'These Terms are governed by the laws of Ukraine, and disputes are subject to the courts of Kyiv, Ukraine.',
        ],
      },
      {
        heading: '10. Contact',
        paragraphs: [
          'Legal contact: legal@ai-smm.co.',
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
          'Analytics: help us understand usage to improve the Service (Google Analytics).',
          'Marketing: used for advertising and conversion tracking (Meta Pixel).',
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
        heading: 'Current subprocessors',
        list: [
          'Supabase — Database & auth hosting — United States (global)',
          'Railway — Hosting/Infrastructure — United States',
          'Upload-Post — Social posting API — Global',
          'HeyGen — Video generation API — United States',
          'OpenAI — AI content generation — United States',
          'WayForPay — Payments — Ukraine',
          'Google Analytics — Analytics — United States',
          'Meta Platforms (Meta Pixel) — Marketing — United States',
          'Supabase (Auth email delivery) — Transactional email — United States (global)',
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
      'This DPA applies to B2B customers who are controllers and appoint ФОП ЯШУНІН АРСЕНІЙ ЮРІЙОВИЧ as processor.',
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
          'We rely on adequacy decisions where available (including the EU–US Data Privacy Framework where applicable) and/or Standard Contractual Clauses. SCC modules used: Module 2 (controller to processor) and Module 3 (processor to processor) as applicable.',
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
