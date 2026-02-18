# Netlify + Neon setup

## 1) Create Neon DB schema
Run SQL from `/Users/illyaborodkin/PycharmProjects/PythonProject/snake-neon-field/neon-schema.sql` in your Neon SQL editor.

## 2) Netlify environment variables
Set in Netlify site settings:

- `DATABASE_URL` = Neon connection string (Postgres URI)
- `AUTH_JWT_SECRET` = long random secret string
- `RESEND_API_KEY` = API key from Resend (for email codes)
- `AUTH_EMAIL_FROM` = verified sender email in Resend (for example `Snake Neon <noreply@yourdomain.com>`)

Fallbacks also supported by code:
- `NETLIFY_DATABASE_URL`
- `NETLIFY_AUTH_JWT_SECRET`

## 3) Deploy

This repo now includes:

- `netlify.toml` (functions + `/api/*` redirect)
- `package.json` with dependency `pg`
- Netlify functions in `netlify/functions/*`

Endpoints:

- `POST /api/auth-register`
- `POST /api/auth-login`
- `POST /api/auth-update-nickname`
- `POST /api/auth-send-code`
- `POST /api/auth-verify-code`
- `POST /api/auth-reset-password`
- `GET /api/auth-me`
- `GET /api/progress-get`
- `POST /api/progress-save`

## 4) Game behavior

- Login/register block is on the main screen.
- Registration requires nickname.
- Login supports both email and nickname.
- If cloud progress exists, it is loaded.
- If cloud is empty (new account), current local progress is uploaded to cloud.
- Progress autosync runs after game over and when tab is hidden.
