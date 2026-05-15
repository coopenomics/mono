# Performance baseline (Story 10.3 · NFR-P1/P2/P3)

Эталонная инструкция для измерения и контроля производительности marketplace-frontend.
В MVP — manual через Chrome DevTools / Lighthouse. CI-gate (Lighthouse CI + Web Vitals) — Phase 2.

## Эталонные страницы

| ID  | Стол / роль | Путь                          | Story                  |
|-----|-------------|-------------------------------|------------------------|
| P1  | orderer     | `/:coopname/market/showcase`  | Story 3.5 (каталог)    |
| P2  | orderer     | `/:coopname/market/my-orders` | Story 4.6 (Мои заказы) |
| P3  | operator    | `/:coopname/market/warehouse` | Story 9.1 (Склад КУ)   |
| P4  | admin       | `/:coopname/market/warehouse` | Story 9.2 (Сводный)    |

## Целевые показатели (NFR-P1)

| Метрика                          | Цель MVP            | Phase 2 (CI-gate)  |
|----------------------------------|---------------------|--------------------|
| Отзывчивость на действие         | ≤ 1 сек             | ≤ 800 мс           |
| FCP (First Contentful Paint)     | ≤ 1.5 сек           | ≤ 1.2 сек          |
| TTI (Time to Interactive)        | ≤ 3 сек             | ≤ 2.5 сек          |
| Bundle size (gzipped, per-стол)  | ≤ 500 КБ            | ≤ 400 КБ           |
| CLS (Cumulative Layout Shift)    | ≤ 0.1               | ≤ 0.05             |

## NFR-P2 — отсутствие realtime-требований

- Real-time **не требуется**: цикл отсечки часами/сутками.
- NestJS handlers без sub-ms timing optimization.
- SDK-подписки платформы (AR37) используются вместо собственного WebSocket transport.

## NFR-P3 — экономия RAM в контракте

- Тяжёлые данные (ТТН-документы, фото, сканы) — в Backend Marketplace и Bucket (Story 7.1).
- On-chain только инварианты учёта.

## Manual workflow перед релизом

1. Запустить production-сборку:
   ```bash
   cd components/desktop
   npm run build
   ```
2. Запустить serve:
   ```bash
   npm run start
   ```
3. Открыть Chrome DevTools → Lighthouse → выбрать категории `Performance`, `Best Practices`, `Accessibility`.
4. Прогнать на каждой из 4 эталонных страниц (P1..P4) с эмуляцией `Slow 4G`.
5. Зафиксировать результаты в blago issue `598-13` под лейблом `performance-baseline-YYYY-MM-DD`.
6. Если значения хуже целевых — открыть отдельный issue с проф-задачами (lazy-loading, image optimization, code splitting).

## Phase 2 — CI gate

После стабилизации MVP подключается:
- `@lhci/cli` в GitHub Actions с budget-файлом на эти же метрики;
- `webpack-bundle-analyzer` в build-step с budget на bundle-size per-стол;
- `@axe-core/cli` для WCAG 2.1 AA (отдельная задача — NFR-A1 Phase 2).
