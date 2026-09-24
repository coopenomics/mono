import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { RefreshSegmentDomainInput } from '../../../domain/actions/refresh-segment-domain-input.interface';

/**
 * GraphQL DTO для обновления сегмента CAPITAL контракта
 */
@InputType('RefreshSegmentInput')
export class RefreshSegmentInputDTO implements RefreshSegmentDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.refreshSegmentInput.coopname.required') })
  @IsString({ message: validationMessage('capital.refreshSegmentInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.refreshSegmentInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.refreshSegmentInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.refreshSegmentInput.username.required') })
  @IsString({ message: validationMessage('capital.refreshSegmentInput.username.string') })
  username!: string;
}
