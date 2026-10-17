# WhatsApp AI confirmation on Railway

The platform supports official Meta Cloud API messaging for **+212617307262**. A WhatsApp Web login is a browser session, not API credentials. The feature is admin-only and starts in manual mode. No messages are sent unless configured and explicitly enabled.

## Configure the existing number

Use Meta's supported WhatsApp Business App coexistence onboarding if the account is eligible. Do not delete the existing WhatsApp Business account or deregister the number to force onboarding. Complete any account ownership/number verification in Meta. A verified production number, permission to send, and an approved message template are required.

Set these server-side variables in the existing Railway service. Never paste tokens into chat or commit secrets:

| Variable | Value |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Meta system-user access token with WhatsApp messaging permission |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID for +212617307262, not the phone number or WABA ID |
| `WHATSAPP_APP_SECRET` | Secret of the Meta app subscribed to the WABA |
| `WHATSAPP_VERIFY_TOKEN` | Random webhook verification token, also entered in Meta |
| `WHATSAPP_API_VERSION` | A supported Graph API version, in `vNN.0` format |
| `WHATSAPP_TEMPLATE_NAME` | Exact approved template name |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Exact approved template language code |
| `OPENAI_API_KEY` | Server-side OpenAI API project key |
| `OPENAI_MODEL` | Model available to that project supporting Responses API structured outputs |
| `WHATSAPP_SEND_ENABLED` | `false` until Meta configuration and a controlled test are ready; `true` enables UI sending |
| `WHATSAPP_AUTO_REPLY` | `false` initially; `true` permits per-conversation AI activation |

## Template

Submit a utility/order confirmation template to Meta with exactly six positional body text parameters, in this order: customer name, product, quantity, total COD in DH, address, city. For example:

> سلام {{1}}، أنا المساعد الآلي ديال تأكيد الطلبات. الطلب ديالك: {{2}}، الكمية {{3}}، المجموع عند التوصيل {{4}} درهم. العنوان: {{5}}، {{6}}. جاوبنا هنا باش نكملو التأكيد، أو طلب التواصل مع الفريق.

Use the exact approved content and language in production. The platform sends a six-parameter template only once unless Meta explicitly rejects it. No unapproved text is sent as a template.

## Webhook and testing

Register `https://casamalllivraison-production.up.railway.app/api/whatsapp/webhook` as the Meta callback, using the same verify token. Subscribe the app to the WABA and its `messages` events. `https://jeanoma.com/api/whatsapp/webhook` can be used once its normal HTTPS is working. Requests require the exact Meta HMAC-SHA256 signature and configured phone number ID.

1. Open **Confirmation WhatsApp AI** as admin and verify Meta. The provider phone must match +212617307262.
2. Create a test draft with a consenting test recipient; add it to confirmation and record consent. Keep AI paused.
3. Enable sending and send the approved template. A reply opens the 24-hour free-form messaging window. Send the order summary/buttons; confirm with the recipient's button.
4. Check history and delivery webhooks. The WhatsApp confirmation state changes; the order remains a draft until a human transmits it to Atlas.
5. Configure OpenAI, generate and review an AI draft. To enable automatic replies, set `WHATSAPP_AUTO_REPLY=true` and activate the individual conversation. Use manual takeover to pause it.

AI sees a bounded conversation history and only product, quantity, COD amount and city from the order. Its response is validated JSON; it cannot change orders or call Atlas. Change requests and uncertain responses are escalated. Customer confirm/cancel buttons require context from the actual summary sent by this platform and an unchanged order snapshot. Text alone never confirms an order.

Delivery errors/ambiguous send outcomes stop automation. An uncertain provider outcome must be reconciled by an operator rather than automatically resent. The feature does not scrape or automate WhatsApp Web.

## Checks

- `node --test tests/*.test.mjs`
- `pnpm build`
- `python3 tests/whatsapp-http-smoke.py` after a production build (temporary database and generated local credentials; no real messages)

References: Meta Cloud API / Business App coexistence documentation and OpenAI Responses structured outputs documentation. All provider credentials, billing and template approvals remain external to this repository.
