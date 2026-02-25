import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKeyEntity } from './api-key.entity';

export interface CreateApiKeyInput {
  coopname: string;
  name: string;
  createdBy: string;
  allowedOperations?: string[];
  expiresInDays?: number;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  allowed_operations: string[];
  expires_at?: Date;
  created_at: Date;
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  async createKey(input: CreateApiKeyInput): Promise<ApiKeyCreateResult> {
    const rawKey = `ck_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 10);

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const entity = this.repo.create({
      coopname: input.coopname,
      name: input.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      created_by: input.createdBy,
      allowed_operations: input.allowedOperations || ['*'],
      expires_at: expiresAt,
      is_active: true,
    });

    const saved = await this.repo.save(entity);

    return {
      id: saved.id,
      name: saved.name,
      key: rawKey,
      key_prefix: keyPrefix,
      allowed_operations: saved.allowed_operations,
      expires_at: saved.expires_at,
      created_at: saved.created_at,
    };
  }

  async validateKey(rawKey: string): Promise<ApiKeyEntity | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const entity = await this.repo.findOneBy({ key_hash: keyHash, is_active: true });

    if (!entity) return null;
    if (entity.expires_at && entity.expires_at < new Date()) return null;

    entity.last_used_at = new Date();
    await this.repo.save(entity);

    return entity;
  }

  async listKeys(coopname: string): Promise<ApiKeyEntity[]> {
    return this.repo.find({
      where: { coopname },
      order: { created_at: 'DESC' },
    });
  }

  async revokeKey(id: string, revokedBy: string): Promise<void> {
    const entity = await this.repo.findOneBy({ id, created_by: revokedBy });
    if (entity) {
      entity.is_active = false;
      await this.repo.save(entity);
    }
  }

  isOperationAllowed(entity: ApiKeyEntity, operation: string): boolean {
    if (entity.allowed_operations.includes('*')) return true;
    return entity.allowed_operations.includes(operation);
  }
}
