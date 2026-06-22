# Gekishin - Tournament Platform

A competitive tournament management platform built with **Next.js**, **PostgreSQL**, and **Prisma**.

## Features

- **Authentication** — Register and login with email/password
- **Bilingual** — English and French (EN/FR) via next-intl
- **Tournaments** — Create solo or team tournaments with multiple formats
- **Teams** — Create teams, invite members by username or email (Brevo)
- **Scoring** — Organizers can manage match scores and standings
- **Role Bans** — Ban players from Tank, Support, or DPS roles per tournament
- **Draft System** — Pick & ban draft with role bans, hero bans, and hero picks
- **Notifications** — In-app notifications for invites, joins, and draft actions
- **Organizer Permissions** — Granular rights for tournament management

## Tech Stack

- Next.js 16 (App Router)
- PostgreSQL + Prisma 7
- NextAuth.js v5 (credentials)
- next-intl (i18n)
- Brevo (transactional emails)
- Tailwind CSS 4

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random secret for NextAuth (generate with `openssl rand -base64 32`)
- `BREVO_API_KEY` — Your Brevo API key for emails
- `BREVO_SENDER_EMAIL` — Verified sender email in Brevo
- `NEXTAUTH_URL` — `http://localhost:3000` for local dev

### 3. Set up the database

```bash
# Start a local Postgres (or use Docker)
# docker run --name gekishin-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=gekishin -p 5432:5432 -d postgres

npx prisma migrate dev --name init
npx prisma db seed   # optional: seed heroes
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── [locale]/          # i18n routes (en, fr)
│   │   ├── tournaments/   # Tournament pages
│   │   ├── teams/           # Team pages
│   │   ├── notifications/   # Notifications
│   │   ├── login/           # Auth
│   │   └── dashboard/       # User dashboard
│   └── api/                 # REST API routes
├── components/              # React components
├── lib/                     # Auth, Prisma, Brevo, validations
├── i18n/                    # Internationalization config
└── generated/prisma/        # Prisma client (generated)
messages/
├── en.json                  # English translations
└── fr.json                  # French translations
prisma/
└── schema.prisma            # Database schema
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register` | Register new user |
| GET/POST | `/api/tournaments` | List/create tournaments |
| GET/PATCH/POST | `/api/tournaments/[id]` | Tournament detail, update, join |
| GET/PATCH/POST | `/api/tournaments/[id]/matches` | Match scores |
| GET/POST/DELETE | `/api/tournaments/[id]/bans` | Role bans |
| GET/POST/PATCH | `/api/tournaments/[id]/draft` | Draft system |
| GET/POST | `/api/teams` | List/create teams |
| POST | `/api/teams/[id]/invite` | Invite member |
| POST | `/api/teams/invite/[token]` | Accept invite |
| GET/PATCH | `/api/notifications` | Notifications |

## License

MIT
