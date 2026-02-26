import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { GitHubFileIndexRepository, IGitHubFileIndexData } from '../../domain/repositories/github-file-index.repository';
import { GitHubFileIndexTypeormEntity } from '../entities/github-file-index.typeorm-entity';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';

/**
 * TypeORM реализация репозитория индекса файлов GitHub
 */
@Injectable()
export class GitHubFileIndexTypeormRepository implements GitHubFileIndexRepository {
  constructor(
    @InjectRepository(GitHubFileIndexTypeormEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly repository: Repository<GitHubFileIndexTypeormEntity>
  ) {}

  async findByHash(entityType: string, entityHash: string, coopname: string): Promise<IGitHubFileIndexData | null> {
    const entity = await this.repository.findOne({
      where: {
        coopname,
        entity_type: entityType as any,
        entity_hash: entityHash.toLowerCase(),
      },
    });
    return entity || null;
  }

  async findByPath(filePath: string, coopname: string): Promise<IGitHubFileIndexData | null> {
    const entity = await this.repository.findOne({
      where: {
        coopname,
        file_path: filePath,
      },
    });
    return entity || null;
  }

  async upsert(data: IGitHubFileIndexData): Promise<IGitHubFileIndexData> {
    // Ищем существующую запись
    const existing = await this.findByHash(data.entity_type, data.entity_hash, data.coopname);

    if (existing) {
      // Обновляем существующую запись
      await this.repository.update(
        { id: existing.id },
        {
          file_path: data.file_path,
          github_sha: data.github_sha,
          last_synced_at: new Date(),
        }
      );
      return {
        ...existing,
        file_path: data.file_path,
        github_sha: data.github_sha,
        last_synced_at: new Date(),
      };
    } else {
      // Создаём новую запись
      const entity = this.repository.create({
        ...data,
        entity_hash: data.entity_hash.toLowerCase(),
        last_synced_at: new Date(),
      });
      const saved = await this.repository.save(entity);
      return saved;
    }
  }

  async deleteByHash(entityType: string, entityHash: string, coopname: string): Promise<void> {
    await this.repository.delete({
      coopname,
      entity_type: entityType as any,
      entity_hash: entityHash.toLowerCase(),
    });
  }

  async getAllIndexes(coopname: string): Promise<IGitHubFileIndexData[]> {
    return await this.repository.find({
      where: { coopname },
    });
  }

  async getLastSyncedSha(coopname: string): Promise<string | null> {
    const result = await this.repository.findOne({
      where: { coopname },
      order: { last_synced_at: 'DESC' },
    });
    return result?.github_sha || null;
  }
}
