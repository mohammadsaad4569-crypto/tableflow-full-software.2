# Production checklist

This repository is intentionally safe to run in mock payment mode.

Before production:
- Use a managed PostgreSQL database.
- Generate strong random JWT and QR secrets.
- Set HTTPS and a strict CORS origin.
- Configure Razorpay production credentials and webhook secret.
- Configure the gateway webhook URL to `/api/payments/razorpay/webhook`.
- Verify the gateway webhook signature before changing payment state.
- Keep `gatewayPaymentId` unique so duplicate webhooks are idempotent.
- Never trust the customer redirect as payment confirmation.
- Test webhook retries and delayed webhooks.
- Implement the gateway order/payment status lookup in `server/src/payments.ts` for the chosen gateway.
- Add refund and cancellation policies before live billing.
- Configure backups and monitoring for PostgreSQL.
- Add proper GST invoice numbering and tax rules for the restaurant's actual tax setup.
- Add SMS/WhatsApp/push notification provider only after the core payment→KOT path is stable.
- Run load and security testing before serving real traffic.
