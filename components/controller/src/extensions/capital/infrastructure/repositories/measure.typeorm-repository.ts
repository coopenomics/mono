import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MeasureRepository } from '../../domain/repositories/measure.repository';
import { MeasureDomainEntity } from '../../domain/entities/measure.entity';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { MeasureTypeormEntity } from '../entities/measure.typeorm-entity';
import { MeasureMapper } from '../mappers/measure.mapper';

@Injectable()
export class MeasureTypeormRepository implements MeasureRepository {
  constructor(
    @InjectRepository(MeasureTypeormEntity)
    private readonly repo: Repository<MeasureTypeormEntity>
  ) {}

  async create(measure: MeasureDomainEntity): Promise<MeasureDomainEntity> {
    const entity = this.repo.create(MeasureMapper.toEntity(measure));
    const saved = await this.repo.save(entity);
    return MeasureMapper.toDomain(saved);
  }

  async findByMeasureHash(measureHash: string): Promise<MeasureDomainEntity | null> {
    const entity = await this.repo.findOne({
      where: { measure_hash: measureHash.toLowerCase() },
    });
    return entity ? MeasureMapper.toDomain(entity) : null;
  }

  async findByCoopnameAndTitleUnit(
    coopname: string,
    title: string,
    unit: string,
    status?: MetricStatus
  ): Promise<MeasureDomainEntity | null> {
    const where: {
      coopname: string;
      title: string;
      unit: string;
      status?: MetricStatus;
    } = {
      coopname,
      title: title.trim(),
      unit: unit.trim(),
    };
    if (status) {
      where.status = status;
    }
    const entity = await this.repo.findOne({ where });
    return entity ? MeasureMapper.toDomain(entity) : null;
  }

  async findByCoopname(
    coopname: string,
    status?: MetricStatus
  ): Promise<MeasureDomainEntity[]> {
    const where: { coopname: string; status?: MetricStatus } = { coopname };
    if (status) {
      where.status = status;
    }
    const entities = await this.repo.find({
      where,
      order: { title: 'ASC' },
    });
    return entities.map(MeasureMapper.toDomain);
  }

  async findByMeasureHashes(measureHashes: string[]): Promise<MeasureDomainEntity[]> {
    if (measureHashes.length === 0) return [];
    const normalized = measureHashes.map((h) => h.toLowerCase());
    const entities = await this.repo.find({
      where: { measure_hash: In(normalized) },
    });
    return entities.map(MeasureMapper.toDomain);
  }

  async update(measure: MeasureDomainEntity): Promise<MeasureDomainEntity> {
    await this.repo.save(MeasureMapper.toEntity(measure));
    const updated = await this.repo.findOne({ where: { _id: measure._id } });
    if (!updated) {
      throw new Error(`Мера ${measure.measure_hash} не найдена после обновления`);
    }
    return MeasureMapper.toDomain(updated);
  }
}
