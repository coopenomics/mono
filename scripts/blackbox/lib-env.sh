# Общие помощники стендов CI (stack.sh, billing-e2e.sh).

# Заменяет значение ключа в .env-файле или дописывает ключ, если его нет.
set_env() {
  local file="$1" key="$2" value="$3"
  KEY="$key" VALUE="$value" awk -v k="$key" '
    BEGIN { FS = OFS = "=" ; done = 0 }
    $1 == k { print k "=" ENVIRON["VALUE"]; done = 1; next }
    { print }
    END { if (!done) print k "=" ENVIRON["VALUE"] }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}
