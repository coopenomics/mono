import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { CppRegistryRepository } from '~/domain/cpp-registry/repositories/cpp-registry.repository';
import { CppRegistryEntryDomainEntity } from '~/domain/cpp-registry/entities/cpp-registry-entry.entity';
import { CppRegistryEntryTypeormEntity } from '../entities/cpp-registry-entry.typeorm-entity';

@Injectable()
export class CppRegistryTypeormRepository implements CppRegistryRepository {
  constructor(
    @InjectRepository(CppRegistryEntryTypeormEntity)
    private readonly repo: Repository<CppRegistryEntryTypeormEntity>
  ) {}

  async upsertByExtension(entry: CppRegistryEntryDomainEntity): Promise<CppRegistryEntryDomainEntity> {
    const existing = await this.repo.findOne({
      where: { required_for_extension: entry.required_for_extension },
    });

    if (existing) {
      existing.template_document_registry_id = entry.template_document_registry_id;
      existing.mvp_hardcoded = entry.mvp_hardcoded;
      const saved = await this.repo.save(existing);
      return CppRegistryTypeormRepository.toDomain(saved);
    }

    const created = this.repo.create({
      template_document_registry_id: entry.template_document_registry_id,
      required_for_extension: entry.required_for_extension,
      mvp_hardcoded: entry.mvp_hardcoded,
    });
    const saved = await this.repo.save(created);
    return CppRegistryTypeormRepository.toDomain(saved);
  }

  async findByExtension(extensionName: string): Promise<CppRegistryEntryDomainEntity | null> {
    const row = await this.repo.findOne({ where: { required_for_extension: extensionName } });
    return row ? CppRegistryTypeormRepository.toDomain(row) : null;
  }

  async findAll(): Promise<CppRegistryEntryDomainEntity[]> {
    const rows = await this.repo.find();
    return rows.map(CppRegistryTypeormRepository.toDomain);
  }

  async deleteByExtension(extensionName: string): Promise<boolean> {
    const result = await this.repo.delete({ required_for_extension: extensionName });
    return (result.affected ?? 0) > 0;
  }

  private static toDomain(row: CppRegistryEntryTypeormEntity): CppRegistryEntryDomainEntity {
    return new CppRegistryEntryDomainEntity({
      template_document_registry_id: row.template_document_registry_id,
      required_for_extension: row.required_for_extension,
      mvp_hardcoded: row.mvp_hardcoded,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
}
