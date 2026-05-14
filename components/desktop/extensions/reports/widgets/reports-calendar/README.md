# reports-calendar

Виджет-матрица «форма × месяцы» для страницы отчётности — аналог
календаря сдачи в Контур.Экстерн / СБИС.

- Строки — 5 форм MVP (БУХОТЧ, 6-НДФЛ, РСВ, ПСВ, ЕФС-1).
- Столбцы — 12 месяцев выбранного года.
- Каждая ячейка в месяце сдачи формы подсвечена по статусу:
  * `SUBMITTED` — сгенерирован валидный XML, в ячейке зелёная точка.
  * `SUBMITTED_EXTERNALLY` — отметка «сдан вне платформы» (бумажный/сторонний
    сервис); зелёная точка с обводкой (визуально отличается от настоящей сдачи).
  * `DRAFT` — есть `ReportDraft`, фон мягко-оранжевый.
  * `NOT_REQUIRED` — нажали «Не надо сдавать», серый ⊘.
  * `OVERDUE` — срок прошёл, не сдан, фон насыщенно-красный.
  * `EMPTY` — будущий период, нейтральный фон.

Приоритет (сверху — сильнее):
`SUBMITTED > SUBMITTED_EXTERNALLY > DRAFT > NOT_REQUIRED > OVERDUE > EMPTY`.

SUBMITTED_EXTERNALLY переопределяет draft/overdue, но слабее реальной сдачи —
если пользователь всё-таки сгенерирует XML, настоящий архив побеждает.

Клик по активной ячейке открывает `ReportEditorDialog` для (reportType,
year, period) этой ячейки.

## Страница-контейнер (DocumentsPage)

Календарь живёт на подмаршруте `reports-documents-calendar`. Страница
`DocumentsPage` — shell с `<router-view>`: она инжектирует три кнопки
в шапку сайта (`useHeaderActions` + `RouteMenuButton`) для переключения
между календарём, списком форм и архивом. Дефолтный редирект
`reports-documents → reports-documents-calendar`.

## Источник данных

- Backend: резолвер `getReportCalendar(year): [ReportCalendarRow]` в
  `controller/src/extensions/reports/application/resolvers/
  report-calendar.resolver.ts`.
- Реестр дат сдачи: `controller/src/extensions/reports/domain/services/
  reports-calendar-registry.ts` — хардкод сроков на основе НК РФ (ст.230
  для 6-НДФЛ, ст.431 для РСВ/ПСВ, ст.18 402-ФЗ для БУХОТЧ) и приказа
  СФР №1462 от 17.11.2025 для ЕФС-1. `shiftToBusinessDay` переносит
  субботу/воскресенье на ближайший понедельник (праздники РФ пока не
  учитываются — см. Debt).
- Статусы считаются по `GeneratedReportEntity` (архив),
  `ReportDraftEntity` (черновик) и `ReportSubmissionMarkEntity`
  (coop-wide «не надо сдавать»). Мутация `markReportPeriod(...)`
  ставит/снимает отметку.

## Файлы

- `ReportsCalendar.vue` — матрица + управление годом + загрузка через
  `reportStore.loadCalendar(year)`.
- `CalendarCell.vue` — одна ячейка месяца (статус/иконка/тултип).

## Ограничения / TODO

- Перенос выходных и праздников РФ реализован (`shiftToBusinessDay` +
  `RU_HOLIDAYS_BY_YEAR`): Sat/Sun → ближайший рабочий день; если тот тоже
  праздник (напр. 1 января) — ещё дальше. Праздники захардкожены на
  2026–2027; для других лет работает только Sat/Sun-перенос.
- Overdue-статус проверяется только через `dueDate < today`. Если пользователь
  сдал отчёт «с опозданием», архив покажет `SUBMITTED` (правильно), но до того
  он будет `OVERDUE` — это ожидаемо.
- Отметки `NOT_REQUIRED` и `SUBMITTED_EXTERNALLY` хранятся per-coop (не per-user).
  Снять их может любой председатель (audit: поле `created_by` в
  `ReportSubmissionMarkEntity`).
