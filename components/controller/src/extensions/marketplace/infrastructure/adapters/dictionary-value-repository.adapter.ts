import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { DictionaryValueDomainRepository } from '../../domain/repositories/dictionary-value-domain.repository';
import { DictionaryValueDomainEntity } from '../../domain/entities/dictionary-value-domain.entity';
import { DictionaryValueEntity } from '../entities/dictionary-value.entity';
import { DictionaryValueMapper } from '../mappers/dictionary-value.mapper';

@Injectable()
export class DictionaryValueRepositoryAdapter implements DictionaryValueDomainRepository {
  constructor(
    @InjectRepository(DictionaryValueEntity, 'marketplace')
    private readonly dictionaryValueRepository: Repository<DictionaryValueEntity>
  ) {}

  async findAll(): Promise<DictionaryValueDomainEntity[]> {
    const values = await this.dictionaryValueRepository.find({
      relations: ['dictionary'],
    });
    return values.map((value) => DictionaryValueMapper.toDomain(value));
  }

  async findById(id: number): Promise<DictionaryValueDomainEntity | null> {
    const value = await this.dictionaryValueRepository.findOne({
      where: { dictionaryValueId: id },
      relations: ['dictionary'],
    });
    return value ? DictionaryValueMapper.toDomain(value) : null;
  }

  async findByDictionaryId(dictionaryId: number): Promise<DictionaryValueDomainEntity[]> {
    const values = await this.dictionaryValueRepository.find({
      where: { dictionaryId },
      relations: ['dictionary'],
    });
    return values.map((value) => DictionaryValueMapper.toDomain(value));
  }

  async findByValue(value: string): Promise<DictionaryValueDomainEntity[]> {
    const values = await this.dictionaryValueRepository.find({
      where: { value },
      relations: ['dictionary'],
    });
    return values.map((val) => DictionaryValueMapper.toDomain(val));
  }

  async findWithPictures(): Promise<DictionaryValueDomainEntity[]> {
    const values = await this.dictionaryValueRepository.find({
      where: { picture: Not(IsNull()) },
      relations: ['dictionary'],
    });
    return values.map((value) => DictionaryValueMapper.toDomain(value));
  }

  async searchByText(searchText: string, dictionaryId?: number): Promise<DictionaryValueDomainEntity[]> {
    const query = this.dictionaryValueRepository
      .createQueryBuilder('value')
      .leftJoinAndSelect('value.dictionary', 'dictionary')
      .where('(value.value ILIKE :searchText OR value.info ILIKE :searchText)', { searchText: `%${searchText}%` });

    if (dictionaryId) {
      query.andWhere('value.dictionaryId = :dictionaryId', { dictionaryId });
    }

    const values = await query.getMany();
    return values.map((value) => DictionaryValueMapper.toDomain(value));
  }

  async save(value: DictionaryValueDomainEntity): Promise<DictionaryValueDomainEntity> {
    const entity = DictionaryValueMapper.toEntity(value);
    const saved = await this.dictionaryValueRepository.save(entity);
    return DictionaryValueMapper.toDomain(saved);
  }

  async saveMany(values: DictionaryValueDomainEntity[]): Promise<DictionaryValueDomainEntity[]> {
    const entities = values.map((value) => DictionaryValueMapper.toEntity(value));
    const saved = await this.dictionaryValueRepository.save(entities);
    return saved.map((value) => DictionaryValueMapper.toDomain(value));
  }

  async upsert(valueData: Partial<DictionaryValueDomainEntity>): Promise<DictionaryValueDomainEntity> {
    const existing = await this.dictionaryValueRepository.findOne({
      where: { dictionaryValueId: valueData.dictionaryValueId },
    });

    if (existing) {
      Object.assign(existing, valueData);
      const saved = await this.dictionaryValueRepository.save(existing);
      return DictionaryValueMapper.toDomain(saved);
    } else {
      const entity = this.dictionaryValueRepository.create(valueData);
      const saved = await this.dictionaryValueRepository.save(entity);
      return DictionaryValueMapper.toDomain(saved);
    }
  }

  async count(): Promise<number> {
    return this.dictionaryValueRepository.count();
  }

  async countByDictionaryId(dictionaryId: number): Promise<number> {
    return this.dictionaryValueRepository.count({
      where: { dictionaryId },
    });
  }

  async findByDictionaryIdWithPagination(
    dictionaryId: number,
    offset: number,
    limit: number
  ): Promise<{
    items: DictionaryValueDomainEntity[];
    total: number;
  }> {
    const [values, total] = await this.dictionaryValueRepository.findAndCount({
      where: { dictionaryId },
      relations: ['dictionary'],
      skip: offset,
      take: limit,
      order: { value: 'ASC' },
    });

    return {
      items: values.map((value) => DictionaryValueMapper.toDomain(value)),
      total,
    };
  }
}
