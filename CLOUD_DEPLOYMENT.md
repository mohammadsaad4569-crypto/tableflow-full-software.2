# TableFlow cloud deployment (GitHub + Render)

This project is configured for a demo deployment on Render. You do not need to install Node.js or Docker on your own laptop to build it.

## Before you deploy
- Keep the GitHub repository **private** while preparing it.
- Do not upload `.env` files, real gateway keys, passwords, or production secrets.
- This deployment uses `PAYMENT_MODE=mock`. It is for testing/demo only, not for taking real payments.
- Render free services can sleep when idle; free database availability/retention is limited. Check Render's current plan details before relying on it.

## Deploy from GitHub
1. Create a **private** GitHub repository named `tableflow-full-software`.
2. Upload the *contents* of this project folder to the repository (the `client`, `prisma`, `server` folders, root `package.json`, `render.yaml`, and other root files). Do not upload the ZIP file inside the repository.
3. On Render, choose **New → Blueprint** and connect the GitHub repository.
4. Render should detect `render.yaml`. Review the web service and PostgreSQL database it proposes to create.
5. Apply the Blueprint and wait for the first build/deploy. Review the deploy logs if it fails.
6. Open the `tableflow-demo` service URL and test `/api/health`.

## Seed the demo account
The database schema is pushed when the web service starts. The demo account/menu seed is intentionally not run automatically in production. After deployment, run the seed command once using Render's available shell/one-off command feature if available:
`npm run db:seed`

Demo credentials after seeding:
- Owner: `owner@tableflow.demo`
- Password: `ChangeMe123!`
- Kitchen: `kitchen@tableflow.demo`
- Password: `ChangeMe123!`

Change/remove demo credentials before inviting real users. Never use these demo credentials for a live restaurant.

## Important limitations
- `PAYMENT_MODE=mock` only simulates payment. It does not charge customers.
- Before live use, configure Razorpay credentials and webhook secrets securely in Render environment settings, validate the webhook flow, add refund handling, confirm GST/invoice requirements, and complete security/backups/load testing.
- Treat this as a deployable test foundation, not a production-certified POS/payment system.
