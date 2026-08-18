import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetPreEntity } from '../entities/meet-pre.entity';
import { MeetRepository } from '~/domain/meet/repositories/meet-pre.repository';
import { MeetPreProcessingDomainEntity } from '~/domain/meet/entities/meet-pre-domain.entity';
import httpStatus from 'http-status';
import { HttpApiError } from '@coopenomics/extension-kit';

@Injectable()
export class TypeOrmMeetRepository implements MeetRepository {
  constructor(
    @InjectRepository(MeetPreEntity)
    private readonly meetPreRepo: Repository<MeetPreEntity>
  ) {}

  async findByHash(hash: string): Promise<MeetPreProcessingDomainEntity | null> {
    const upperHash = hash.toUpperCase();
    const ormEntity = await this.meetPreRepo.findOne({ where: { hash: upperHash } });

    if (!ormEntity) {
      return null;
    }

    return ormEntity.toDomainEntity();
  }

  async create(data: MeetPreProcessingDomainEntity): Promise<void> {
    const ormEntity = MeetPreEntity.fromDomainEntity({
      ...data,
      hash: data.hash.toUpperCase(),
    });
    await this.meetPreRepo.save(ormEntity);
  }
}
