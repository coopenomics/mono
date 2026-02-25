import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { ShareTokenEntity, ShareTargetType } from './share-token.entity';
import config from '~/config/config';

export interface CreateShareLinkInput {
  coopname: string;
  createdBy: string;
  pagePath: string;
  pageName: string;
  targetType: ShareTargetType;
  targetUsername?: string;
  linkName?: string;
  allowedActions: string[];
  expiresInDays?: number;
}

export interface ShareTokenPayload {
  shareId: string;
  coopname: string;
  pagePath: string;
  allowedActions: string[];
  targetType: ShareTargetType;
  targetUsername?: string;
}

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    @InjectRepository(ShareTokenEntity)
    private readonly repo: Repository<ShareTokenEntity>,
  ) {}

  async createShareLink(input: CreateShareLinkInput): Promise<ShareTokenEntity> {
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const entity = this.repo.create({
      coopname: input.coopname,
      created_by: input.createdBy,
      page_path: input.pagePath,
      page_name: input.pageName,
      target_type: input.targetType,
      target_username: input.targetUsername,
      link_name: input.linkName,
      allowed_actions: input.allowedActions,
      expires_at: expiresAt,
      is_active: true,
      token: '',
    });

    const saved = await this.repo.save(entity);

    const payload: ShareTokenPayload = {
      shareId: saved.id,
      coopname: input.coopname,
      pagePath: input.pagePath,
      allowedActions: input.allowedActions,
      targetType: input.targetType,
      targetUsername: input.targetUsername,
    };

    saved.token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: input.expiresInDays ? `${input.expiresInDays}d` : '365d',
    });

    return this.repo.save(saved);
  }

  async verifyShareToken(token: string): Promise<ShareTokenPayload | null> {
    try {
      const payload = jwt.verify(token, config.jwt.secret) as ShareTokenPayload;

      const entity = await this.repo.findOneBy({ id: payload.shareId, is_active: true });
      if (!entity) return null;

      if (entity.expires_at && entity.expires_at < new Date()) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  async getShareLinks(coopname: string, createdBy: string): Promise<ShareTokenEntity[]> {
    return this.repo.find({
      where: { coopname, created_by: createdBy, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async getSharedWithMe(coopname: string, username: string): Promise<ShareTokenEntity[]> {
    return this.repo.find({
      where: { coopname, target_username: username, is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async revokeShareLink(id: string, revokedBy: string): Promise<void> {
    const entity = await this.repo.findOneBy({ id, created_by: revokedBy });
    if (entity) {
      entity.is_active = false;
      await this.repo.save(entity);
    }
  }
}
