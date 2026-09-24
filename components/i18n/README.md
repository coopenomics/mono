# @coopenomics/i18n

Общая основа интернационализации платформы. Весь текст, который видит
пользователь, живёт в словарях, а код ссылается на него ключами. Язык сейчас
один — русский; второй добавляется файлами словарей рядом с `ru`, без правки
кода.

## Что в пакете

| Модуль | Что делает |
|---|---|
| `locales` | список языков (`SUPPORTED_LOCALES`), язык по умолчанию, выбор языка из `Accept-Language` |
| `plural` | правила множественного числа для vue-i18n: `{n} день \| {n} дня \| {n} дней` |
| `messages` | слияние словарей с запретом повторных ключей, поиск по ключу |
| `translator` | переводчик на ядре vue-i18n (`@intlify/core-base`) для кода без Vue |
| `pseudo` | псевдолокаль `ru-XA` для проверки глазами |
| `format` | числа и суммы по правилам языка (`Intl`) |
| `server` | язык запроса (AsyncLocalStorage), реестр словарей процесса, `t()` |
| `messages/ru/*.json` | общие словари: `common`, `validation`, `errors` |

desktop подключает словари и правила в vue-i18n, controller и уведомления —
через `@coopenomics/i18n/server`. Формат сообщений везде один.

## Формат сообщений

Синтаксис vue-i18n:

| Что | Пример | Вызов |
|---|---|---|
| именованный параметр | `Привет, {name}!` | `t('k', { name })` |
| позиционный параметр | `{0} из {1}` | `t('k', [a, b])` |
| формы по числу | `{n} день \| {n} дня \| {n} дней` | `t('k', n)` |
| форма для нуля | `нет дней \| {n} день \| {n} дня \| {n} дней` | `t('k', n)` |
| ссылка на сообщение | `Итог: @:wallet.balance` | — |
| служебный символ как текст | `почта{'@'}coop.ru` | — |

Символы `{ } @ |` в обычном тексте экранируются литералом: `{'@'}`, `{'{'}`,
`{'|'}`. Гейт `pnpm check:i18n` компилирует каждое сообщение и падает на
ошибке синтаксиса.

## Ключи

Английские, смысловые, от области к элементу, в camelCase:

```
<область>.<сущность или экран>.<элемент>
wallet.deposit.submit
wallet.deposit.amountLabel
capital.issue.status.draft
common.action.save
```

- **Область** — домен FSD-среза (`wallet`, `document`, `registrator`)
  или имя расширения (`capital`, `chairman`). Все ключи расширения лежат
  под его именем.
- **Сущность или экран** — компонент, диалог, форма, сообщение
  (`deposit`, `exitDialog`, `notify`).
- **Элемент** — роль текста: `title`, `subtitle`, `label`, `hint`,
  `placeholder`, `submit`, `empty`, `success`, `confirm`, либо смысловое
  имя (`amountLabel`, `minAmountHint`).
- Статусы и перечисления — `<область>.<сущность>.status.<значение>`,
  значение как в коде.
- Общие для всего приложения фразы — в `common.*` этого пакета. Два экрана
  делят ключ, только если фраза совпадает и по смыслу, а не случайно.
- Имена параметров — смысловые: `{amount}`, `{date}`, `{username}`.

## Ошибки

Ошибка для клиента несёт код, а текст подставляет сервер на языке запроса.
Код — `SCREAMING_SNAKE` с префиксом области (`WALLET_INSUFFICIENT_FUNDS`,
`CAPITAL_ISSUE_NOT_FOUND`), сообщение — по ключу `errors.<КОД>`. Общие коды
(`COMMON_*`, `CHAIN_ASSERT`) — в этом пакете, коды расширения — в словаре
расширения.

## Где лежат словари

| Кто | Где |
|---|---|
| общие | `components/i18n/src/messages/<язык>/*.json` |
| ядро desktop | `components/desktop/src/shared/i18n/locales/<язык>/<область>.json` |
| расширение desktop | `components/desktop/extensions/<имя>/i18n/<язык>.json` |
| ядро controller | `components/controller/src/i18n/locales/<язык>/<область>.json` |
| расширение controller | `components/controller/src/extensions/<имя>/i18n/<язык>.json` |

Документация остаётся по-русски: описания GraphQL-схемы, комментарии и логи
в словари не выносятся.

## Как писать код

| Где | Как |
|---|---|
| шаблон desktop | `{{ $t('wallet.deposit.title') }}`, `:label="$t('common.action.save')"` |
| скрипт desktop | `import { t } from 'src/shared/i18n'` — ядро; `import { t } from '<расширение>/i18n'` — расширение |
| отказ бэкенда | `throw DomainError.notFound('WALLET_NOT_FOUND', { username })` — из `@coopenomics/extension-kit` |
| сообщение class-validator | `@IsNotEmpty({ message: validationMessage('account.form.emailRequired') })` — переводится в момент проверки |
| надпись бэкенда | `import { t } from '~/i18n'` (ядро) или `'../i18n'` (расширение) |
| клиентская библиотека (auth, sdk) | `import { lt } from '@coopenomics/i18n'`; приложение подставляет свой переводчик через `setLibraryTranslator` |
| уведомление | тексты — `components/notifications/src/i18n/ru.json` (Liquid), в сценарии — `nt('<сценарий>.<канал>.<поле>')` |
| отказ по коду на клиенте | `hasErrorCode(error, 'MEMBERSHIP_EXIT_PAYMENT_METHOD_REQUIRED')` из `src/shared/api/errors` — не по тексту |

Строка, которая не является текстом интерфейса (данные, маски, имена XML-элементов
официальных форм, сверка с текстом отказа контракта), помечается комментарием
`// i18n-ignore: причина` на той же или предыдущей строке; файл-данные целиком —
`// i18n-ignore-file: причина` в начале. Строки шаблонов, которые нельзя пометить
комментарием, перечислены в `scripts/lib/i18n-ignore.json`.

SSR-middleware (`src-ssr`) и сервис-воркер собираются без Vite и переводчик
приложения не импортируют — гейт это проверяет.

## Гейт и инструмент переноса

`pnpm check:i18n` (входит в `pnpm check`) — хардкод кириллицы храповиком
(`scripts/lib/i18n-hardcode-baseline.json`, сейчас 0), исправность словарей,
подключение словарей расширений, типы ключей (`keys.generated.ts`), глоссарий
(`glossary.json`), шаблоны уведомлений.

`node scripts/i18n-extract.mjs scan <пути> --out work.json` → разметка ключей
(`names.json`) → `node scripts/i18n-extract.mjs apply work.json names.json` —
механический перенос строк: замена в шаблонах и скриптах, `DomainError` вместо
исключений бэкенда, словари, импорты, подключение словаря расширения.
После — `node scripts/check-i18n.mjs types --write` и `hardcode --update`.
