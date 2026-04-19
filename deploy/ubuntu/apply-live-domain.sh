#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/justfiber-platform}"
API_DOMAIN="api.justfiber.in"
ADMIN_DOMAINS=(admin.justfiber.in noc.justfiber.in sales.justfiber.in user.justfiber.in)

cd "$APP_DIR"

echo "[1/8] Installing dependencies"
npm install
npm install --prefix frontend/admin-basic

echo "[2/8] Building admin web"
npm run ui:admin:build

echo "[3/8] Installing systemd services"
cp deploy/systemd/netlayer-admin-api.service /etc/systemd/system/netlayer-admin-api.service
cp deploy/systemd/netlayer-admin-worker.service /etc/systemd/system/netlayer-admin-worker.service
cp deploy/systemd/justfiber-admin-web.service /etc/systemd/system/justfiber-admin-web.service
systemctl daemon-reload
systemctl enable netlayer-admin-api netlayer-admin-worker justfiber-admin-web

echo "[4/8] Restarting app services"
systemctl restart netlayer-admin-api netlayer-admin-worker justfiber-admin-web

echo "[5/8] Configuring Apache reverse proxy"
a2enmod proxy proxy_http headers rewrite ssl
cp deploy/apache/justfiber.conf /etc/apache2/sites-available/justfiber.conf
a2ensite justfiber.conf
apachectl configtest
systemctl reload apache2

echo "[6/8] Issuing/renewing SSL certificate"
if command -v certbot >/dev/null 2>&1; then
  certbot --apache --non-interactive --agree-tos --redirect \
    --register-unsafely-without-email \
    -d "$API_DOMAIN"

  admin_cert_domains=()
  for domain in "${ADMIN_DOMAINS[@]}"; do
    if getent hosts "$domain" >/dev/null 2>&1; then
      admin_cert_domains+=("-d" "$domain")
    else
      echo "Skipping SSL for $domain because DNS does not resolve yet."
    fi
  done

  if [ "${#admin_cert_domains[@]}" -gt 0 ]; then
    certbot --apache --non-interactive --agree-tos --redirect \
      --register-unsafely-without-email \
      "${admin_cert_domains[@]}" || true
  fi
else
  echo "certbot not found. Install it with: apt-get update && apt-get install -y certbot python3-certbot-apache"
fi

echo "[7/8] Reloading Apache"
apachectl configtest
systemctl reload apache2

echo "[8/8] Verifying live API"
curl -fS https://api.justfiber.in/health/live
curl -fS https://api.justfiber.in/

echo "Live domain deployment complete."
