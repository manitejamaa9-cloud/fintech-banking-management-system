<<<<<<< HEAD
# FinTech Bank - Banking Analytics Dashboard

A full-stack demo of a retail bank back office: customers, accounts, loans, EMI
collections, transactions, branches, schemes, alerts, financial reports, and
forecasting. The data is synthetic and generated relative to the day you seed
it.

This project is for learning and demonstration. It is not a production banking
system.

## What is included

- **Dashboard** - revenue, expenses, net profit, margin, growth, EMI collection,
  new customers, branch performance, recent transactions, and alerts.
- **Analytics** - profit and loss, revenue/expense mix, loan portfolio, customer
  growth, payment methods, EMI forecast (linear regression).
- **Customers** - search, filter, paginate, open a customer profile with
  accounts, loans, transactions, and EMI history.
- **Loans** - filter by status/type/branch, open a loan with repayment schedule
  and payment history.
- **Transactions** - search and filter by type, status, branch, and date.
- **Branches** - deposits, advances, customers, revenue, and branch comparison.
- **Schemes** - savings/loan schemes, enrollment counts, amount collected.
- **Alerts** - low liquidity, overdue EMIs, high-value/failed transactions,
  branch loss.
- **Reports** - CSV, PDF, and printable HTML for P&L, monthly, quarterly,
  annual, loan, EMI, transaction, branch, and scheme reports.
- **Administration** - user list, create users, change role/status (super admin
  only).
- **Role-based access** - super admin, bank manager (branch-scoped), financial
  officer, viewer.
- **CSV staging import** - validate an external transaction file into staging
  tables without touching the synthetic data.

## Technology

| Layer    | Stack |
| -------- | ----- |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, Recharts, React Router 6, Axios |
| Backend  | Node.js 18+, Express 4, PostgreSQL (`pg`), JWT, bcryptjs, pdfkit |
| Data     | PostgreSQL 15+ (18 tested), deterministic synthetic seed |
| Tests    | Node built-in test runner (33 backend tests) |

## Prerequisites

1. **Node.js 18 or newer** - https://nodejs.org
2. **PostgreSQL 15 or newer**, installed and running.
   - On Windows the default service is usually `postgresql-x64-18`.
   - You need the password for the `postgres` user.
   - You do **not** need `psql` on your PATH; the app connects with the `pg`
     driver and creates the database itself.

## Quick start (Windows)

1. Make sure the PostgreSQL service is running.
2. Double-click **`setup.bat`**.
   - Enter the PostgreSQL password when asked.
   - It creates `server\.env`, installs dependencies, creates the
     `fintech_banking` database, loads the demo data, and runs the tests.
3. Double-click **`start.bat`**.
   - Opens two server windows and your browser at http://localhost:5173
4. Log in with:

   | Role | Employee ID | Password |
   | ---- | ----------- | -------- |
   | Super admin | `SUPER001` | `Admin@123` |
   | Bank manager | `BM1001` .. `BM1008` | `Manager@123` |
   | Financial officer | `FIN001` | `Finance@123` |
   | Viewer | `VIEW001` | `View@123` |

To check your machine at any time, double-click **`check-environment.bat`**.
It verifies Node, npm, `server\.env`, PostgreSQL connectivity, table counts,
and ports.

## Manual setup (Windows, macOS, Linux)

```bash
# 1. Install dependencies
npm install

# 2. Create server/.env
cp .env.example server/.env
#    Edit server/.env and set PGPASSWORD (and JWT_SECRET if you wish).

# 3. Create the database, schema, and demo data
npm run db:init

# 4. Start the API and web app in one terminal
npm run dev
```

Open http://localhost:5173. The API runs at http://localhost:5000.

On Windows PowerShell use `Copy-Item .env.example server\.env` instead of `cp`.

### Optional: PostgreSQL with Docker

If Docker is installed and port 5432 is free:

```bash
docker compose up -d
```

Then set `PGPASSWORD=postgres` in `server\.env` and run `npm run db:init`.

## Configuration

The server always reads `server/.env` (not the root folder). Copy
`.env.example` to `server/.env`.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | Runtime mode |
| `JWT_SECRET` | none (required) | Signing secret, at least 16 characters |
| `JWT_EXPIRES` | `8h` | Token lifetime |
| `AUTO_SEED` | `true` | Seed only when the database is completely empty |
| `DEMO_OTP` | `123456` | Demo one-time password used by the optional login challenge |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Extra allowed CORS origin |
| `PGHOST` | `localhost` | PostgreSQL host |
| `PGPORT` | `5432` | PostgreSQL port |
| `PGDATABASE` | `fintech_banking` | Database name |
| `PGUSER` | `postgres` | Database user |
| `PGPASSWORD` | empty | Database password |
| `DATABASE_URL` | empty | Optional connection string instead of `PG*` |

Frontend: `client/.env.example` documents `VITE_API_BASE_URL`. Leave it unset
to use the Vite proxy (`/api` -> `http://localhost:5000`).

There is **no in-memory database fallback**. PostgreSQL must be reachable.

## Commands

Run from the project root:

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Start API and web app together |
| `npm run dev:server` | Start only the API with `--watch` |
| `npm run dev:client` | Start only Vite |
| `npm run db:init` | Create the database/schema and seed if empty |
| `npm run db:create` | Create schema without seeding |
| `npm run db:status` | Show connection and row counts |
| `npm run seed` | Seed only when empty |
| `npm run seed:force` | **Delete all data** in the demo tables, then reseed |
| `npm run data:repair` | Recalculate demo depositor interest rows |
| `npm run import:csv -- --file <path>` | Validate a CSV into staging tables |
| `npm run import:csv -- --dry-run` | Validate without writing |
| `npm run test` | Backend tests (33) |
| `npm run typecheck` | TypeScript check for the frontend |
| `npm run check` | Typecheck plus backend tests |
| `npm run build` | Production build into `client/dist` |
| `npm run preview` | Preview the built frontend |
| `npm run start` | Start only the API (no Vite) |

**Warning:** `seed:force` and `db:force` delete every row in the seeded tables
(branches, users, customers, accounts, loans, payments, transactions, revenue,
expenses, schemes, enrollments). Do not use them on data you want to keep.

## Demo data

- Around 6 years of monthly revenue/expenses, 90 loans, 64 customers, 77
  accounts, 1,200 transactions, and 5,000+ finance rows.
- The generator is deterministic for a given date. If the demo looks stale
  (for example, no current-month EMI), run `npm run seed:force` to regenerate
  it relative to today.
- Fraud alerts on transactions are **simulated** by demo rules
  (`Failed`/`Reversed` and amount >= 100,000). They are not a fraud model.
- Scheme enrollment amounts are reported separately and are not mixed into
  revenue.
- Forecasts need at least 3 months of history and are linear projections, not
  guarantees.

## Analytics conventions

- **Net profit** = revenue - expenses. **Margin** is `null` (shown as n/a) when
  revenue is zero or negative.
- **Growth** is `null` when the previous period is missing or non-positive,
  because growth from zero is misleading.
- **Loan interest income** uses the interest portion of EMI payments. Principal
  repayment is not counted as profit.
- **Current-month EMI collection rate** compares EMI paid this month on
  active/overdue loans with the monthly EMI book of those loans.
- **Periods**: `1w`, `1m`, `3m`, `6m`, `1y`, `2y` .. `6y`, `custom`, `all`.
  Older keys (`7d`, `30d`, `90d`, `180d`, `365d`) are still accepted.
- **Buckets** for charts are chosen from the period length (daily, weekly,
  monthly, quarterly, yearly).

## CSV import

The import is staging-only; it never inserts into the live `transactions` table.

1. Put the file at `data/indian_banking_transactions.csv` or pass a path:
   `npm run import:csv -- --file "C:\path\file.csv"`.
2. Use `data/sample_import_template.csv` as the format reference.
3. Required headers are matched flexibly (for example `transaction_id`,
   `transaction_date`, `amount`, `transaction_type`, `merchant`,
   `merchant_category`, `status`, `fraud_flag`).
4. Preview first with `--dry-run`.

Results go to `import_batches` and `import_transactions_staging`. Empty files
are recorded as an `empty` batch instead of failing.

## API overview

All endpoints are under `/api`. Send `Authorization: Bearer <token>`.

| Area | Endpoints |
| ---- | --------- |
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `GET /auth/branches` |
| Dashboard | `GET /dashboard/overview`, `/dashboard/profit-performance`, `/dashboard/periods` |
| Analytics | `GET /analytics/pnl`, `/revenue-breakdown`, `/expense-breakdown`, `/loans`, `/payment-methods`, `/customers`, `/loan-types`, `/forecast` |
| Customers | `GET /customers`, `GET /customers/:id` |
| Accounts | `GET /accounts` |
| Loans | `GET /loans`, `GET /loans/:id` |
| Transactions | `GET /transactions` |
| Branches | `GET /branches`, `GET /branches/analytics` |
| Schemes | `GET /schemes`, `GET /schemes/:id` |
| Alerts | `GET /alerts` |
| Reports | `GET /reports?type=...&format=csv|pdf|print`, `GET /reports/types` |
| Administration | `GET/POST /settings/users`, `PATCH /settings/users/:id/role|status`, `GET /settings/summary` |

## Project structure

```
FinTech_Banking/
  setup.bat, start.bat, check-environment.bat
  scripts/                 PowerShell helpers used by the .bat files
  server/
    config.js              env loading and validation
    index.js               Express app
    db/                    schema, seed, connection
    middleware/            JWT auth and role checks
    routes/                dashboard, analytics, loans, reports, ...
    scripts/               db-init, seed CLI, CSV import, repair, db-status
    tests/                 node:test suites
    utils/                 dates, finance, forecast, CSV, categories
  client/src/
    pages/                 Login, Dashboard, Analytics, Loans, ...
    components/            Layout, PeriodFilter, charts, UI primitives
    context/               Auth and reporting period
    lib/                   API client, formatting, period helpers
  data/                    CSV import template
```

## Troubleshooting

**`JWT_SECRET is missing or too short`**
Run `setup.bat`, or set a 16+ character secret in `server\.env`.

**`password authentication failed` (`28P01`)**
The PostgreSQL password in `server\.env` is wrong. Run `setup.bat` again and
enter the correct password.

**`database "fintech_banking" does not exist` (`3D000`)**
Run `npm run db:init`. It creates the database when the user has permission.

**`ECONNREFUSED` on port 5432**
Start PostgreSQL:
`Get-Service postgresql* | Start-Service` (PowerShell as administrator).

**Port 5000 or 5173 already in use**
Stop the old process or change `PORT` in `server\.env`. Vite automatically
chooses another port if 5173 is busy, but the browser URL changes.

**Login works but pages are empty**
Run `npm run db:status`. If the tables have 0 rows, run `npm run db:init`.

**Windows shows "running scripts is disabled"**
The `.bat` files already use `-ExecutionPolicy Bypass`. If running PowerShell
manually, use:
`powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-environment.ps1`

**Reset the demo after experimenting**
```bash
npm run seed:force
```
This erases the seeded tables and regenerates them. See the warning above.

## Security notes

- Demo credentials and a demo OTP are intentionally public. Change them before
  any shared deployment.
- JWTs are stored in browser `localStorage`; use httpOnly cookies and HTTPS for
  production.
- The default JWT secret is for local development only.
- Fraud flags are simulated and must not be treated as a real detection system.
- Never commit `server\.env`; it is ignored by git.
=======
# fintech-banking-management-system
Smart Banking Management and Financial Analytics System
>>>>>>> 872941d3fe2a0b7478436df16c4cc2bfe0d29593
