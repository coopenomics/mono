// infrastructure/database/typeorm/repositories/typeorm-app.repository.ts

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import { ExtensionEntity } from '../entities/extension.entity';
import { ExtensionDomainRepository } from '~/domain/extension/repositories/extension-domain.repository';
import { ExtensionDomainEntity } from '~/domain/extension/entities/extension-domain.entity';

@Injectable()
export class TypeOrmExtensionDomainRepository<TConfig = any> implements ExtensionDomainRepository<TConfig> {
  constructor(
    @InjectRepository(ExtensionEntity)
    private readonly ormRepo: Repository<ExtensionEntity<TConfig>>
  ) {}

  async findByName(name: string): Promise<ExtensionDomainEntity<TConfig> | null> {
    const ormEntity = await this.ormRepo.findOne({ where: { name } });
    return ormEntity ? ormEntity.toDomainEntity() : null;
  }

  async deleteByName(name: string): Promise<boolean> {
    const result = await this.ormRepo.delete({ name });
    return (result.affected ?? 0) > 0; // Возвращает true, если запись была удалена
  }

  async create(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    const ormEntity = this.ormRepo.create(ExtensionEntity.fromDomainEntity(data as ExtensionDomainEntity<TConfig>));
    const savedEntity = await this.ormRepo.save(ormEntity);
    return savedEntity.toDomainEntity();
  }

  async find(filter: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>[]> {
    const ormEntities = await this.ormRepo.find({ where: filter as unknown as FindOptionsWhere<ExtensionEntity<TConfig>> });
    const result = ormEntities.map((ormEntity) => ormEntity.toDomainEntity());
    return result;
  }

  async update(data: Partial<ExtensionDomainEntity<TConfig>>): Promise<ExtensionDomainEntity<TConfig>> {
    // Поиск существующей записи по name
    const name = data.name;
    if (!name) throw new Error('Имя расширения для обновления обязательный параметр');

    const existingEntity = await this.ormRepo.findOne({ where: { name } });

    if (!existingEntity) {
      throw new Error('Расширение не найдено в установленных');
    }

    // Обновление только переданных полей
    if (data.enabled !== undefined) existingEntity.enabled = data.enabled;
    if (data.config !== undefined) existingEntity.config = data.config;
    if ((data as any).schema_version !== undefined) existingEntity.schema_version = (data as any).schema_version;

    // Сохранение обновленной записи в базе данных
    await this.ormRepo.save(existingEntity);

    return existingEntity.toDomainEntity();
  }

  async patchConfig(name: string, patch: Partial<TConfig>): Promise<ExtensionDomainEntity<TConfig>> {
    // TypeORM оборачивает .query() для UPDATE/DELETE в кортеж [rows, affectedCount]
    // (в отличие от INSERT, где возвращается голый rows-массив) — распаковываем явно,
    // иначе row оказывается всем кортежем и все поля читаются как undefined.
    const [rows] = (await this.ormRepo.query(
      `UPDATE extensions
          SET config = COALESCE(config, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE name = $1
        RETURNING name, enabled, config, schema_version, created_at, updated_at`,
      [name, JSON.stringify(patch)]
    )) as [
      Array<{
        name: string;
        enabled: boolean;
        config: TConfig;
        schema_version: number;
        created_at: Date;
        updated_at: Date;
      }>,
      number,
    ];

    const row = rows[0];
    if (!row) throw new Error('Расширение не найдено в установленных');

    return new ExtensionDomainEntity<TConfig>(
      row.name,
      row.enabled,
      row.config,
      row.created_at,
      row.updated_at,
      row.schema_version
    );
  }
}
