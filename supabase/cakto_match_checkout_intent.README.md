# Cakto checkout matching

The homologation database has a server-only `cakto_match_checkout_intent(uuid,text,text)` routine. It checks pending checkout intent, expiry, active offer, plan consistency and uniqueness before linking an external subscription to an organization. It does not activate or charge subscriptions.

Before enabling webhook processing, verify the checkout's correlation identifier is reliably echoed by Cakto in a signed/authenticated event. Do not infer organization from payer email, and do not use a test event to grant access.

The routine must be included in a reviewed SQL migration before promoting the feature to production.
