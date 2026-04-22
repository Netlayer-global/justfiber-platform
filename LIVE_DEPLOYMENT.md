# Live Deployment

This deployment is domain-first. Mobile apps and admin UI use:

- API domain: `https://api.justfiber.in`
- API upstream: `127.0.0.1:4000`
- Admin web upstream: `127.0.0.1:3002`
- Current live API status: `https://api.justfiber.in/health/live` is working.
- Admin web domains require DNS records before SSL can be issued.

Do not ship mobile or admin builds with a server IP as the API base. If the server IP changes, update DNS for `api.justfiber.in` and the reverse proxy only.

## Production Environment

Use these values in `/opt/justfiber-platform/.env` on the Ubuntu server:

```env
NODE_ENV=production
PORT=4000

ADMIN_CORS_ORIGIN=http://localhost:3001,https://admin.justfiber.in,https://noc.justfiber.in,https://sales.justfiber.in,https://user.justfiber.in,https://api.justfiber.in

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
- `MIKROTIK_BNG_COA_SECRET`
- `RADIUS_SQL_*`

## DNS

Point these DNS records to the current server public IP:

```text
api.justfiber.in    A    <server-public-ip>
admin.justfiber.in  A    <server-public-ip>
noc.justfiber.in    A    <server-public-ip>
sales.justfiber.in  A    <server-public-ip>
user.justfiber.in   A    <server-public-ip>
```

## Reverse Proxy And SSL

Live check on `api.justfiber.in` currently shows Apache on port 80. Use the Apache path if Apache is staying on the server. Use the Nginx path only if Apache is stopped and Nginx owns ports 80/443.

### Apache Path

Enable required modules:

```bash
a2enmod proxy proxy_http headers rewrite ssl
systemctl restart apache2
```

Install the provided Apache config:

```bash
cp deploy/apache/justfiber.conf /etc/apache2/sites-available/justfiber.conf
a2ensite justfiber.conf
apachectl configtest
systemctl reload apache2
```

Issue or renew API SSL:

```bash
certbot --apache -d api.justfiber.in
```

After `admin.justfiber.in`, `noc.justfiber.in`, `sales.justfiber.in`, and `user.justfiber.in` DNS records resolve to the server, issue admin web SSL:

```bash
certbot --apache \
  -d admin.justfiber.in \
  -d noc.justfiber.in \
  -d sales.justfiber.in \
  -d user.justfiber.in
```

If Certbot creates certificates under a different primary folder, update `SSLCertificateFile` and `SSLCertificateKeyFile` in `deploy/apache/justfiber.conf`.

### Nginx Path

Install the provided Nginx config. It routes `api.justfiber.in` to the backend API and admin/user/sales/noc domains to the Next.js admin web service.

```bash
cp deploy/nginx/justfiber.conf /etc/nginx/sites-available/justfiber.conf
ln -sf /etc/nginx/sites-available/justfiber.conf /etc/nginx/sites-enabled/justfiber.conf
nginx -t
systemctl reload nginx
```

Issue or renew SSL:

```bash
certbot --nginx \
  -d api.justfiber.in \
  -d admin.justfiber.in \
  -d noc.justfiber.in \
  -d sales.justfiber.in \
  -d user.justfiber.in
```

If Certbot creates a certificate under a different primary folder, update `ssl_certificate` and `ssl_certificate_key` in `deploy/nginx/justfiber.conf`.

## Deploy Steps

Fast path:

```bash
cd /opt/justfiber-platform
bash deploy/ubuntu/update-live.sh
```

This script does:

- `git pull origin main`
- `npm install`
- `npm install --prefix frontend/admin-basic`
- `npm run ui:admin:build`
- restart `netlayer-admin-api`, `netlayer-admin-worker`, `justfiber-admin-web`
- print active service state, current commit, and API health

Manual path:

```bash
cd /opt/justfiber-platform
git pull origin main
npm install
npm install --prefix frontend/admin-basic
npm run ui:admin:build

cp deploy/systemd/netlayer-admin-api.service /etc/systemd/system/netlayer-admin-api.service
cp deploy/systemd/netlayer-admin-worker.service /etc/systemd/system/netlayer-admin-worker.service
cp deploy/systemd/justfiber-admin-web.service /etc/systemd/system/justfiber-admin-web.service
systemctl daemon-reload
systemctl enable netlayer-admin-api netlayer-admin-worker justfiber-admin-web
systemctl restart netlayer-admin-api netlayer-admin-worker justfiber-admin-web
systemctl status netlayer-admin-api --no-pager
systemctl status netlayer-admin-worker --no-pager
systemctl status justfiber-admin-web --no-pager
```

## Verify

```bash
curl -I https://api.justfiber.in/health/live
curl https://api.justfiber.in/health/live
curl https://api.justfiber.in/health/ready
curl https://api.justfiber.in/
curl -I https://admin.justfiber.in
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
