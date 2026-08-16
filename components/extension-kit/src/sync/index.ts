/**
 * Каркас синхронизации состояния блокчейна с базой данных.
 *
 * Здесь лежат базовые классы, от которых наследуется код, читающий state
 * контрактов: сущность БД, доменная сущность, дельта-маппер, репозиторий,
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
export * from './base-typeorm.entity';
export * from './base-domain.entity';
export * from './base-output.dto';
export * from './abstract-blockchain-delta.mapper';
export * from './abstract-entity-sync.service';
export * from './entity-version.typeorm-entity';
export * from './entity-version.repository';
export * from './entity-versioning.service';
export * from './base-blockchain.repository';
// Форк цепи: маркер, по которому реестр ядра находит синхронизаторы, и архив
// снесённых форком записей. Сам реестр живёт в ядре — он обходит граф
// приложения, а не принадлежит каркасу расширения.
export * from './fork/fork-aware-syncer.interface';
export * from './invalidated-entity.typeorm-entity';
export * from './invalidated-entity-version.typeorm-entity';
export * from './invalidated-entity.repository';
export * from './invalidated-entity-version.repository';
export * from './errors/unsupported-contract-version.error';
export * from './errors/audit-unknown-status';
export * from './sync-policy';
