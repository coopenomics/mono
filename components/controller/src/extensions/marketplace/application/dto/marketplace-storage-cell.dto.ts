import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { MarketplaceStorageCellDomainEntity } from '../../domain/entities/marketplace-storage-cell.entity';

@ObjectType('MarketplaceStorageCell')
export class MarketplaceStorageCellDTO {
  @Field(() => String, { description: 'Идентификатор ячейки хранения.' })
  id!: string;

  @Field(() => String, { description: 'Кооперативный участок, на складе которого стоит ячейка.' })
  braname!: string;

  @Field(() => String, { description: 'Секция склада — координата по горизонтали.' })
  section!: string;

  @Field(() => Int, { description: 'Ярус — координата по вертикали, нумерация с 1.' })
  level!: number;

  @Field(() => String, { description: 'Адрес ячейки, например «A-02».' })
  code!: string;

  @Field(() => String, { nullable: true, description: 'Подпись ячейки, если оператор её задал.' })
  label!: string | null;

  @Field(() => Boolean, { description: 'Ячейка в обороте и предлагается при размещении.' })
  is_active!: boolean;
}

export function toMarketplaceStorageCellDTO(
  cell: MarketplaceStorageCellDomainEntity
): MarketplaceStorageCellDTO {
  return {
    id: cell.id,
    braname: cell.braname,
    section: cell.section,
    level: cell.level,
    code: cell.code,
    label: cell.label,
    is_active: cell.is_active,
  };
}

@InputType('MarketplaceCreateStorageCellInput')
export class MarketplaceCreateStorageCellInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, на складе которого заводится ячейка.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Секция склада.' })
  @IsString()
  @IsNotEmpty()
  section!: string;

  @Field(() => Int, { description: 'Ярус.' })
  @IsInt()
  @Min(1)
  level!: number;

  @Field(() => String, { nullable: true, description: 'Подпись ячейки.' })
  @IsOptional()
  @IsString()
  label?: string | null;
}

@InputType('MarketplaceCreateStorageGridInput')
export class MarketplaceCreateStorageGridInputDTO {
  @Field(() => String, { description: 'Кооперативный участок, на складе которого заводится сетка.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => [String], { description: 'Секции склада, например «A», «B», «Холодильник».' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sections!: string[];

  @Field(() => Int, { description: 'Первый ярус диапазона.' })
  @IsInt()
  @Min(1)
  level_from!: number;

  @Field(() => Int, { description: 'Последний ярус диапазона включительно.' })
  @IsInt()
  @Min(1)
  level_to!: number;
}

@InputType('MarketplaceUpdateStorageCellInput')
export class MarketplaceUpdateStorageCellInputDTO {
  @Field(() => String, { description: 'Ячейка, которую правят.' })
  @IsString()
  @IsNotEmpty()
  cell_id!: string;

  @Field(() => String, { nullable: true, description: 'Новая подпись ячейки.' })
  @IsOptional()
  @IsString()
  label?: string | null;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Оставить ячейку в обороте. Вывести можно только пустую ячейку.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

@InputType('MarketplaceListStorageCellsInput')
export class MarketplaceListStorageCellsInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Кооперативный участок. Не указан — все доступные участки.',
  })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Только ячейки в обороте. Не указано — вместе с выведенными.',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
