# YouCan integration

The app receives new orders into a separate review inbox; it never transmits a parcel automatically. The Website inbox uses New, Pas de réponse 1–4, Annuler and Confirmer. Confirming a status never creates a parcel. Users select confirmed rows and explicitly send them to Atlas; each row retains its retry-safe local ID. The collaborator picker is hidden; existing member visibility remains restricted to previously assigned orders. Dispatch uses the existing parcel flow, stock authorization, live inventory, phone uniqueness, and a stable local order ID.

Set server-only Railway variables (never commit values):

- YOUCAN_CLIENT_ID: OAuth client ID of the external app.
- YOUCAN_CLIENT_SECRET: same app's OAuth secret; also verifies webhook signatures and encrypts access tokens at rest.
- YOUCAN_STORE_ID: only the intended store's immutable UUID.

App URL and allowed redirect URL: https://fastlivraison.com/api/youcan/callback
Webhook URL: https://fastlivraison.com/api/youcan/webhook

Minimum app scopes: read-orders, read-products, view-store-info, read-rest-hooks, edit-rest-hooks. Do not enable All scopes. After the merchant installs/opens the external app, the callback verifies its HMAC, freshness, one-use code, and the token's store identity. Tokens stay server-side, encrypted. Missing configuration fails closed.

After connecting, the signed callback activates subscriptions for order.created, order.updated, and app.uninstalled. Reopening the signed app launch without a new code reuses the existing encrypted connection and retries these same fixed subscriptions. The API returns existing subscription IDs for duplicate event/address pairs. Admin can also retry activation from Commandes site. Incoming deliveries are verified against their exact raw bytes and store, deduplicated by store/order ID, and hydrated using the authenticated Orders API. Failed hydration keeps the pending row and returns 503 for provider retries. Admin can retry pending hydration. Converted orders never get overwritten by source updates. Uninstallation removes the token and stops accepting new deliveries.

Expired tokens require reopening the app from YouCan; UI reports disconnection. Refresh-token support is not assumed. Historical backfill is not automatic. No live connection is asserted until actual store installation, subscription activation and a real delivery are verified.

Review variant labels and quantities before confirmation. Only exact unique SKU/name matches without non-default variants are preselected. Packs/options that cannot be matched confidently require manual product/quantity selection. Existing confirmed parcel rules apply.

Website order information can be prepared independently of dispatch. Exact unique SKU/name and city matches can be sent directly; variant offers, ambiguous matches or multiple Atlas stores require manual information review. Upstream changes to an untransmitted order clear its prepared details and reset its review status to New. Converted parcel data remains frozen.
