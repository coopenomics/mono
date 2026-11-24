# Оплата по ЮKassa — документация разработчика

Приложение принимает оплату взносов пайщиков через сервис ЮKassa. ЮKassa сообщает кооперативу об оплате, и платёж засчитывается автоматически.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `yookassa` — Оплата по ЮKassa

- Доступность в сети: закрыто для установки во всех сетях.
- Ставится новому кооперативу сразу, выключенным (`defaults` в записи реестра).
- Модуль: `YookassaExtensionModule` — `yookassa/yookassa-extension.module.ts`.
- Своего рабочего стола нет: расширение работает на сервере и в чужих экранах.
- Поля настроек (`Schema` модуля): `client`, `secret`.
- Миграции схемы базы: 0; миграции настроек: 0.
- Обязательные порты: `Logger`, `MessageChannel`, `PaymentNoticeLog`, `Payment`, `PaymentProviderRegistry`.

## Где что лежит

- Сервер: `components/controller/src/extensions/yookassa/`. Подкаталоги: `i18n/`.
- Файлы верхнего уровня: `yookassa-extension.module.ts`, `yookassa.ports.ts`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
