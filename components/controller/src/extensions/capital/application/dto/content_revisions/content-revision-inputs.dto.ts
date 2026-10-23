import { Field, InputType, Int } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { ContentEntityType } from '../../../domain/enums/content-entity-type.enum';

@InputType('CapitalGetContentRevisionsInput')
export class GetContentRevisionsInputDTO {
  @Field(() => ContentEntityType, { description: 'Тип сущности: PROJECT, ISSUE, STORY' })
  @IsEnum(ContentEntityType, { message: validationMessage('capital.contentRevisionInputs.entityType.invalid') })
  entity_type!: ContentEntityType;

  @Field(() => String, { description: 'Хэш сущности' })
  @IsNotEmpty({ message: validationMessage('capital.contentRevisionInputs.entityHash.required') })
  @IsString({ message: validationMessage('capital.contentRevisionInputs.entityHash.string') })
  entity_hash!: string;
}

@InputType('CapitalGetContentRevisionInput')
export class GetContentRevisionInputDTO extends GetContentRevisionsInputDTO {
  @Field(() => Int, { description: 'Номер редакции' })
  @IsInt({ message: validationMessage('capital.contentRevisionInputs.rev.int') })
  @Min(1, { message: validationMessage('capital.contentRevisionInputs.rev.min') })
  rev!: number;
}

@InputType('CapitalRestoreContentRevisionInput')
export class RestoreContentRevisionInputDTO extends GetContentRevisionInputDTO {
  @Field(() => Int, {
    description: 'Текущая редакция, которую видел пользователь (base_rev): откат сливается с параллельными правками как обычная запись',
  })
  @IsInt({ message: validationMessage('capital.contentRevisionInputs.baseRev.int') })
  @Min(1, { message: validationMessage('capital.contentRevisionInputs.baseRev.min') })
  base_rev!: number;
}
