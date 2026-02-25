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

#### 11.1 CASL — система прав доступа ✅
- [x] @casl/ability установлен
- [x] Action enum: manage, read, create, update, delete, execute, share
- [x] Subject enum: 30+ subjects для всех ресурсов
- [x] CaslAbilityFactory: role-based + granular permissions
- [x] CaslGuard + @CheckAbility decorator (обратная совместимость с RolesGuard)
- [x] role в user сохранено (chairman, member, user)
- [ ] Тесты: unit-тесты для каждой роли

#### 11.2 Шаринг страниц ✅ (бэкенд)
- [x] ShareTokenEntity с JWT, guest/member targets
- [x] ShareService: create/verify/revoke
- [x] GraphQL: createShareLink, revokeShareLink, getMyShareLinks, getSharedWithMe
- [x] Два уровня: гости (linkName) и пайщики (targetUsername)
- [x] Granular allowedActions per share link
- [ ] Кнопка "Поделиться" в Desktop Header
- [ ] Диалог управления правами
- [ ] Страница "Доступные мне" на рабочем столе Пайщика

#### 11.3 Интеграция в desktop
- [ ] shareablePermissions в meta маршрутов install.ts
- [ ] ShareButton + ShareDialog компоненты
- [ ] Валидация share tokens в route guard
