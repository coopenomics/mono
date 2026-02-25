# TASKS.md — Прогресс выполнения задач

## Завершённые задачи
- ✅ 1. Dev-окружение
- ✅ 2. Security updates
- ✅ 3. Unified test pipeline (162/163)
- ✅ 4. README + описания компонентов
- ✅ 5. AGENTS.md для всех компонентов
- ✅ 6. Setup — профессиональный установщик
- ✅ 7. Поисковая система документов (OpenSearch)
- ✅ 8. Процессы (Capital extension) — бэкенд + фронтенд
- ✅ 9. Отчёты ФНС — 8 генераторов, фабрика, GraphQL API

---

## Активные задачи

### 10. Генерация отчётов ФНС (доработка)
- [x] Фабрика генераторов (ReportRegistryService)
- [x] 8 генераторов (Бухбаланс, 6-НДФЛ, РСВ, ПСВ, ДУСН, 4-ФСС, Увед. взносы, УУСН)
- [x] GraphQL API (getAvailableReports, generateReport)
- [ ] XSD валидация + тесты
- [ ] Desktop UI (страница отчётов)
- [ ] Интеграция с реальными данными ledger

### 11. CASL + гранулированные права доступа + шаринг страниц

#### 11.1 CASL — система прав доступа
- [ ] Установить @casl/ability
- [ ] Определить все abilities (actions: read, create, update, delete, manage)
- [ ] Определить subjects (каждая страница/мутация/запрос)
- [ ] CaslAbilityFactory: создание abilities на основе role + дополнительных прав
- [ ] CaslGuard для GraphQL resolvers (замена RolesGuard, с обратной совместимостью)
- [ ] Сохранить поле role в user (chairman, member, user)
- [ ] Тесты: unit-тесты для каждой роли и granular permission

#### 11.2 Шаринг страниц
- [ ] ShareToken entity (JWT: page, permissions, target user/guest, expiry)
- [ ] ShareToken GraphQL: createShareLink, revokeShareLink, getSharedLinks
- [ ] Кнопка "Поделиться" в Header (через useHeaderActions)
- [ ] Диалог управления: список текущих прав, создание/отзыв ссылок
- [ ] Два уровня: гости (по имени ссылки) и пайщики (по username)
- [ ] Гранулированные permissions per page (файл permissions.ts в каждом install.ts)
- [ ] Страница "Доступные мне" на рабочем столе Пайщика

#### 11.3 Интеграция в desktop
- [ ] Пройти по ВСЕМ install.ts и добавить shareablePermissions в meta маршрутов
- [ ] ShareButton компонент с диалогом управления
- [ ] Валидация share tokens на бэкенде
- [ ] Middleware для проверки share access
