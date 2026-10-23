import { ObjectType, Field, createUnionType } from '@nestjs/graphql';
import { IsString, IsArray, IsOptional, IsNumber } from 'class-validator';
import { IndividualDTO } from '~/application/common/dto/individual.dto';
import { EntrepreneurDTO } from '~/application/common/dto/entrepreneur.dto';
import { OrganizationDTO } from '~/application/common/dto/organization.dto';
import type { PrivateAccountSearchResultDomainInterface } from '~/domain/common/interfaces/search-private-accounts-domain.interface';
import { DomainError } from '@coopenomics/extension-kit';

// Создаем Union Type для GraphQL
export const PrivateAccountSearchDataUnion = createUnionType({
  name: 'PrivateAccountSearchData',
  types: () => [IndividualDTO, EntrepreneurDTO, OrganizationDTO] as const,
  resolveType: (value) => {
    if (IndividualDTO.isTypeOf(value)) {
      return IndividualDTO;
    }
    if (EntrepreneurDTO.isTypeOf(value)) {
      return EntrepreneurDTO;
    }
    if (OrganizationDTO.isTypeOf(value)) {
      return OrganizationDTO;
    }
    return undefined;
  },
});

@ObjectType('PrivateAccountSearchResult')
export class PrivateAccountSearchResultDTO {
  @Field(() => String, { description: 'Тип аккаунта' })
  @IsString()
  type!: 'individual' | 'entrepreneur' | 'organization';

  @Field(() => PrivateAccountSearchDataUnion, { description: 'Данные найденного аккаунта' })
  data!: IndividualDTO | EntrepreneurDTO | OrganizationDTO;

  @Field(() => Number, { nullable: true, description: 'Оценка релевантности результата' })
  @IsOptional()
  @IsNumber()
  score?: number;

  @Field(() => [String], { nullable: true, description: 'Поля, в которых найдены совпадения' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlightedFields?: string[];

  constructor(entity: PrivateAccountSearchResultDomainInterface) {
    this.type = entity.type;
    this.score = entity.score;
    this.highlightedFields = entity.highlightedFields;

    // Преобразуем доменные данные в соответствующий DTO
    switch (entity.type) {
      case 'individual':
        this.data = new IndividualDTO(entity.data as any);
        break;
      case 'entrepreneur':
        this.data = new EntrepreneurDTO(entity.data as any);
        break;
      case 'organization':
        this.data = new OrganizationDTO(entity.data as any);
        break;
      default:
        throw DomainError.internal('ACCOUNT_UNKNOWN_TYPE', { type: entity.type });
    }
  }
}
