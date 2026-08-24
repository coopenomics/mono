import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CooperativeCharterEntity } from '../entities/cooperative-charter.entity';
import type { CooperativeCharterRepository } from '~/domain/cooperative-charter/repositories/cooperative-charter.repository';
import type { ICooperativeCharterDatabaseData } from '~/domain/cooperative-charter/interfaces/cooperative-charter-database.interface';

/**
 * TypeORM-репозиторий уставов кооперативов. БД-only сущность — маппинг
 * симметричный, без доменной логики.
 */
@Injectable()
export class TypeormCooperativeCharterRepository implements CooperativeCharterRepository {
  constructor(
    @InjectRepository(CooperativeCharterEntity)
    private readonly repository: Repository<CooperativeCharterEntity>
  ) {}

  async create(data: ICooperativeCharterDatabaseData): Promise<ICooperativeCharterDatabaseData> {
    const entity = this.repository.create({
      coopname: data.coopname,
      username: data.username,
      checksum_sha256: data.checksum_sha256,
      mime_type: data.mime_type,
      size_bytes: data.size_bytes,
      storage_key: data.storage_key,
      original_filename: data.original_filename ?? null,
      uploaded_by_username: data.uploaded_by_username,
      uploaded_at: data.uploaded_at,
    });
    return this.toDomain(await this.repository.save(entity));
  }

  async findById(id: number): Promise<ICooperativeCharterDatabaseData | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findLatestByUsername(
    coopname: string,
    username: string
  ): Promise<ICooperativeCharterDatabaseData | null> {
    const entity = await this.repository.findOne({
      where: { coopname, username },
      order: { uploaded_at: 'DESC', id: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findLatestForUsernames(
    coopname: string,
    usernames: string[]
  ): Promise<ICooperativeCharterDatabaseData[]> {
    if (usernames.length === 0) return [];
    const entities = await this.repository.find({
      where: { coopname, username: In(usernames) },
      order: { uploaded_at: 'DESC', id: 'DESC' },
    });
    // Реестр показывает по одному — последнему — уставу на кооператив.
    const latest = new Map<string, CooperativeCharterEntity>();
    for (const entity of entities) if (!latest.has(entity.username)) latest.set(entity.username, entity);
    return [...latest.values()].map((e) => this.toDomain(e));
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete({ id });
  }

  private toDomain(entity: CooperativeCharterEntity): ICooperativeCharterDatabaseData {
    return {
      id: entity.id,
      coopname: entity.coopname,
      username: entity.username,
      checksum_sha256: entity.checksum_sha256,
      mime_type: entity.mime_type,
      size_bytes: entity.size_bytes,
      storage_key: entity.storage_key,
      original_filename: entity.original_filename,
      uploaded_by_username: entity.uploaded_by_username,
      uploaded_at: entity.uploaded_at,
    };
  }
}
