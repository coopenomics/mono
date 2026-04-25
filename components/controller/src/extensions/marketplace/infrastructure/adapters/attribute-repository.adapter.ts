import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { AttributeDomainRepository } from '../../domain/repositories/attribute-domain.repository';
import { AttributeDomainEntity } from '../../domain/entities/attribute-domain.entity';
import { AttributeEntity } from '../entities/attribute.entity';
import { AttributeMapper } from '../mappers/attribute.mapper';

@Injectable()
export class AttributeRepositoryAdapter implements AttributeDomainRepository {
  constructor(
    @InjectRepository(AttributeEntity, 'marketplace')
    private readonly attributeRepository: Repository<AttributeEntity>
  ) {}

  async findAll(): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      relations: ['dictionary', 'categoryTypeAttributes'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findById(id: number): Promise<AttributeDomainEntity | null> {
    const attribute = await this.attributeRepository.findOne({
      where: { attributeId: id },
      relations: ['dictionary', 'categoryTypeAttributes'],
    });
    return attribute ? AttributeMapper.toDomain(attribute) : null;
  }

  async findByDictionaryId(dictionaryId: number): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { dictionaryId },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findWithDictionary(): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { dictionaryId: Not(IsNull()) },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findByType(type: string): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { type },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findRequired(): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { isRequired: true },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findAspect(): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { isAspect: true },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findByGroup(groupId: number): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { groupId },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async findByCategoryAndType(categoryId: number, typeId: number): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository
      .createQueryBuilder('attribute')
      .leftJoinAndSelect('attribute.dictionary', 'dictionary')
      .innerJoin('attribute.categoryTypeAttributes', 'cta')
      .where('cta.descriptionCategoryId = :categoryId', { categoryId })
      .andWhere('cta.typeId = :typeId', { typeId })
      .getMany();

    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }

  async save(attribute: AttributeDomainEntity): Promise<AttributeDomainEntity> {
    const entity = AttributeMapper.toEntity(attribute);
    const saved = await this.attributeRepository.save(entity);
    return AttributeMapper.toDomain(saved);
  }

  async saveMany(attributes: AttributeDomainEntity[]): Promise<AttributeDomainEntity[]> {
    const entities = attributes.map((attr) => AttributeMapper.toEntity(attr));
    const saved = await this.attributeRepository.save(entities);
    return saved.map((attr) => AttributeMapper.toDomain(attr));
  }

  async upsert(attributeData: Partial<AttributeDomainEntity>): Promise<AttributeDomainEntity> {
    const existing = await this.attributeRepository.findOne({
      where: { attributeId: attributeData.attributeId },
    });

    if (existing) {
      Object.assign(existing, attributeData);
      const saved = await this.attributeRepository.save(existing);
      return AttributeMapper.toDomain(saved);
    } else {
      const entity = this.attributeRepository.create(attributeData);
      const saved = await this.attributeRepository.save(entity);
      return AttributeMapper.toDomain(saved);
    }
  }

  async count(): Promise<number> {
    return this.attributeRepository.count();
  }

  async findCategoryDependent(): Promise<AttributeDomainEntity[]> {
    const attributes = await this.attributeRepository.find({
      where: { categoryDependent: true },
      relations: ['dictionary'],
    });
    return attributes.map((attr) => AttributeMapper.toDomain(attr));
  }
}
