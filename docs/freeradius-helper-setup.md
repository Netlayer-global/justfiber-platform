# FreeRADIUS Helper Setup

Use this when the admin API cannot directly read or write:

- `/etc/freeradius/3.0/clients.conf`
- `/var/log/freeradius/radacct`

## Files

Copy these files to the server:

- `deploy/freeradius/justfiber-freeradius-sync`
- `deploy/freeradius/justfiber-freeradius-auth-telemetry`
- `deploy/freeradius/justfiber-freeradius.sudoers`

## Install

```bash
install -m 0755 deploy/freeradius/justfiber-freeradius-sync /usr/local/bin/justfiber-freeradius-sync
install -m 0755 deploy/freeradius/justfiber-freeradius-auth-telemetry /usr/local/bin/justfiber-freeradius-auth-telemetry
install -m 0440 deploy/freeradius/justfiber-freeradius.sudoers /etc/sudoers.d/justfiber-freeradius
visudo -cf /etc/sudoers.d/justfiber-freeradius
```

## Environment

Set these env vars for `netlayer-admin-api.service`:

```bash
FREERADIUS_SYNC_HELPER_COMMAND="sudo /usr/local/bin/justfiber-freeradius-sync"
FREERADIUS_AUTH_TELEMETRY_HELPER_COMMAND="sudo /usr/local/bin/justfiber-freeradius-auth-telemetry"
```

Optional:

```bash
FREERADIUS_CLIENTS_FILE="/etc/freeradius/3.0/clients.conf"
FREERADIUS_VALIDATE_COMMAND="freeradius -XC"
FREERADIUS_RELOAD_COMMAND="systemctl reload freeradius"
FREERADIUS_AUTH_DETAIL_DIR="/var/log/freeradius/radacct"
```

Then restart the API:

```bash
systemctl restart netlayer-admin-api.service
```

## Result

After this, admin can:

- sync FreeRADIUS managed client blocks
- validate and reload FreeRADIUS
- read recent auth telemetry
- trust a live NAS source IP from the routers page
