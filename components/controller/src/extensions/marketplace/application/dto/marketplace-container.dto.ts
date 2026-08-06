import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import type {
  MarketplaceContainerDomainEntity,
  MarketplaceContainerTypeDomainEntity,
} from '../../domain/entities/marketplace-container.entity';

@ObjectType('MarketplaceContainerType')
export class MarketplaceContainerTypeDTO {
  @Field(() => String, { description: 'Идентификатор типа боксов.' })
  id!: string;

  @Field(() => String, { description: 'Название типа, например «Ящик 600×400×300».' })
  name!: string;

  @Field(() => Int, { description: 'Длина в сантиметрах.' })
  length_cm!: number;

  @Field(() => Int, { description: 'Ширина в сантиметрах.' })
  width_cm!: number;

  @Field(() => Int, { description: 'Высота в сантиметрах.' })
  height_cm!: number;

  @Field(() => String, { description: 'Полезный объём в кубометрах.' })
  volume_m3!: string;

  @Field(() => String, { nullable: true, description: 'Предельная загрузка в килограммах.' })
  max_weight_kg!: string | null;

  @Field(() => Boolean, { description: 'Тип в обороте и предлагается при заведении боксов.' })
  is_active!: boolean;
}

export function toMarketplaceContainerTypeDTO(
  type: MarketplaceContainerTypeDomainEntity
): MarketplaceContainerTypeDTO {
  return {
    id: type.id,
    name: type.name,
    length_cm: type.length_cm,
    width_cm: type.width_cm,
    height_cm: type.height_cm,
    volume_m3: type.volume_m3,
    max_weight_kg: type.max_weight_kg,
    is_active: type.is_active,
  };
}

@ObjectType('MarketplaceContainer')
export class MarketplaceContainerDTO {
  @Field(() => String, { description: 'Идентификатор бокса.' })
  id!: string;

  @Field(() => String, { description: 'Кооперативный участок, за которым числится бокс.' })
  braname!: string;

  @Field(() => String, { description: 'Код бокса — он же напечатан на этикетке и закодирован в QR.' })
  code!: string;

  @Field(() => String, { nullable: true, description: 'Подпись бокса, если оператор её задал.' })
  label!: string | null;

  @Field(() => String, { description: 'Тип боксов, задающий габариты и объём.' })
  container_type_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ячейка, в которой стоит бокс. Пусто — бокс не размещён, и это допустимо.',
  })
  cell_id!: string | null;

  @Field(() => Boolean, { description: 'Бокс в обороте и предлагается при размещении.' })
  is_active!: boolean;
}

export function toMarketplaceContainerDTO(
  container: MarketplaceContainerDomainEntity
): MarketplaceContainerDTO {
  return {
    id: container.id,
    braname: container.braname,
    code: container.code,
    label: container.label,
    container_type_id: container.container_type_id,
    cell_id: container.cell_id,
    is_active: container.is_active,
  };
}

@InputType('MarketplaceCreateContainerTypeInput')
export class MarketplaceCreateContainerTypeInputDTO {
  @Field(() => String, { description: 'Название типа боксов.' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Field(() => Int, { description: 'Длина в сантиметрах.' })
  @IsInt()
  @Min(1)
  length_cm!: number;

  @Field(() => Int, { description: 'Ширина в сантиметрах.' })
  @IsInt()
  @Min(1)
  width_cm!: number;

  @Field(() => Int, { description: 'Высота в сантиметрах.' })
  @IsInt()
  @Min(1)
  height_cm!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Полезный объём в кубометрах. Не указан — считается из габаритов.',
  })
  @IsOptional()
  @IsString()
  volume_m3?: string | null;

  @Field(() => String, { nullable: true, description: 'Предельная загрузка в килограммах.' })
  @IsOptional()
  @IsString()
  max_weight_kg?: string | null;
}

@InputType('MarketplaceCreateContainersInput')
export class MarketplaceCreateContainersInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, за которым закрепляются боксы.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Тип боксов.' })
  @IsString()
  @IsNotEmpty()
  container_type_id!: string;

  @Field(() => Int, { description: 'Сколько боксов завести.' })
  @IsInt()
  @Min(1)
  count!: number;

  @Field(() => String, { nullable: true, description: 'Общая подпись для всей партии.' })
  @IsOptional()
  @IsString()
  label?: string | null;
}

@InputType('MarketplaceMoveContainerInput')
export class MarketplaceMoveContainerInputDTO {
  @Field(() => String, { description: 'Бокс, который переставляют.' })
  @IsString()
  @IsNotEmpty()
  container_id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ячейка назначения. Пусто — снять бокс с адреса.',
  })
  @IsOptional()
  @IsString()
  cell_id?: string | null;
}

@InputType('MarketplaceUpdateContainerInput')
export class MarketplaceUpdateContainerInputDTO {
  @Field(() => String, { description: 'Бокс, который правят.' })
  @IsString()
  @IsNotEmpty()
  container_id!: string;

  @Field(() => String, { nullable: true, description: 'Новая подпись бокса.' })
  @IsOptional()
  @IsString()
  label?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Оставить бокс в обороте. Вывести можно только пустой бокс.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

@InputType('MarketplaceListContainersInput')
export class MarketplaceListContainersInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок. Не указан — все доступные участки.',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Только боксы в обороте. Не указано — вместе с выведенными.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @Field(() => String, { nullable: true, description: 'Фильтр по типу боксов.' })
  @IsOptional()
  @IsString()
  container_type_id?: string;

  @Field(() => Boolean, { nullable: true, description: 'Только боксы без адреса.' })
  @IsOptional()
  @IsBoolean()
  unplaced_only?: boolean;
}

@InputType('MarketplaceResolveContainerByCodeInput')
export class MarketplaceResolveContainerByCodeInputDTO {
  @Field(() => String, { description: 'Код бокса с этикетки или из отсканированного QR.' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
