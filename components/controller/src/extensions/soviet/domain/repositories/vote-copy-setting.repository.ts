import type { VoteCopySettingEntity } from '../entities/vote-copy-setting.entity';

export interface VoteCopySettingRepository {
  create(setting: Partial<VoteCopySettingEntity>): Promise<VoteCopySettingEntity>;
  findById(id: string): Promise<VoteCopySettingEntity | null>;
  findByCopier(coopname: string, copierUsername: string): Promise<VoteCopySettingEntity[]>;
  findBySource(coopname: string, sourceUsername: string): Promise<VoteCopySettingEntity[]>;
  findAll(coopname: string): Promise<VoteCopySettingEntity[]>;
  update(id: string, data: Partial<VoteCopySettingEntity>): Promise<VoteCopySettingEntity>;
  delete(id: string): Promise<void>;
}

export const VOTE_COPY_SETTING_REPOSITORY = Symbol('VoteCopySettingRepository');
