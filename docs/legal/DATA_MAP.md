# Data Map (ai-smm.co)

> **Generated from repository review.**

## Systems
- **Frontend:** Vite + React (SPA).
- **Backend:** Node.js + Express.
- **Database/Auth:** Supabase (Postgres + Auth).

## PII inventory (by feature)

| Data category | Examples | Stored in | Purpose | Retention |
| --- | --- | --- | --- | --- |
| Account data | name, email, password hash, locale, timezone | `auth.users`, `user_profiles`, `user_preferences` | Account creation, authentication, personalization | Account lifetime + retention policy |
| Social connections | platform account IDs, connection status | `social_accounts` | Connect social platforms, schedule posts | Account lifetime + retention policy |
| Content data | prompts, scripts, video metadata, captions | `videos`, `video_plans`, `video_plan_items`, `video_prompts`, `content_items`, `reels` | Content creation and automation | Account lifetime + retention policy |
| Billing data | plan, payment status, transactions | `user_subscriptions`, `subscription_payment_history`, `credit_transactions` | Billing and credits | Legal/compliance period |
| Support data | tickets, messages | `support_tickets`, `support_messages` | Customer support | 24 months (default) |
| Usage data | IP, user-agent, activity timestamps | `admin_audit_logs`, `privacy_consents`, server logs | Security, auditing | 30–90 days (logs) |
| Media assets | avatars, generated media | `avatars` + storage buckets | Media rendering and reuse | Account lifetime + retention policy |

## Processing purposes
- Provide core Service functionality (content creation, scheduling, automation).
- Security, fraud prevention, and auditing.
- Billing and subscription management.
- Customer support and communications.
- Product analytics (opt-in).

## Data sharing / subprocessors
- **Supabase:** database + auth hosting.
- **Railway:** app hosting.
- **Upload-Post:** social distribution API.
- **HeyGen:** video generation API.
- **OpenAI:** AI content generation.
- **WayForPay:** payment processing.
- **Google Analytics:** optional analytics (opt-in).
- **Meta Pixel:** marketing analytics (opt-in).
- **Supabase (Auth email delivery):** transactional email.

## International transfers
- Where personal data is transferred outside the EEA/UK, we rely on an adequacy decision where available (for example, the EU–US Data Privacy Framework where applicable) and/or Standard Contractual Clauses, plus supplementary measures as needed.

## Notes
- OAuth tokens are encrypted at rest (requires `OAUTH_TOKEN_ENCRYPTION_KEY`).
- Non-essential cookies are blocked until opt-in.
