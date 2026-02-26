import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { DictionaryDomainRepository } from '../../domain/repositories/dictionary-domain.repository';
import { DictionaryDomainEntity } from '../../domain/entities/dictionary-domain.entity';
import { DictionaryEntity } from '../entities/dictionary.entity';
import { DictionaryMapper } from '../mappers/dictionary.mapper';

@Injectable()
export class DictionaryRepositoryAdapter implements DictionaryDomainRepository {
  constructor(
    @InjectRepository(DictionaryEntity, 'marketplace')
    private readonly dictionaryRepository: Repository<DictionaryEntity>
  ) {}

  async findAll(): Promise<DictionaryDomainEntity[]> {
    const dictionaries = await this.dictionaryRepository.find({
      relations: ['values', 'attributes'],
    });
    return dictionaries.map((dict) => DictionaryMapper.toDomain(dict));
  }

  async findById(id: number): Promise<DictionaryDomainEntity | null> {
    const dictionary = await this.dictionaryRepository.findOne({
      where: { dictionaryId: id },
      relations: ['values', 'attributes'],
    });
    return dictionary ? DictionaryMapper.toDomain(dictionary) : null;
  }

  async findWithValues(): Promise<DictionaryDomainEntity[]> {
    const dictionaries = await this.dictionaryRepository.find({
      relations: ['values'],
      order: { dictionaryId: 'ASC' },
    });
    return dictionaries.map((dict) => DictionaryMapper.toDomain(dict));
  }

  async findByName(name: string): Promise<DictionaryDomainEntity[]> {
    const dictionaries = await this.dictionaryRepository.find({
      where: { name },
      relations: ['values'],
    });
    return dictionaries.map((dict) => DictionaryMapper.toDomain(dict));
  }

  async save(dictionary: DictionaryDomainEntity): Promise<DictionaryDomainEntity> {
    const entity = DictionaryMapper.toEntity(dictionary);
    const saved = await this.dictionaryRepository.save(entity);
    return DictionaryMapper.toDomain(saved);
  }

  async saveMany(dictionaries: DictionaryDomainEntity[]): Promise<DictionaryDomainEntity[]> {
    const entities = dictionaries.map((dict) => DictionaryMapper.toEntity(dict));
    const saved = await this.dictionaryRepository.save(entities);
    return saved.map((dict) => DictionaryMapper.toDomain(dict));
  }

  async upsert(dictionaryData: Partial<DictionaryDomainEntity>): Promise<DictionaryDomainEntity> {
    const existing = await this.dictionaryRepository.findOne({
      where: { dictionaryId: dictionaryData.dictionaryId },
    });

    if (existing) {
      Object.assign(existing, dictionaryData);
      const saved = await this.dictionaryRepository.save(existing);
      return DictionaryMapper.toDomain(saved);
    } else {
      const entity = this.dictionaryRepository.create(dictionaryData);
      const saved = await this.dictionaryRepository.save(entity);
      return DictionaryMapper.toDomain(saved);
    }
  }

  async count(): Promise<number> {
    return this.dictionaryRepository.count();
  }

  async findWithMinValuesCount(minCount: number): Promise<DictionaryDomainEntity[]> {
    const dictionaries = await this.dictionaryRepository
      .createQueryBuilder('dictionary')
      .leftJoinAndSelect('dictionary.values', 'values')
      .groupBy('dictionary.dictionaryId')
      .having('COUNT(values.dictionaryValueId) >= :minCount', { minCount })
      .getMany();

    return dictionaries.map((dict) => DictionaryMapper.toDomain(dict));
  }

  async findByIds(ids: number[]): Promise<DictionaryDomainEntity[]> {
    const dictionaries = await this.dictionaryRepository.find({
      where: { dictionaryId: In(ids) },
      relations: ['values'],
    });
    return dictionaries.map((dict) => DictionaryMapper.toDomain(dict));
  }
}
