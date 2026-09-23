import { Field, InputType } from '@nestjs/graphql';
import JSON from 'graphql-type-json';
import { IsNotEmpty, IsString, IsNumber, Min, IsOptional } from 'class-validator';
import type { CreateCommitDomainInput } from '../../../domain/actions/create-commit-domain-input.interface';
import type { CommitData } from '../../../domain/entities/commit.entity';
import { t } from '../../../i18n';

/**
 * GraphQL DTO для создания коммита CAPITAL контракта
 * Пользователь указывает количество часов для коммита
 */
@InputType('CreateCommitInput')
export class CreateCommitInputDTO implements CreateCommitDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('capital.createCommitInput.coopname.required') })
  @IsString({ message: t('capital.createCommitInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  @IsNotEmpty({ message: t('capital.createCommitInput.username.required') })
  @IsString({ message: t('capital.createCommitInput.username.string') })
  username!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: t('capital.createCommitInput.projectHash.required') })
  @IsString({ message: t('capital.createCommitInput.projectHash.string') })
  project_hash!: string;


  @Field(() => Number, { description: 'Количество часов для коммита' })
  @IsNumber({}, { message: t('capital.createCommitInput.commitHours.number') })
  @Min(0.1, { message: t('capital.createCommitInput.commitHours.min') })
  commit_hours!: number;

  @Field(() => String, { description: 'Описание коммита' })
  @IsString({ message: t('capital.createCommitInput.description.string') })
  description!: string;

  @Field(() => String, { description: 'Мета-данные коммита' })
  @IsNotEmpty({ message: t('capital.createCommitInput.meta.required') })
  @IsString({ message: t('capital.createCommitInput.meta.string') })
  meta!: string;

  @Field(() => JSON, {
    nullable: true,
    description:
      'Данные коммита для БД (git, contribution_feedback и др.). В блокчейн не передаётся. Взнос без Git: можно пустой data — commit_hash строится off-chain.',
  })
  @IsOptional()
  data?: CommitData;
}
