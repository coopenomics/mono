# Робот совета — документация разработчика

Робот совета принимает типовые решения совета за секунды — по тем видам вопросов, которые члены совета заранее разрешили ему решать.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `robot` — Робот совета

- Доступность в сети: везде.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `SovietRobotExtensionModule` — `soviet-robot/soviet-robot-extension.module.ts`.
- Рабочие столы: `robot` («Робот совета»).
- Поля настроек (`Schema` модуля): `max_attempts`, `retry_backoff_sec`, `index_lag_attempts`, `index_lag_pause_ms`.
- Миграции схемы базы: 1; миграции настроек: 0.
- Обязательные порты: `Account`, `Chain`, `DesktopGrantsRegistry`, `Document`, `ExtensionConfig`, `Logger`, `SecretCipher`, `Vault`.
- Необязательные порты: `Notification`, `ChainChanges`.

## Где что лежит

- Сервер: `components/controller/src/extensions/soviet-robot/`. Подкаталоги: `application/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `soviet-robot-extension.module.ts`, `soviet-robot.database-migrations.ts`, `soviet-robot.ports.ts`, `soviet-robot.tables.ts`.
- Стол: `components/desktop/extensions/robot/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `soviet_robot_decisions`, `soviet_robot_keys`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.

## Ключи и прямой вызов

Ключи хранятся зашифрованными ключом кооператива и не попадают в цепь. Контракт `soviet` проверяет, что ключ подписи принадлежит заявленному разрешению аккаунта члена совета и что тип решения делегирован.

### Прямой вызов из других расширений

Стол заказов ставит заявления на повестку (`mktissue` — выдача имущества, `mktretrn` — гарантийный возврат) и держит пайщика у стойки: ему нужен ответ за секунды, а не по тику сторожа. Для этого расширение отдаёт кросс-плагинный порт `SOVIET_ROBOT_PORT` (`@coopenomics/innercoop`): `requestDecision({ coopname, decision_id, decision_type, decision_hash, username })` заводит ту же запись журнала, что и событие новой повестки (второй не бывает), и проводит решение сразу — голоса, затем протокол — не дожидаясь событий парсера. Ответ: `authorized` (протокол в цепи, исход поступит обратным вызовом совета), `pending` (кворума робота нет либо председатель не делегировал протокол — решают люди), `manual` (расширение не установлено или выключено), `failed` (попытки исчерпаны, нужен повтор администратором). Потребитель на `pending` / `manual` / `failed` переходит в спокойное ожидание: пайщик получит уведомление, когда совет решит.
