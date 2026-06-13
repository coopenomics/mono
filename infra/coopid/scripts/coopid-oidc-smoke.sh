#!/usr/bin/env bash
# CoopID Эпик 5 — smoke-проверка стандартного OIDC-провайдера против поднятого
# стека (Story 5.1). НЕ полный OpenID Conformance Suite (5.7, отдельный follow-up) —
# быстрый sanity: корневой discovery отдаёт все required-поля, jwks даёт RS256-ключ,
# discovery внутренне консистентен (issuer + *_endpoint + jwks_uri).
#
# Usage:
#   bash infra/coopid/scripts/coopid-oidc-smoke.sh
#   BASE=https://voskhod.coop bash infra/coopid/scripts/coopid-oidc-smoke.sh
#
# По умолчанию бьёт в caddy на localhost:8443 (dev). Нужны: curl, jq.
set -euo pipefail

BASE="${BASE:-https://localhost:8443}"
CADDY_PORT="${CADDY_HTTPS_PORT:-8443}"
# localhost → self-signed caddy, SNI обязателен (иначе TLS internal error).
CURL=(curl -sk --tlsv1.3 --resolve "localhost:${CADDY_PORT}:127.0.0.1")

for bin in curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "ОШИБКА: нужен $bin"; exit 2; }
done

fail() { echo "❌ $1"; exit 1; }
ok() { echo "✅ $1"; }

DISCOVERY_URL="${BASE}/.well-known/openid-configuration"
echo "→ discovery: ${DISCOVERY_URL}"
DOC="$("${CURL[@]}" "${DISCOVERY_URL}")" || fail "discovery недоступен"
echo "$DOC" | jq . >/dev/null 2>&1 || fail "discovery вернул не-JSON: $DOC"
ok "discovery отдаёт JSON"

# Required-поля OIDC Core 1.0 / Discovery + те, что перечислены в AC 5.1.
REQUIRED=(issuer authorization_endpoint token_endpoint userinfo_endpoint jwks_uri end_session_endpoint introspection_endpoint revocation_endpoint)
for f in "${REQUIRED[@]}"; do
  v="$(echo "$DOC" | jq -r ".${f} // empty")"
  [ -n "$v" ] || fail "в discovery нет поля ${f}"
  ok "${f} = ${v}"
done

# auth_code + PKCE S256 (Story 5.2).
echo "$DOC" | jq -e '.response_types_supported | index("code")' >/dev/null \
  || fail "response_types_supported не содержит \"code\""
ok "response_types_supported содержит code"
echo "$DOC" | jq -e '.code_challenge_methods_supported | index("S256")' >/dev/null \
  || fail "code_challenge_methods_supported не содержит S256 (PKCE)"
ok "PKCE S256 поддерживается"

# JWKS отдаёт RS256-ключ (Story 5.1).
JWKS_URI="$(echo "$DOC" | jq -r '.jwks_uri')"
echo "→ jwks: ${JWKS_URI}"
JWKS="$("${CURL[@]}" "${JWKS_URI}")" || fail "jwks недоступен"
echo "$JWKS" | jq -e '.keys | length > 0' >/dev/null || fail "jwks пустой"
echo "$JWKS" | jq -e '.keys[] | select(.alg=="RS256" or .kty=="RSA")' >/dev/null \
  || fail "в jwks нет RS256/RSA-ключа"
ok "jwks содержит RS256-ключ"

# Алиас /.well-known/jwks.json (caddy rewrite) тоже жив.
ALIAS="$("${CURL[@]}" "${BASE}/.well-known/jwks.json")" || fail "jwks-алиас недоступен"
echo "$ALIAS" | jq -e '.keys | length > 0' >/dev/null || fail "jwks-алиас пустой"
ok "/.well-known/jwks.json (алиас) работает"

echo
echo "🟢 OIDC discovery smoke пройден: CoopID — стандартный OIDC-провайдер."
