# VETS VAN

## Admin CMS setup

The project now includes a Node/Express API, PostgreSQL persistence and a protected admin portal at `/admin`.

### Environment variables

- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — long random secret used for admin sessions
- `ADMIN_NAME` — first super-admin display name
- `ADMIN_EMAIL` — first super-admin login email
- `ADMIN_PASSWORD` — first super-admin password

On first startup, if the database has no admin and all three `ADMIN_*` variables are present, the server creates the initial super-admin automatically.

### Render

`render.yaml` provisions the Node web service and PostgreSQL database. Set the three admin variables when creating/updating the Render service. Do not commit real passwords or secrets.

### API

- `POST /api/auth/login`
- `GET /api/health`
- `GET /api/dashboard` (admin)
- `GET /api/bookings` (admin)
- `POST /api/bookings` (public booking endpoint)
- `PATCH /api/bookings/:id` (admin)
- `GET /api/services` (public)
- `GET/POST/PATCH/DELETE /api/admin/services...` (admin)
- `GET /api/content` (public)
- `PUT /api/admin/content/:key` (admin)
- `POST /api/messages` (public contact endpoint)
- `GET /api/admin/messages` (admin)
- `GET/PUT /api/admin/settings...` (admin)

## Important

The current public website remains visually unchanged. The backend is additive and the admin dashboard uses the new API. The final migration step is to replace the existing static booking/contact handlers with calls to the public `/api/bookings` and `/api/messages` endpoints, then move editable public content to `/api/content`.
