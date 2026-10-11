# TableFlow — Full Restaurant Automation Platform

A production-oriented multi-tenant restaurant ordering and operations platform based on the supplied Restaurant Automation Platform roadmap.

## What is included

- Multi-tenant restaurant accounts
- Role-based staff authentication
- Signed table QR payloads using HMAC
- Table sessions shared by multiple diners
- Live menu with server-side availability checks
- Cart → order → payment-pending flow
- Razorpay adapter + safe mock-payment mode
- Signed/idempotent payment webhook handling
- Payment reconciliation worker
- KOT generation only after `PAID`
- Station routing: grill / tandoor / beverages / dessert
- Kitchen ticket state machine: QUEUED → IN_PROGRESS → READY → SERVED
- Delay detection and priority scoring
- Real-time Socket.IO events
- Owner dashboard KPIs
- Menu/table/staff management APIs
- Audit log
- Health endpoint
- Docker Compose for PostgreSQL + app services
- Seed script with a demo restaurant, staff account, tables and menu

## Important

This is a real application foundation, not the previous HTML-only demo. It is intentionally delivered with `PAYMENT_MODE=mock` by default so it can be tested without merchant credentials.

Before taking real payments:
1. Configure Razorpay keys.
2. Configure the webhook secret.
3. Set `PAYMENT_MODE=razorpay`.
4. Use HTTPS in production.
5. Review GST/invoicing requirements with the restaurant's accountant/tax adviser.
6. Run payment, refund, duplicate-webhook and reconciliation tests in the gateway sandbox.

The roadmap explicitly requires the server webhook—not the customer's redirect—to be the payment source of truth, and KOT creation must happen only after a verified `PAID` transition. See the supplied roadmap for the full rationale.

## Stack

- Node.js + TypeScript + Express
- PostgreSQL + Prisma
- React + Vite
- Socket.IO
- Razorpay
- qrcode
- Zod
- JWT + bcrypt
- Docker

## Run locally

### 1. Install

Requirements:
- Node.js 20+
- npm 10+
- Docker Desktop (recommended)

From the project root:

```bash
npm install
npm run install:all
```

### 2. Start PostgreSQL

```bash
docker compose up -d db
```

### 3. Configure server

```bash
cp server/.env.example server/.env
```

The default local values work with the included Docker database.

### 4. Migrate and seed

```bash
npm run db:push
npm run db:seed
```

### 5. Start app

```bash
npm run dev
```

Open:
- Customer: http://localhost:5173/t/<QR_PAYLOAD>
- Admin: http://localhost:5173/admin
- Kitchen: http://localhost:5173/kitchen
- API: http://localhost:4000/health

The seed command prints the demo QR URLs and staff credentials.

## Real Razorpay checkout

The server already creates Razorpay Orders and verifies the webhook signature. For a live customer checkout, load Razorpay Checkout on the customer page and pass the returned `gatewayOrderId` plus `RAZORPAY_KEY_ID` to the checkout script. On successful checkout, show a temporary "confirming payment" state. Do not mark the order paid in the browser. The webhook remains the source of truth.

## Production deployment

Build both apps:

```bash
npm run build
npm start
```

Use a managed PostgreSQL database and set:
- `DATABASE_URL`
- `JWT_SECRET`
- `QR_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `APP_URL`
- `PAYMENT_MODE=razorpay`

Serve the Vite build through the Node server or deploy the client separately and point `VITE_API_URL` at the API.

## Architecture

Customer → API → PostgreSQL
Payment gateway → verified webhook → API → PostgreSQL → Socket.IO → Kitchen/Admin

The customer never sends a "paid" command to the kitchen. The kitchen listens for the server-side paid event.

## Demo credentials

Seeded owner:
- email: owner@tableflow.demo
- password: ChangeMe123!

Seeded kitchen:
- email: kitchen@tableflow.demo
- password: ChangeMe123!

Change these credentials before any real deployment.
