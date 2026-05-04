# seed-capital

Идемпотентные seed-фазы для контракта CAPITAL. Используются документационным
harness'ом (`components/docs-harness/bin/shoot.mjs`, ключ `meta.prepare`) для
автоматического дохода до конкретной точки UI без ручного клика по браузеру.

## Запуск

```bash
# одну фазу
pnpm --filter @coopenomics/boot exec esno src/scripts/seed-capital/index.ts 01-programs

# все по порядку
pnpm --filter @coopenomics/boot exec esno src/scripts/seed-capital/index.ts all
```

## Фазы

| ID                    | Что делает                                                                  | Зависит от |
| --------------------- | --------------------------------------------------------------------------- | ---------- |
| `01-programs`         | Программы УХД (id=3) + Благорост (id=4) + `capital::setconfig`              | `boot:extra` (председатель + совет) |
| `02-extension-config` | Запись `extensions.capital` в postgres со всеми `*_done=true` (dev-shortcut). Без неё controller отдаёт 500 «Конфигурация расширения capital не найдена», и UI редиректит на страницу адаптации | работающий postgres |
| `03-projects`         | 12 проектов и 30 компонентов из `_blago/INDEX.md`                           | `01-programs` |
| `04-contributor`      | Регистрация председателя `ant` как Contributor (программно через `Capital.GenerateCapitalRegistrationDocuments` + `CompleteCapitalRegistration`). Без неё UI после адаптации показывает заглушку «Ранним участникам» и не пускает в Мастерскую | `02-extension-config`, controller :2998 |

`phases/02b-real-onboarding.ts` — зарезервированная фаза для будущей задачи: реально провести 5 решений совета через SDK (vote ×3 → authorize → exec). Не подключена к диспетчеру; нужна только когда будем документировать сам процесс адаптации в UI.

Будущие фазы (`02-participants`, `04-agreements`, `05-contributions`,
`06-investments`, `07-result`) добавляются по мере появления сценариев в harness.

## Идемпотентность

Каждая фаза перед действием читает цепочку (`getCoopProgramWallet`,
`getProject`, `state`-таблица CAPITAL). Если запись уже есть — пропускает.
Так что повторный прогон без `reboot:extra` — no-op.

## Соглашения

- **Хеши проектов детерминированные** — `sha256("blago:project:<id>")`. Это
  гарантирует одинаковые скриншоты между прогонами без `--reboot`.
- **Названия — человеческие**, из `components/blago-cli/_blago/INDEX.md`.
  Никаких `Project N` / `Test Project`.
- **Источник параметров программ и `setconfig`** — `src/tests/capital.test.ts`
  (строки 140–288). Если меняется тест — синхронизируй сюда.

## Откуда берутся проекты

Список захардкожен в `data/projects.ts` ровно по индексу
`components/blago-cli/_blago/INDEX.md`. Когда там появляются новые проекты —
добавь вручную (автоматического импорта нет специально, чтобы рантайм скрипта
не зависел от парсинга чужого markdown).
