# Subprocessors (Internal)

> **Internal use only.** Keep this in sync with SUBPROCESSORS_PUBLIC.md.

| Subprocessor | Purpose | Data types | Location | Contract/DPAs |
| --- | --- | --- | --- | --- |
| Supabase | Database/Auth | Account data, content data | [REGION] | [LINK] |
| Railway | Hosting | App logs, metadata | [REGION] | [LINK] |
| Upload-Post | Social publishing | Social account IDs, post metadata | [REGION] | [LINK] |
| HeyGen | Video generation | Script/video metadata | [REGION] | [LINK] |
| OpenAI | AI processing | Prompts and scripts | [REGION] | [LINK] |
| WayForPay | Payments | Transaction metadata | [REGION] | [LINK] |
| [Analytics vendor] | Analytics | Usage events (opt-in) | [REGION] | [LINK] |
| [Email vendor] | Transactional emails | Email addresses | [REGION] | [LINK] |

## Change management
- Add new vendors here first.
- Update public list and notify customers where required.
