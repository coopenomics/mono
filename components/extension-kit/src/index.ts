/**
 * `@coopenomics/extension-kit` — служебный каркас расширения цифрового кооператива.
 *
 * Отвечает на вопрос «чем нужно быть, чтобы считаться расширением»: базовый класс,
 * сущности и репозитории расширения, контракт миграций схемы, контракт записи реестра.
 * Контракты общения с ядром и соседями — в ортогональном пакете `@coopenomics/innercoop`
 * (INV-007: пакеты не зависят друг от друга; расширение и контроллер зависят от обоих).
 *
 * Сервисы жизненного цикла, листинга и применения миграций остаются в контроллере:
 * они знают о конкретных расширениях (реестр, дефолты конфигов, список миграций),
 * то есть являются composition root, а не переиспользуемым каркасом.
 *
 * Каркас синхронизации состояния блокчейна — отдельная точка входа
 * `@coopenomics/extension-kit/sync`, см. комментарий в `src/sync/index.ts`.
 */
export * from './auth';
export * from './base-extension.module';
export * from './payment/payment-provider';
export * from './file-storage/bucket';
export * from './file-storage/bucket-providers';
export * from './expense/expense-proposal-statement-document.dto';
export * from './registration/candidate.dto';
export * from './registration/candidate-filter.dto';
export * from './onboarding/onboarding-ttl';
export * from './entities/extension.entity';
export * from './entities/log-extension.entity';
export * from './repositories/extension.repository';
export * from './repositories/log-extension.repository';
export * from './migrations/schema-migration.contract';
export * from './lifecycle/events';
export * from './registry/registry.contract';
export * from './registry/extension-field-description';
export * from './dto/pagination.dto';
export * from './dto/require-fields';
export * from './dto/transaction-result-response.dto';
export * from './config/config-policy';
export * from './config/platform-settings';
export * from './document';
export * from './blockchain/domain-to-blockchain.utils';
export * from './utils';
export * from './errors/http-api-error';
