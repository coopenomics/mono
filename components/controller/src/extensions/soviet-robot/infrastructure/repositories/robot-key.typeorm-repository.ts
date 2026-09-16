import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RobotKeyTypeormEntity } from '../entities/robot-key-typeorm.entity';
import type { RobotKeyDomainEntity } from '../../domain/entities/robot-key.entity';
import type { RobotKeyRepository, RobotKeyUpsert } from '../../domain/repositories/robot-key.repository';

@Injectable()
export class RobotKeyTypeormRepository implements RobotKeyRepository {
  constructor(
    @InjectRepository(RobotKeyTypeormEntity)
    private readonly repository: Repository<RobotKeyTypeormEntity>
  ) {}

  async findByMember(coopname: string, member: string): Promise<RobotKeyDomainEntity | null> {
    return this.repository.findOne({ where: { coopname, member } });
  }

  async findAll(coopname: string): Promise<RobotKeyDomainEntity[]> {
    return this.repository.find({ where: { coopname } });
  }

  async upsert(data: RobotKeyUpsert): Promise<RobotKeyDomainEntity> {
    const existing = await this.findByMember(data.coopname, data.member);
    if (existing) {
      return this.repository.save({ ...existing, ...data });
    }
    return this.repository.save(this.repository.create(data));
  }

  async deleteByMember(coopname: string, member: string): Promise<boolean> {
    const result = await this.repository.delete({ coopname, member });
    return (result.affected ?? 0) > 0;
  }
}
