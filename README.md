# HAWT! — Full-Stack E-Commerce Platform

A production-style e-commerce application for an apparel brand — built from the ground up with a layered Node.js/Express + PostgreSQL backend, a hand-rolled vanilla-JS storefront with its own design system, and an admin portal for catalog and inventory management.

> Storefront, cart & checkout, JWT auth, wishlist, coupons, a payment-webhook pipeline with reliable event delivery, background workers, and a full admin dashboard — all backed by versioned database migrations and structured logging.

---

## Live Demo

- **Live Site:** https://hawt-di32.onrender.com/index.html
- **Admin Portal:** https://hawt-di32.onrender.com/admin.html

> Note: hosted on a free Render instance — the first request after idle may take ~30s to spin up.
> The admin portal is login-protected and not publicly accessible, so the screenshots below show the admin experience.

### Admin Portal Preview

| Product Management Dashboard | Add / Edit Product |
|:---:|:---:|
| ![Admin products dashboard](docs/admin-products.png) | ![Add product drawer](docs/admin-add-product.png) |

---

## Table of Contents
- [Live Demo](#live-demo)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [API Overview](#api-overview)
- [Database](#database)
- [Deployment](#deployment)

---

## Features

### Storefront
- **Product catalog** with categories, filtering, "New In", "Sale" and "Clearance" merchandising flags
- **Product detail pages** with image gallery and a canonical size ladder (XS → XXL)
- **Cart** with server-persisted line items and live pricing
- **Checkout** with coupon support and idempotent order creation (retries supersede the open pending order instead of creating duplicates)
- **Wishlist** persisted per user, with heart toggles on tiles and PDP
- **Auth** — register / login with hashed passwords and JWT sessions; password-reset tokens
- **Order history** with dynamic delivery estimation
- **Fully responsive** — mobile-first layout that adapts across mobile, tablet and desktop breakpoints, with a dedicated mobile navigation

### Admin Portal
- Create / edit / delete products with image upload
- Toggle merchandising flags (New In · Sale · Clearance) with **mutually-exclusive business rules** (e.g. a New-In product can't be Clearance)
- Discounting with live sale-price preview
- Inventory and order visibility

---

## Tech Stack

**Backend**
- **Node.js + Express** — REST API and static file serving
- **PostgreSQL** with **`node-pg-migrate`** for versioned schema migrations
- **JWT** (`jsonwebtoken`) + **`bcrypt`** for auth
- **`helmet`**, **`cors`**, **`express-rate-limit`** for security hardening
- **`pino` / `pino-http`** for structured request logging
- **`multer`** for product-image uploads

**Frontend**
- Vanilla **HTML / CSS / JavaScript** (no framework) with a custom design system (`hawt-kit.css`)

---

## Architecture

The backend follows a **layered architecture** with clear separation of concerns:

```
Route  →  Controller  →  Service  →  Repository  →  Database
                │             │
          (HTTP/validation)  (business logic)
```

- **Routes** (`backend/routes/`) — endpoint definitions and middleware wiring
- **Controllers** (`backend/controllers/`) — request/response handling
- **Services** (`backend/services/`) — business logic (pricing, inventory, orders, payments, webhooks)
- **Repositories** (`backend/repositories/`) — data access, isolated from business logic
- **Middleware** (`backend/middleware/`) — auth, admin guard, optional auth, UUID validation
- **Workers** (`backend/workers/`) — background jobs:
  - `outboxWorker` — implements the **transactional outbox pattern** so payment/order events are delivered reliably even across failures
  - `staleOrderWorker` — releases stock and coupons from abandoned pending orders

This keeps payment and inventory flows correct under retries and partial failures — a deliberate design choice over a simpler all-in-routes approach.

---

## Project Structure

```
.
├── backend/
│   ├── controllers/      # request handlers (cart, checkout, wishlist, webhooks)
│   ├── services/         # business logic (pricing, inventory, orders, payments)
│   ├── repositories/     # data-access layer
│   ├── middleware/       # auth, requireAdmin, optionalAuth, validateUUID
│   ├── routes/           # express routers per resource
│   ├── workers/          # outbox + stale-order background jobs
│   ├── utils/            # logger, errors, db query helpers
│   └── server.js         # app entry point
├── db/
│   ├── migrations/       # versioned, dated SQL/JS migrations
│   ├── schema.sql
│   └── seed.js / seed.sql
├── frontend/
│   ├── css/hawt-kit.css  # design system
│   ├── js/               # storefront scripts
│   └── *.html            # storefront + admin pages
├── images/               # product imagery
├── .env.example
└── package.json
```

---

## Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **PostgreSQL** ≥ 13

### 1. Clone & install
```bash
git clone https://github.com/mohtaharshit6/hawt.git
cd hawt
npm install
```

### 2. Configure environment
Copy the example file and fill in your values:
```bash
cp .env.example .env
```
```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/hawt
JWT_SECRET=change-this-to-a-long-random-string
PORT=3000
```

### 3. Set up the database
```bash
npm run db:migrate     # apply schema migrations
npm run db:seed        # load sample products
```

### 4. Run
```bash
npm run dev            # auto-reload (node --watch)
# or
npm start
```
The app serves both the API and the storefront at **http://localhost:3000**.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm start` | Start the server |
| `npm run dev` | Start with auto-reload (`node --watch`) |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:rollback` | Roll back the last migration |
| `npm run db:seed` | Seed the database with sample data |
| `npm run db:migrate:create` | Scaffold a new migration |

---

## API Overview

| Resource | Base path | Notes |
|---|---|---|
| Products | `/api/products` | catalog, filtering by category/flags |
| Auth | `/api/auth` | register, login, password reset (JWT) |
| Cart | `/api/cart` | server-persisted cart |
| Checkout | `/api/checkout` | coupon validation, order creation |
| Orders | `/api/orders` | order history, delivery estimation |
| Wishlist | `/api/wishlist` | per-user wishlist |
| Webhooks | `/api/webhooks` | payment-gateway callbacks (outbox-backed) |
| Admin | `/api/admin` | product/inventory management (admin-only) |

---

## Database

- Schema is managed entirely through **versioned migrations** in `db/migrations/` (dated filenames, applied via `node-pg-migrate`) — no manual schema edits.
- `db/seed.js` populates a realistic product catalog for local development.
- Performance indexes and an event **outbox** table are part of the migration history.

---

## Deployment

The app is deployment-ready for platforms like **Render**:
- `npm start` as the start command
- `DATABASE_URL`, `JWT_SECRET`, and `PORT` set as environment variables
- SSL enabled for managed PostgreSQL (e.g. Neon) in production
- `trust proxy` configured for reverse-proxy / CDN setups

---

## Author

**Harshit Mohta** · [github.com/mohtaharshit6](https://github.com/mohtaharshit6)
