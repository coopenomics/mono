import { Injectable, Inject, Logger } from '@nestjs/common';
import { VOTE_COPY_SETTING_REPOSITORY, type VoteCopySettingRepository } from '../repositories/vote-copy-setting.repository';
import type { VoteCopySettingEntity } from '../entities/vote-copy-setting.entity';
import { config } from '~/config';

@Injectable()
export class VoteCopyService {
  private readonly logger = new Logger(VoteCopyService.name);

  constructor(
    @Inject(VOTE_COPY_SETTING_REPOSITORY)
    private readonly settingsRepo: VoteCopySettingRepository,
  ) {}

  async createSetting(copierUsername: string, sourceUsername: string, decisionTypes: string[] = []): Promise<VoteCopySettingEntity> {
    if (copierUsername === sourceUsername) {
      throw new Error('Нельзя копировать собственный голос');
    }

    const existing = await this.settingsRepo.findByCopier(config.coopname, copierUsername);
    const duplicate = existing.find(s => s.source_username === sourceUsername && s.is_active);
    if (duplicate) {
      throw new Error('Копирование голоса этого члена совета уже настроено');
    }

    return this.settingsRepo.create({
      coopname: config.coopname,
      copier_username: copierUsername,
      source_username: sourceUsername,
      decision_types: decisionTypes,
      is_active: true,
    });
  }

  async deactivate(id: string, username: string): Promise<VoteCopySettingEntity> {
    const setting = await this.settingsRepo.findById(id);
    if (!setting) throw new Error('Настройка не найдена');
    if (setting.copier_username !== username) throw new Error('Нет доступа');
    return this.settingsRepo.update(id, { is_active: false });
  }

  async deleteSetting(id: string, username: string): Promise<void> {
    const setting = await this.settingsRepo.findById(id);
    if (!setting) throw new Error('Настройка не найдена');
    if (setting.copier_username !== username) throw new Error('Нет доступа');
    await this.settingsRepo.delete(id);
  }

  async getMySettings(username: string): Promise<VoteCopySettingEntity[]> {
    return this.settingsRepo.findByCopier(config.coopname, username);
  }

  async getWhoCopiesToMe(username: string): Promise<VoteCopySettingEntity[]> {
    return this.settingsRepo.findBySource(config.coopname, username);
  }

  async getAllSettings(): Promise<VoteCopySettingEntity[]> {
    return this.settingsRepo.findAll(config.coopname);
  }

  /**
   * Найти всех копирующих конкретного члена совета.
   * Вызывается при событии голосования source_username.
   */
  async findActiveCopiers(sourceUsername: string): Promise<VoteCopySettingEntity[]> {
    const all = await this.settingsRepo.findBySource(config.coopname, sourceUsername);
    return all.filter(s => s.is_active);
  }
}
