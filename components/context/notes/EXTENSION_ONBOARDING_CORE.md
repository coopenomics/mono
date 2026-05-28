# Платформенное ядро L1-онбординга расширений (приём ЦПП Советом)

Как кооператив «подключает» расширение (capital/marketplace/chairman): Совет утверждает
набор документов ончейн, и состояние расширения **автоматически** меняется по факту
реально принятого решения. Механизм — общий, платформенный. Расширение лишь декларирует
свои шаги; весь flow (генерация проекта решения → публикация в Совет → отслеживание
ончейн-принятия → смена состояния → перерегистрация оферт) делает ядро.

НЕ путать с L2 (выбор ЦПП пайщиком при регистрации) и L3 (fallback-gate на столе).
Здесь только L1 — приём кооперативом.

## Где что лежит (controller)

| Слой | Путь | Роль |
|---|---|---|
| Spec шага | `domain/onboarding/dto/extension-onboarding-step-spec.ts` | `{extension_name, step_key, event_type: SOVIET_DECISION\|MEET_DECISION, vars_field, generator: free_decision\|meet, default_title, order}` |
| Реестр шагов | `domain/onboarding/services/onboarding-steps-registry.service.ts` | in-memory; реализует `OnboardingStepRegistrationPort` (registerStep/unregisterStepsByExtension) + `OnboardingStepQueryPort` (getStep/getStepsByExtension) |
| Generic-сервис | `domain/onboarding/services/extension-onboarding.service.ts` | `getState()` / `completeStep()` — собирает состояние из config-полей `onboarding_<step_key>_done`/`_hash`; в `completeStep` гонит free_decision/meet generator |
| Generic-слушатель | `domain/onboarding/services/extension-onboarding-events.service.ts` | `@OnEvent(DecisionTrackedEvent)`: ставит `_done=true`, при всех done эмитит `ONBOARDING_COMPLETED_EVENT` |
| Generic-резолвер | `application/onboarding/resolvers/extension-onboarding.resolver.ts` | Query `getExtensionOnboardingState(extension_name)` (chairman/member/user) + Mutation `completeExtensionOnboardingStep(data)` (chairman) |
| Трекинг решений | `infrastructure/decision-tracking/adapters/decision-tracking.adapter.ts` | `@OnEvent(action::soviet::newdecision / action::meet::newdecision)` → `processDecision(hash)` → ищет tracking-rule по hash → эмитит `DecisionTrackedEvent` |
| Lifecycle | `domain/extension/services/extension-lifecycle-domain.service.ts` | `@OnEvent(ONBOARDING_COMPLETED_EVENT)` → `restartApp(extension_name)` → `module.initialize(config)` |
| Глобальный модуль | `domain/onboarding/onboarding-domain.module.ts` | `@Global`; экспортит порты `ONBOARDING_STEP_REGISTRATION_PORT` / `_QUERY_PORT` — доступны любому расширению без импорта |

## Поток «Совет принял ончейн → состояние сменилось»

```
1. Председатель: completeExtensionOnboardingStep({extension_name, step_key, title, question, decision})
     decision = HTML самого документа (фронт заранее рендерит через generateDocument(registry_id))
2. ExtensionOnboardingService.completeStep → runFreeDecisionGenerator:
     - freeDecisionPort.createProjectOfFreeDecision(...)
     - generateProjectOfFreeDecisionDocument(registry=ProjectFreeDecision)  → hash
     - publishProjectOfFreeDecision(...)            → проект решения уходит в Совет ончейн
     - decisionTrackingPort.registerTrackingRule({hash, event_type, vars_field,
            metadata:{onboarding_step, project_id, extension}})
     - сохраняет onboarding_<step>_hash в extensions.config        → шаг 'in_progress'
3. Совет голосует и принимает решение ончейн (soviet::exec → soviet::newdecision)
4. DecisionTrackingAdapter ловит action::soviet::newdecision → processDecision(hash)
     → находит rule по hash → эмитит DecisionTrackedEvent(metadata)
5. ExtensionOnboardingEventsService: onboarding_<step>_done=true               → шаг 'completed'
     когда ВСЕ шаги done → emit ONBOARDING_COMPLETED_EVENT({extension_name})
6. ExtensionLifecycleDomainService → restartApp(extension_name) → initialize(config)
     расширение в initialize() перерегистрирует оферты/программы и выставляет свой
     L1-флаг готовности (для marketplace — coopAcceptance.accepted=true).
```

Состояние шага для фронта: `done → completed`; `hash есть, done нет → in_progress` («Ожидаем
решение совета»); иначе `pending`.

## Как подключить НОВОЕ расширение (рецепт)

1. **Шаги**: `extensions/<ext>/application/onboarding/register-<ext>-onboarding-steps.ts` —
   функция зовёт `port.unregisterStepsByExtension(name)` + `port.registerStep({...})` на каждый
   документ. step_key и vars_field обычно совпадают; order задаёт порядок утверждения.
2. **Wiring**: в плагине расширения `@Inject(ONBOARDING_STEP_REGISTRATION_PORT)` и вызвать
   `register<Ext>OnboardingSteps(port)` в `initialize()`. Порт глобальный — импорт модуля не нужен.
3. **НЕ добавлять** расширение в `LEGACY_EXTENSIONS_WITH_OWN_LISTENER`
   (`extension-onboarding-events.service.ts`) — тогда generic-слушатель сам обслужит флаги и
   completion. Свой events-сервис нужен ТОЛЬКО legacy (chairman/capital хардкодят step-mapping).
4. **L1-флаг готовности**: в `initialize()` вывести флаг видимости из платформенного состояния
   (например, «все onboarding_*_done → accepted=true»). Идемпотентно — initialize зовётся и на
   boot, и на auto-restart после ONBOARDING_COMPLETED.
5. **Документы**: каждый документ = запись в `cooptypes/src/cooperative/registry/<id>.Name/` +
   генератор в `factory/src/{Actions,Templates}/<id>.Name.ts` + регистрация в индексах factory и
   диспетчере `factory/src/index.ts`. Пересобрать cooptypes и factory (`pnpm run build`).
6. **Фронт**: переиспользовать `desktop/src/shared/ui/CouncilOnboarding` (`CouncilOnboardingCard`,
   проп `config: ICouncilOnboardingConfig`, эмит `step-submit`). Composable строит config из
   `Queries.Onboarding.GetExtensionOnboardingState`, заранее рендерит HTML документов через
   `Mutations.Documents.GenerateDocument` (в `step.decision`), а `step-submit` шлёт
   `Mutations.Onboarding.CompleteExtensionOnboardingStep`. **GraphQL-схему менять не нужно** —
   generic onboarding API уже в схеме и SDK.

## Marketplace как пример (Эпик 12)

- Шаги: `marketplace_provision` (Положение, registry **1107.MarketplaceProgramTemplate**) и
  `marketplace_offer_template` (Оферта-шаблон, registry **1100.MarketplaceOfferTemplate**).
  Регистрация: `extensions/marketplace/application/onboarding/register-marketplace-onboarding-steps.ts`.
- L1-флаг: `MarketplacePlugin.initialize()` → `syncCoopAcceptanceFromOnboarding()` выставляет
  `config.coopAcceptance.accepted=true`, когда оба `onboarding_marketplace_*_done`. Этот флаг
  читают `MarketplaceDesktopGrantsProvider` (видимость столов) и `marketplaceCppStatus`.
- Документ Положения 1107 — placeholder («РЫБА») до юр. редакции, по образцу 1100/999.
- Прежняя stub-мутация `marketplaceAcceptCpp` (ручное проставление флага) больше не
  используется фронтом — осталась как мёртвый код для последующей чистки.

Связано: `CONTROLLER_DECISIONS_TRACKING_FACTORY.md`, `BLAGOROST-CHAIRMAN-ONBOARDING.md`,
`EXTENSIONS_SCHEMA_SYSTEM.md` (грантовый канон видимости столов).
