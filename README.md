# Aamee Cellcare Production System

Production-oriented two-branch billing, inventory and service management application for Aamee Cellcare.

## Current implemented core

- Next.js App Router + strict TypeScript + Tailwind CSS
- PostgreSQL + Prisma relational model
- Owner/employee login with hashed passwords and HttpOnly sessions
- 30-minute inactivity session expiry and client warning
- Branch-scoped authorization
- Two real branch definitions provisioned by the bootstrap script
- Shared product/category master
- Product create/edit and variant pricing
- Supplier management
- Purchase receiving with branch stock updates
- Mobile purchase IMEI capture
- Stock movement ledger
- POS sales
- Cash / UPI / Bank Transfer / Bajaj EMI only
- Full-payment enforcement; no Credit and no Card
- IMEI selection for mobile sales
- Bajaj EMI transaction linkage to customer + sale + IMEI
- Invoice numbering per branch
- Printable invoice view
- Customer master
- Customer visits including walk-in sales
- Inventory and low-stock view
- Repair and service foundation
- Owner reporting/transaction foundation

## Business rules

- Branches: Punnamoodu, Thuruthy and Chalacira, Chettipuzha Road.
- Owner: Vishnu Prasad.
- Employees: create later from the owner user-management flow.
- Payments: Cash, UPI, Bank Transfer, Bajaj EMI.
- GST is disabled. Do not add a fabricated GSTIN.
- Return window: 15 days.
- Warranty is defined per product/mobile variant.

## Local setup

1. Create a PostgreSQL database (local Docker/Postgres or a managed PostgreSQL provider).
2. Copy `.env.example` to `.env.local`.
3. Set `DATABASE_URL`, `OWNER_EMAIL`, and a strong `OWNER_PASSWORD` (12+ characters).
4. Install packages:

```bash
npm install
```

5. Generate Prisma client:

```bash
npx prisma generate
```

6. Create/apply the first development migration:

```bash
npx prisma migrate dev --name init
```

7. Create the owner and verify the two branches:

```bash
npm run db:bootstrap-owner
```

8. Start the application:

```bash
npm run dev
```

## Production database

Use a managed PostgreSQL service. The application does not create PostgreSQL automatically. The deployment environment supplies `DATABASE_URL`, Prisma runs the approved migrations, and Next.js connects through Prisma.

For production deployments use:

```bash
npx prisma migrate deploy
npm run build
npm start
```

## Verification before production

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Then test at minimum:

- owner login/logout and 30-minute inactivity expiry
- employee branch isolation
- product CRUD
- purchase -> inventory increment
- mobile purchase -> IMEI creation
- sale -> inventory decrement
- mobile sale -> IMEI becomes SOLD
- Bajaj EMI -> customer + sale + payment + EMI transaction
- invoice numbering independently per branch
- walk-in and named customer visit counting
- return policy and warranty behavior before enabling returns in production
- backup and restore of PostgreSQL

## Phase 3 setup

Phase 3 adds category management, multi-variant products, branch inventory controls, IMEI/serial device stock, and stock transfers. The Prisma schema adds `StockTransferItem.serialDeviceId` for physical mobile-device transfers.

If your development database already contains the Phase 1/2 schema, apply the included SQL migration before generating Prisma Client. You can use:

```powershell
npx prisma migrate deploy
npx prisma generate
```

If this database was originally created with `prisma db push` and has no migration history, do not reset it. Review/apply `prisma/migrations/20260921150000_phase3_serial_transfers/migration.sql` to the existing PostgreSQL database, then run `npx prisma generate`.


## Phase 3 transaction fix
Product and variant creation keep interactive Prisma transactions short. Final read queries run after the transaction to avoid the default 5-second interactive transaction timeout on higher-latency PostgreSQL connections.

## Phase 5 update — Customers & Customer Visits

Included in this build:
- Customer master create/list/search/edit/delete (delete is blocked when transaction/visit history exists)
- Customer contact fields: phone, alternate phone, email, address, notes
- Customer purchase, repair and visit counts
- Customer detail page with purchase/repair/visit history
- Branch-aware customer visit recording
- Employee branch restrictions for customer visit creation/history
- Owner access across both active branches
- Audit logs for customer create/update/delete and customer visit creation
- Purchase transaction timeout hardening retained from Phase 4

The purchase API keeps read/validation work outside the interactive transaction, aggregates inventory writes, uses batch serial creation, and uses a 15-second transaction timeout to avoid the previously observed 5-second remote PostgreSQL transaction expiry.
