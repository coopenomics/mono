import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TypeDomainRepository } from '../../domain/repositories/type-domain.repository';
import { TypeDomainEntity } from '../../domain/entities/type-domain.entity';
import { TypeEntity } from '../entities/type.entity';
import { TypeMapper } from '../mappers/type.mapper';

@Injectable()
export class TypeRepositoryAdapter implements TypeDomainRepository {
  constructor(
    @InjectRepository(TypeEntity, 'marketplace')
    private readonly typeRepository: Repository<TypeEntity>
  ) {}

  async findAll(): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository.find({
      relations: ['category', 'categoryTypeAttributes'],
    });
    return types.map((type) => TypeMapper.toDomain(type));
  }

  async findById(id: number): Promise<TypeDomainEntity | null> {
    const type = await this.typeRepository.findOne({
      where: { typeId: id },
      relations: ['category', 'categoryTypeAttributes'],
    });
    return type ? TypeMapper.toDomain(type) : null;
  }

  async findByCategoryId(categoryId: number): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository.find({
      where: { descriptionCategoryId: categoryId },
      relations: ['category'],
    });
    return types.map((type) => TypeMapper.toDomain(type));
  }

  async findAvailable(): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository.find({
      where: { disabled: false },
      relations: ['category'],
    });
    return types.map((type) => TypeMapper.toDomain(type));
  }

  async findByName(name: string): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository
      .createQueryBuilder('type')
      .leftJoinAndSelect('type.category', 'category')
      .where('type.typeName ILIKE :name', { name: `%${name}%` })
      .getMany();
    return types.map((type) => TypeMapper.toDomain(type));
  }

  async save(type: TypeDomainEntity): Promise<TypeDomainEntity> {
    const entity = TypeMapper.toEntity(type);
    const saved = await this.typeRepository.save(entity);
    return TypeMapper.toDomain(saved);
  }

  async saveMany(types: TypeDomainEntity[]): Promise<TypeDomainEntity[]> {
    const entities = types.map((type) => TypeMapper.toEntity(type));
    const saved = await this.typeRepository.save(entities);
    return saved.map((type) => TypeMapper.toDomain(type));
  }

  async upsert(typeData: Partial<TypeDomainEntity>): Promise<TypeDomainEntity> {
    const existing = await this.typeRepository.findOne({
      where: { typeId: typeData.typeId },
    });

    if (existing) {
      Object.assign(existing, typeData);
      const saved = await this.typeRepository.save(existing);
      return TypeMapper.toDomain(saved);
    } else {
      const entity = this.typeRepository.create(typeData);
      const saved = await this.typeRepository.save(entity);
      return TypeMapper.toDomain(saved);
    }
  }

  async count(): Promise<number> {
    return this.typeRepository.count();
  }

  async findWithAttributes(): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository.find({
      relations: ['category', 'categoryTypeAttributes', 'categoryTypeAttributes.attribute'],
    });
    return types.map((type) => TypeMapper.toDomain(type));
  }

  async findByCategoryIdWithAttributes(categoryId: number): Promise<TypeDomainEntity[]> {
    const types = await this.typeRepository.find({
      where: { descriptionCategoryId: categoryId },
      relations: ['category', 'categoryTypeAttributes', 'categoryTypeAttributes.attribute'],
    });
    return types.map((type) => TypeMapper.toDomain(type));
  }
}
