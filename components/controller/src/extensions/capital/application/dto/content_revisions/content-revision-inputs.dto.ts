import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ContentEntityType } from '../../../domain/enums/content-entity-type.enum';
import { t } from '../../../i18n';

@InputType('CapitalGetContentRevisionsInput')
export class GetContentRevisionsInputDTO {
  @Field(() => ContentEntityType, { description: 'Тип сущности: PROJECT, ISSUE, STORY' })
  @IsEnum(ContentEntityType, { message: t('capital.contentRevisionInputs.entityType.invalid') })
  entity_type!: ContentEntityType;

  @Field(() => String, { description: 'Хэш сущности' })
  @IsNotEmpty({ message: t('capital.contentRevisionInputs.entityHash.required') })
  @IsString({ message: t('capital.contentRevisionInputs.entityHash.string') })
  entity_hash!: string;
}

@InputType('CapitalGetContentRevisionInput')
export class GetContentRevisionInputDTO extends GetContentRevisionsInputDTO {
  @Field(() => Int, { description: 'Номер редакции' })
  @IsInt({ message: t('capital.contentRevisionInputs.rev.int') })
  @Min(1, { message: t('capital.contentRevisionInputs.rev.min') })
  rev!: number;
}

@InputType('CapitalRestoreContentRevisionInput')
export class RestoreContentRevisionInputDTO extends GetContentRevisionInputDTO {
  @Field(() => Int, {
    description: 'Текущая редакция, которую видел пользователь (base_rev): откат сливается с параллельными правками как обычная запись',
  })
  @IsInt({ message: t('capital.contentRevisionInputs.baseRev.int') })
  @Min(1, { message: t('capital.contentRevisionInputs.baseRev.min') })
  base_rev!: number;
}
