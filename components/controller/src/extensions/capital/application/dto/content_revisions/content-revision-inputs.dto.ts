import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ContentEntityType } from '../../../domain/enums/content-entity-type.enum';

@InputType('CapitalGetContentRevisionsInput')
export class GetContentRevisionsInputDTO {
  @Field(() => ContentEntityType, { description: 'Тип сущности: PROJECT, ISSUE, STORY' })
  @IsEnum(ContentEntityType, { message: 'Неверный тип сущности' })
  entity_type!: ContentEntityType;

  @Field(() => String, { description: 'Хэш сущности' })
  @IsNotEmpty({ message: 'Хэш сущности не должен быть пустым' })
  @IsString({ message: 'Хэш сущности должен быть строкой' })
  entity_hash!: string;
}

@InputType('CapitalGetContentRevisionInput')
export class GetContentRevisionInputDTO extends GetContentRevisionsInputDTO {
  @Field(() => Int, { description: 'Номер редакции' })
  @IsInt({ message: 'Номер редакции должен быть целым' })
  @Min(1, { message: 'Номер редакции начинается с 1' })
  rev!: number;
}

@InputType('CapitalRestoreContentRevisionInput')
export class RestoreContentRevisionInputDTO extends GetContentRevisionInputDTO {
  @Field(() => Int, {
    description: 'Текущая редакция, которую видел пользователь (base_rev): откат сливается с параллельными правками как обычная запись',
  })
  @IsInt({ message: 'base_rev должен быть целым' })
  @Min(1, { message: 'base_rev начинается с 1' })
  base_rev!: number;
}
