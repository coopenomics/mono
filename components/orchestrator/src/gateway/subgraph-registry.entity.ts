import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Регистр subgraph'ов tenant'а. Apollo Gateway периодически читает active=true
 * запись и пересобирает supergraph.
 *
 * Стартовая запись для core-subgraph'а (coopback) добавляется на bootstrap
 * orchestrator'а; остальные приезжают через POST /v1/internal/extensions/install.
 *
 * package_id = '@scope/name' (для core — sentinel 'core@coopback').
 * version    = семантическая версия image'а (для core — 'monolith').
 * url        = http://service-name:port/v1/graphql — резолвится docker DNS.
 * active     = маршрутизируется ли в supergraph (false = выпиленный extension).
 */
@Entity('subgraph_registry')
export class SubgraphRegistryEntity {
  @PrimaryColumn({ type: 'varchar', length: 128, comment: 'package_id (@scope/name) или core sentinel' })
  packageId!: string;

  @Column({ type: 'varchar', length: 32 })
  version!: string;

  @Column({ type: 'varchar', length: 512 })
  url!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'varchar', length: 16, default: 'unknown', comment: 'last healthcheck result' })
  healthStatus!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
