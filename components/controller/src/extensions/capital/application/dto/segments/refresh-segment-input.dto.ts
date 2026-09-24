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
  @IsNotEmpty({ message: validationMessage('capital.segmentsRefreshInput.coopname.required') })
  @IsString({ message: validationMessage('capital.segmentsRefreshInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.segmentsRefreshInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.segmentsRefreshInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: validationMessage('capital.segmentsRefreshInput.username.required') })
  @IsString({ message: validationMessage('capital.segmentsRefreshInput.username.string') })
  username!: string;
}
