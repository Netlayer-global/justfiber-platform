#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash infra/freeradius/install-ubuntu.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y freeradius freeradius-mysql freeradius-utils mariadb-client
systemctl enable freeradius
systemctl restart freeradius

install -d -m 0755 /etc/freeradius/3.0/mods-config/sql/main/mysql
install -d -m 0755 /etc/freeradius/3.0/policy.d
install -d -m 0755 /opt/justfiber-platform/deploy/freeradius

cat >/opt/justfiber-platform/deploy/freeradius/README.txt <<'EOF'
Next steps:
1. Fill SQL credentials in /etc/freeradius/3.0/mods-available/sql
2. Enable SQL module:
   ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql
3. Add MikroTik NAS clients in /etc/freeradius/3.0/clients.conf
4. Import FreeRADIUS schema into MySQL/MariaDB
5. Restart:
   systemctl restart freeradius
6. Test:
   radtest testuser testpass 127.0.0.1 0 testing123
EOF

echo "FreeRADIUS installed."
echo "Edit /etc/freeradius/3.0/mods-available/sql and /etc/freeradius/3.0/clients.conf next."
