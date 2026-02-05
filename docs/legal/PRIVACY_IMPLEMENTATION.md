# Privacy Implementation Notes

## What was implemented
- EU-style cookie consent banner with categories and opt-in gating.
- Consent logging for authenticated users and local storage for guests.
- Data export endpoint (JSON download).
- Self-serve deletion request flow with confirmation.
- Marketing email opt-out preference.
- Admin audit logging for admin actions.
- Legal docs and data map.

## Policy/version updates
Update the following when legal text changes:
- `VITE_PRIVACY_POLICY_VERSION`
- `VITE_COOKIE_POLICY_VERSION`
- `VITE_CONSENT_BANNER_VERSION`
- `PRIVACY_POLICY_VERSION` (backend)
- `COOKIE_POLICY_VERSION` (backend)

## Environment variables
- `VITE_PRIVACY_POLICY_VERSION`
- `VITE_COOKIE_POLICY_VERSION`
- `VITE_CONSENT_BANNER_VERSION`
- `VITE_PRIVACY_CONTACT_EMAIL`
- `PRIVACY_POLICY_VERSION`
- `COOKIE_POLICY_VERSION`
- `CONSENT_BANNER_VERSION`
- `PRIVACY_CONTACT_EMAIL`
- `DATA_DELETION_GRACE_PERIOD_DAYS`
- `OAUTH_TOKEN_ENCRYPTION_KEY` (base64 32-byte key)
- `VITE_GA_ID` (optional analytics)
- `VITE_META_PIXEL_ID` (optional marketing)

## Database migrations
Apply `031_privacy_compliance.sql` to add consent logs, deletion requests, audit logs, and marketing preferences.
