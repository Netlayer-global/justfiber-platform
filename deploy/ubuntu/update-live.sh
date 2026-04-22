#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/justfiber-platform}"
BRANCH="${BRANCH:-main}"
SERVICES=(
  "netlayer-admin-api"
  "netlayer-admin-worker"
  "justfiber-admin-web"
)

cd "$APP_DIR"

echo "==> Pulling latest code from ${BRANCH}"
git pull origin "$BRANCH"

echo "==> Installing backend dependencies"
npm install

echo "==> Installing admin dependencies"
npm install --prefix frontend/admin-basic

echo "==> Building admin web"
npm run ui:admin:build

echo "==> Restarting services"
sudo systemctl restart "${SERVICES[@]}"

echo "==> Service status"
systemctl is-active "${SERVICES[@]}"

echo "==> Current commit"
git rev-parse --short HEAD

echo "==> API health"
curl -fsS https://api.justfiber.in/health/live
echo
