# AASTU Events Hub

A full-stack university event management platform built for **She Codes AASTU**. Students can discover and register for campus events, while admins manage everything through a dedicated dashboard.

![Stack](https://img.shields.io/badge/Node.js-Express-green?style=flat-square) ![DB](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E?style=flat-square) ![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-purple?style=flat-square)

---

## Features

**Students**
- Browse and search all campus events
- Filter by category, club, or upcoming date
- Register for events in one click
- Personal dashboard to manage registrations and cancel if needed
- Edit profile and change password

**Admins**
- Full event management — create, edit, delete
- Manage clubs and categories
- View all registered users
- Attendee list per event with one-click check-in
- Analytics dashboard with live stats and top events

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL via [Supabase](https://supabase.com) |
| Auth | JWT (JSON Web Tokens) + bcrypt |
| Hosting | [Vercel](https://vercel.com) |

---

## Project Structure

```
├── server.js              # Express API server
├── admin.js               # Admin seed script
├── vercel.json            # Vercel deployment config
├── package.json
├── .env                   # Environment variables (never commit)
├── .gitignore
│
└── frontend/
    ├── index.html         # Landing page
    ├── css/
    │   └── global.css     # All shared styles
    ├── js/
    │   ├── api.js         # All API calls
    │   └── utils.js       # Shared UI utilities
    └── pages/
        ├── events.html    # Browse all events
        ├── event.html     # Single event detail + register
        ├── login.html     # Sign in
        ├── register.html  # Sign up
        ├── dashboard.html # Student dashboard
        └── admin.html     # Admin dashboard
```

---

## Local Setup

### Prerequisites
- [Node.js](https://nodejs.org) v18 or higher
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Clone the repository

```bash
git clone https://github.com/abigiya-abby/Backend_1.git
cd Backend_1
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the root:

```
PORT=5000
DATABASE_URL=your_supabase_connection_string
JWT_SECRET=a_long_random_secret_string
```

Get your `DATABASE_URL` from:
> Supabase Dashboard → Project Settings → Database → Connection string → URI

### 4. Start the development server

```bash
npm run dev
```

The server starts on `http://localhost:5000` and auto-creates all database tables on first run.

### 5. Seed the admin account (run once)

```bash
npm run seed-admin
```

Creates: `admin@aastu.edu.et` / `admin123`

### 6. Open the app

```
http://localhost:5000/frontend/index.html
```

---

## Deploy to Vercel

1. Push your code to GitHub — make sure `.env` is in `.gitignore`
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard:
   - `DATABASE_URL`
   - `JWT_SECRET`
4. Deploy — Vercel picks up `vercel.json` automatically

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register a student |
| POST | `/api/auth/login` | No | Login, returns token |

### Events

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/events` | No | Get all events |
| GET | `/api/events/:id` | No | Get single event |
| POST | `/api/events` | Admin | Create event |
| PUT | `/api/events/:id` | Admin | Update event |
| DELETE | `/api/events/:id` | Admin | Delete event |
| GET | `/api/events/:id/attendees` | Admin | List attendees |

**Query params for GET /api/events:**
`?search=` `?category_id=` `?club_id=` `?upcoming=true`

### Registrations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/registrations` | Student | Register for event |
| GET | `/api/registrations/my` | Student | My registrations |
| PATCH | `/api/registrations/:id/cancel` | Student | Cancel registration |

### Attendance

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/attendance/checkin` | Admin | Check in attendee |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | Admin | All users |
| GET | `/api/users/me` | Student | My profile |
| PUT | `/api/users/me` | Student | Update profile |
| DELETE | `/api/users/:id` | Admin | Delete user |

### Clubs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/clubs` | No | All clubs |
| POST | `/api/clubs` | Admin | Create club |
| PUT | `/api/clubs/:id` | Admin | Update club |
| DELETE | `/api/clubs/:id` | Admin | Delete club |

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories` | No | All categories |
| POST | `/api/categories` | Admin | Create category |
| DELETE | `/api/categories/:id` | Admin | Delete category |

### Admin Analytics

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | Admin | Dashboard stats |

---

## Database Schema

```
users          — id, full_name, email, password, role, department, created_at
clubs          — id, club_name, description, logo, created_at
categories     — id, name
events         — id, title, description, event_date, venue, speaker, image,
                 capacity, club_id, category_id, created_by, created_at
registrations  — id, user_id, event_id, registration_status, registered_at
attendance     — id, registration_id, checked_in, checked_in_at
```

---

## Contributing

This project is part of the **She Codes AASTU** final collaborative project. Contributions from all tracks (UI/UX, Frontend, React, Backend) are welcome.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License — see [LICENSE.md](LICENSE.md) for details.

---

*Built with ❤️ by She Codes AASTU — empowering women in tech.*
