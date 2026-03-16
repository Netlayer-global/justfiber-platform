# Live Deployment

This project can be deployed with the live API domain:

- API domain: `api.justfiber.in`
- Server IP: `103.139.191.114`

## Recommended Environment

Use these values in the production `.env` on the Ubuntu server:

```env
NODE_ENV=production
PORT=4000

ADMIN_CORS_ORIGIN=http://localhost:3000,https://admin.justfiber.in,https://noc.justfiber.in,https://sales.justfiber.in,https://user.justfiber.in,https://api.justfiber.in,http://103.139.191.114:4000,https://103.139.191.114

ADMIN_DOMAIN=admin.justfiber.in
NOC_DOMAIN=noc.justfiber.in
SALES_DOMAIN=sales.justfiber.in
USER_DOMAIN=user.justfiber.in
API_DOMAIN=api.justfiber.in
ACS_DOMAIN=acs.justfiber.net
```

Keep your existing real values for:

- `MONGODB_URI`
- `REDIS_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JAZE_API_BASE_URL`
- `JAZE_API_USERNAME`
- `JAZE_API_KEY`
- `JAZE_ACCOUNT_ID`
- `GENIEACS_URL`
- `GENIEACS_USERNAME`
- `GENIEACS_PASSWORD`

## Runtime Behavior

With the above config:

- `https://admin.justfiber.in` serves admin panel
- `https://noc.justfiber.in` serves NOC/admin panel
- `https://sales.justfiber.in` serves sales panel
- `https://user.justfiber.in` serves user panel
- `https://api.justfiber.in/` returns API service JSON instead of redirecting to admin
- `https://api.justfiber.in/health/live` returns live status

## Reverse Proxy

Recommended Nginx upstream target:

- `127.0.0.1:4000`

Example proxy target:

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Deploy Steps

```bash
cd /opt/justfiber-platform
git pull origin main
npm install
npm run ui:admin:build
systemctl restart netlayer-admin-api
systemctl restart netlayer-admin-worker
systemctl status netlayer-admin-api --no-pager
systemctl status netlayer-admin-worker --no-pager
```

## Verify

```bash
curl https://api.justfiber.in/health/live
curl https://api.justfiber.in/health/ready
curl https://api.justfiber.in/
```

Expected API root response:

```json
{
  "success": true,
  "data": {
    "service": "justfiber-api",
    "domain": "api.justfiber.in",
    "health": "/health/live",
    "versionPrefix": "/api/v1"
  }
}
```
