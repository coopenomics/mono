import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoteCopySettingTypeormEntity } from '../entities/vote-copy-setting.typeorm-entity';
import type { VoteCopySettingRepository } from '../../domain/repositories/vote-copy-setting.repository';
import type { VoteCopySettingEntity } from '../../domain/entities/vote-copy-setting.entity';

@Injectable()
export class VoteCopySettingTypeormRepository implements VoteCopySettingRepository {
  constructor(
    @InjectRepository(VoteCopySettingTypeormEntity)
    private readonly repo: Repository<VoteCopySettingTypeormEntity>,
  ) {}

  async create(setting: Partial<VoteCopySettingEntity>): Promise<VoteCopySettingEntity> {
    const entity = this.repo.create(setting as Partial<VoteCopySettingTypeormEntity>);
    return (await this.repo.save(entity)) as unknown as VoteCopySettingEntity;
  }

  async findById(id: string): Promise<VoteCopySettingEntity | null> {
    return (await this.repo.findOne({ where: { id } })) as unknown as VoteCopySettingEntity | null;
  }

  async findByCopier(coopname: string, copierUsername: string): Promise<VoteCopySettingEntity[]> {
    return (await this.repo.find({ where: { coopname, copier_username: copierUsername } })) as unknown as VoteCopySettingEntity[];
  }

  async findBySource(coopname: string, sourceUsername: string): Promise<VoteCopySettingEntity[]> {
    return (await this.repo.find({ where: { coopname, source_username: sourceUsername } })) as unknown as VoteCopySettingEntity[];
  }

  async findAll(coopname: string): Promise<VoteCopySettingEntity[]> {
    return (await this.repo.find({ where: { coopname }, order: { created_at: 'DESC' } })) as unknown as VoteCopySettingEntity[];
  }

  async update(id: string, data: Partial<VoteCopySettingEntity>): Promise<VoteCopySettingEntity> {
    await this.repo.update(id, data as Partial<VoteCopySettingTypeormEntity>);
    return (await this.findById(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
