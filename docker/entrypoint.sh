#!/bin/sh
set -eu

# Render only the API_UPSTREAM placeholder; every real nginx $variable is left
# untouched. Output goes to /tmp so the container filesystem can stay read-only.
: "${API_UPSTREAM:?API_UPSTREAM must be set (e.g. https://backend-nginx:8443)}"
: "${API_HOST_HEADER:=localhost}"

case "$API_UPSTREAM" in
  http://*|https://*) : ;;
  *) echo "API_UPSTREAM must start with http:// or https://" >&2; exit 64 ;;
esac

export API_UPSTREAM API_HOST_HEADER
envsubst '${API_UPSTREAM} ${API_HOST_HEADER}' < /etc/nginx/nginx.conf > /tmp/nginx.conf

exec nginx -c /tmp/nginx.conf -g 'daemon off;'
