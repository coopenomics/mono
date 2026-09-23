import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { AddAuthorDomainInput } from '../../../domain/actions/add-author-domain-input.interface';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для добавления автора проекта CAPITAL контракта
 */
@InputType('AddAuthorInput')
export class AddAuthorInputDTO implements AddAuthorDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.addAuthorInput.coopname.required') })
  @IsString({ message: t('capital.addAuthorInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.addAuthorInput.projectHash.required') })
  @IsString({ message: t('capital.addAuthorInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя автора' })
  @IsNotEmpty({ message: t('capital.addAuthorInput.author.required') })
  @IsString({ message: t('capital.addAuthorInput.author.string') })
  author!: string;
}
