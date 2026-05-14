# report-forms

Редактируемые формы отчётов ФНС/СФР для `ReportEditorDialog`. Две группы
компонентов:

## 1. Editable редакторы (v-model edits, автосейв, live-валидация)

| ReportType | Компонент | Источник данных |
|---|---|---|
| BUHOTCH | `BuhotchEditor.vue` + `BalanceRowEditor.vue` | per-type `BuhotchEditsShape` |
| NDFL6 / RSV / PSV / FSS4 (ЕФС-1) | `ZeroReportEditor.vue` (универсальный) | общий `ZeroReportEditsShape` |
| DUSN / UUSN / UV_VZNOSY | — (скрыты `HIDDEN_IN_MVP`, УСН вне MVP) | — |

- **`BuhotchEditor`** — полный editable-редактор бухбаланса:
  редактируется баланс построчно (1170/1250/1260 актив, 1350 пассив,
  итоги 1600/1700), подписант, реквизиты, шапка. `BalanceRowEditor`
  — компонент одной строки с тремя числами (СумОтч/СумПрдщ/СумПрдшв).
- **`ZeroReportEditor`** — универсальная форма для 4 нулёвок.
  Через `props.reportType` и computed'ы `periodKind`/`needs` выставляется:
  * `periodKind = 'quarter'` для NDFL6/RSV/FSS4, `'month'` для PSV;
  * `needs.oktmo` — для NDFL6;
  * `needs.snils` — для PSV (обязателен);
  * `needs.sfrExtras` — для FSS4 (ОКВЭД / ОГРН / рег.номер СФР /
    должность председателя).

### Контракт editable-формы

```ts
defineProps<{
  edits: TEdits | null
  fieldErrors?: Record<string, string[]>  // JSONPath → [messages]
  reportType?: IReportType                // для универсального ZeroReportEditor
}>()

defineEmits<{
  (e: 'update:edits', value: TEdits): void
  (e: 'dirty', path: string): void         // JSONPath изменённого поля
}>()
```

Каждый q-input → rules из `Selectors.reportRules` (SDK, паттерны XSD)
+ `:error` / `:error-message` из `fieldErrors[path]`.

## 2. Read-only paper-view (для PDF-экспорта)

Сохранены как legacy для пост-генерационного бумажного превью:

| ReportType | Компонент | КНД | ВерсФорм |
|---|---|---|---|
| BUHOTCH | `BuhotchForm.vue` | 0710096 | 5.04 |
| DUSN | `DusnForm.vue` | 1152017 | 5.09 |
| NDFL6 | `Ndfl6Form.vue` | 1151100 | 5.05 |
| RSV | `RsvForm.vue` | 1151111 | 5.08 |
| PSV | `PsvForm.vue` | 1151162 | 5.01 |
| UUSN / UV_VZNOSY | `UusnForm.vue` | 1110355 | 5.03 |
| FSS4 (ЕФС-1) | `Efs1Form.vue` | — (СФР) | — |

Используют `useReportXml` + `_printable-form.scss`. Все 5 MVP-форм
(BUHOTCH/NDFL6/RSV/PSV/FSS4) имеют общий контракт
`{ xml, requisites?, year? }` и `.printable-form`-root, поэтому
`ReportEditorDialog` рендерит нужную в скрытом DOM по `reportType`
и экспортирует в PDF через `html2pdf`. DUSN/UUSN/UV_VZNOSY скрыты
через `HIDDEN_IN_MVP`, их paper-view оставлены для будущего.

## Как корректно править форму

1. Открыть бланк в `components/reports-standarts/<форма>/` (TIF/XLS/PDF)
   — там расположение полей «как на бумаге».
2. Открыть генератор в `components/controller/src/extensions/reports/
   infrastructure/generators/<форма>.generator.ts` — там точная
   XML-структура: теги, атрибуты, иерархия.
3. Для редактора (editable) — добавлять поле в соответствующий
   `<Type>EditsShape` в `controller/src/extensions/reports/domain/
   edits-shapes/` + зеркало в `<Type>EditsInputDTO/DTO`.
4. Regex-паттерны валидации — из SDK `Selectors.reportRules.<name>`,
   не хардкод. Источник правды — `domain/patterns.ts` (backend) /
   `selectors/reports/patterns.ts` (SDK, frontend).

## См. также

- `components/reports-standarts/` — бланки, XSD-схемы, приказы ФНС/СФР.
- `components/controller/src/extensions/reports/infrastructure/generators/`
  — генераторы XML per-type.
- `components/controller/src/extensions/reports/domain/edits-shapes/`
  — POJO-контракты редактируемого состояния.
- `components/desktop/src/entities/Report/model/useReportDraft.ts`
  — composable для загрузки/автосейва/валидации черновиков.
- `components/desktop/extensions/reports/widgets/reports-calendar/`
  — календарь-матрица форм × периодов.
