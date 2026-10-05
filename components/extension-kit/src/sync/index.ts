/**
 * Каркас синхронизации состояния блокчейна с базой данных.
 *
 * Здесь лежат базовые классы, от которых наследуется код, читающий state
 * контрактов: запись базы, доменная сущность, дельта-маппер, хранилище,
 * сервис синхронизации и подсистема версионирования (она нужна, чтобы
 * откатывать записи при форке цепи).
 *
 * Раньше всё это жило в `~/shared/**` контроллера, и расширения наследовались
 * от классов ядра в 180+ точках. Наследование — не зависимость, которую можно
 * подменить инъекцией: базовый класс обязан физически лежать в пакете, иначе
 * расширение не соберётся за пределами монолита.
 *
 * Потребитель здесь не только расширения: тем же каркасом ядро синхронизирует
 * свои четыре семейства (agreement, user-agreement, user-wallet,
 * program-wallet). Поэтому каркас вынесен отдельной точкой входа — если
 * когда-нибудь понадобится свой пакет, переезд сведётся к переносу каталога.
 */
export * from './delta';
export * from './sync-logger';
export * from './base-database.interface';
export * from './blockchain-sync.interface';
export * from './base-domain.entity';
export * from './base-output.dto';
export * from './abstract-blockchain-delta.mapper';
export * from './abstract-entity-sync.service';
// Запись зеркала, версии с архивом форка и базовое хранилище — на Kysely (C28-81).
export * from './chain-record';
export * from './chain-versioning.service';
export * from './base-chain.repository';
// Форк цепи: маркер, по которому реестр ядра находит синхронизаторы. Сам
// реестр живёт в ядре — он обходит граф приложения, а не принадлежит каркасу
// расширения.
export * from './fork/fork-aware-syncer.interface';
export * from './errors/unsupported-contract-version.error';
export * from './errors/audit-unknown-status';
export * from './sync-policy';
export * from './audit-logger';
