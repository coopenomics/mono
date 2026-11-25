# Благорост — документация разработчика

Приложение ведёт целевую потребительскую программу «Благорост»: кооператив развивает собственные проекты силами пайщиков и принимает результаты их работы в своё имущество.

Текст страницы в каталоге приложений — `CATALOG.md`: его читают председатель и совет, технических подробностей в нём нет. Этот файл — для разработчика.

## Запись реестра

Запись — в `components/controller/src/extensions/extensions.registry.ts`. Что значит каждое поле — корневой `components/controller/CLAUDE.md`, раздел «Что расширение объявляет о себе».

### `capital` — Благорост

- Доступность в сети: везде.
- Ставит председатель из каталога приложений (`defaults` в записи реестра нет).
- Модуль: `CapitalExtensionModule` — `capital/capital-extension.module.ts`.
- Рабочие столы: `capital` («Стол благороста»).
- Поля настроек (`Schema` модуля): `github_sync_branch`, `github_sync_poll_interval_minutes`, `github_api_token_encrypted`, `github_sync_all_branches`, `github_sync_branch_filter`, `program_share_registration_interval_minutes`, `creators_voting_percent`, `authors_voting_percent`, `coordinator_bonus_percent`, `coordinator_invite_validity_days`, `expense_pool_percent`, `voting_period_in_days`, `energy_decay_rate_per_day`, `level_depth_base`, `level_growth_coefficient`, `energy_gain_coefficient`, `onboarding_generator_program_template_done`, `onboarding_generation_contract_template_done`, `onboarding_generator_offer_template_done`, `onboarding_blagorost_provision_done`, `onboarding_blagorost_offer_template_done`, `capital_program_doc_data_hash`.
- Миграции схемы базы: 5; миграции настроек: 0.
- Обязательные порты: `Ledger2History`, `DesktopGrantsRegistry`, `Account`, `Candidate`, `Chain`, `Council`, `DecisionTracking`, `DocumentApproval`, `Document`, `ExpenseChassis`, `FreeDecision`, `IntegrationSettings`, `Logger`, `MutationLog`, `DocumentDeclaration`, `OnboardingStepRegistry`, `ProgramWallet`, `RoleAssignments`, `UserWallet`, `Ledger2History`, `Notification`, `RegistrationDocumentParametersRegistry`, `RegistrationRegistry`, `SecretCipher`, `UserData`, `UserDirectory`, `Vault`.
- Необязательные порты: `ChainDeltaWait`, `ChainChanges`, `MatrixRoomMessaging`, `ProjectCommunicationArtifacts`.

## Где что лежит

- Сервер: `components/controller/src/extensions/capital/`. Подкаталоги: `application/`, `constants/`, `domain/`, `i18n/`, `infrastructure/`, `migrations/`.
- Файлы верхнего уровня: `capital-extension.module.ts`, `capital.database-migrations.ts`, `capital.ports.ts`.
- Стол: `components/desktop/extensions/capital/` — маршруты и пункты меню в `install.ts`, тексты в `i18n/ru.json`.
- Таблицы базы (создают миграции расширения): `capital_appendixes`, `capital_comments`, `capital_commits`, `capital_component_metrics`, `capital_content_revisions`, `capital_contributors`, `capital_cycles`, `capital_debts`, `capital_expenses`, `capital_favorites`, `capital_github_branch_commit_sync_state`, `capital_github_comm_message_cursor`, `capital_github_comm_transcription_cursor`, `capital_github_file_indexes`, `capital_invests`, `capital_issue_linked_git_commit_shas`, `capital_issue_linked_git_commits`, `capital_issue_metric_bindings`, `capital_issues`, `capital_measures`, `capital_metric_contributions`, `capital_process_instances`, `capital_process_templates`, `capital_program_properties`, `capital_program_wallets`, `capital_program_withdraws`, `capital_project_properties`, `capital_projects`, `capital_results`, `capital_segments`, `capital_share_transfers`, `capital_state`, `capital_stories`, `capital_time_entries`, `capital_timer_sessions`, `capital_votes`.
- Порты и их владельцы — `components/innercoop/PORTS.md`.
