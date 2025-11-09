# SurveiLens Auth0 Integration (Fixed)

## Dashboard
- API Identifier: `https://surveilens/api` (RS256, RBAC enabled, Add permissions in access token)
- SPA app: Allowed Callback/Logout/Web Origins → `http://localhost:5173`
- M2M app: authorized to `https://surveilens/api` with needed permissions

## Backend
- Fill `.env` from `.env.example` (set AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_M2M_CLIENT_ID/SECRET)
- Start API normally (gunicorn/Flask)

## Frontend
- `cd frontend && cp .env.example .env` and set your SPA Client ID
- `npm install && npm run dev`

## MFA step-up
- Use the included `auth0/post_login_action.js` in an Auth0 **Post-Login Action**
- Approve action requires MFA and proper role/permission
