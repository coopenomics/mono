import { ObjectType, Field, Int } from '@nestjs/graphql';
import { AppendixStatus } from '../../../domain/enums/appendix-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';

/**
 * GraphQL Output DTO для сущности Appendix
 */
@ObjectType('CapitalAppendix', {
  description: 'Приложение в системе CAPITAL',
})
export class AppendixOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Номер блока последнего обновления',
  })
  block_num?: number;

  @Field(() => Boolean, {
    description: 'Существует ли запись в блокчейне',
    defaultValue: false,
  })
  present!: boolean;

  @Field(() => AppendixStatus, {
    description: 'Статус приложения',
  })
  status!: AppendixStatus;

  @Field(() => String, {
    description: 'Хеш приложения',
  })
  appendix_hash!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад участника (текстовое описание)',
  })
  contribution?: string;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ приложения',
    nullable: true,
  })
  appendix?: DocumentAggregateDTO | null;
}
