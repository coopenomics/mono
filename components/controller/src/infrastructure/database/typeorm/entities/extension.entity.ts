import { BeforeInsert, BeforeUpdate, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ExtensionDomainEntity } from '@coopenomics/extension-kit';
import type { ExtensionDomainInterface } from '@coopenomics/extension-kit';

@Entity('extensions')
export class ExtensionEntity<TConfig = any> implements ExtensionDomainInterface<TConfig> {
  @PrimaryColumn({ unique: true, length: 12 })
  name!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column('jsonb', { default: {} })
  config!: TConfig;

  @Column({ default: 1 })
  schema_version!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  setDefaultConfig() {
    if (this.config === null || this.config === undefined) {
      this.config = {} as TConfig;
    }
  }

  // Удален обязательный конструктор
  constructor(data?: ExtensionDomainEntity<TConfig>) {
    if (data) {
      this.name = data.name;
      this.enabled = data.enabled;
      this.config = data.config;
      this.schema_version = (data as any).schema_version ?? 1;
      this.created_at = data.created_at;
      this.updated_at = data.updated_at;
    }
  }

  // Метод для преобразования ORM-сущности в доменную сущность
  toDomainEntity(): ExtensionDomainEntity<TConfig> {
    return new ExtensionDomainEntity<TConfig>(
      this.name,
      this.enabled,
      this.config,
      this.created_at,
      this.updated_at,
      this.schema_version
    );
  }

  // Статический метод для создания ORM-сущности из доменной сущности
  static fromDomainEntity<TConfig>(domainEntity: ExtensionDomainEntity<TConfig>): ExtensionEntity<TConfig> {
    return new ExtensionEntity<TConfig>(domainEntity);
  }
}
