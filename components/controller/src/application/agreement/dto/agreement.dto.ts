import { ObjectType, Field, Int } from '@nestjs/graphql';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';
import { AgreementStatus } from '~/domain/agreement/enums/agreement-status.enum';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

/**
 * GraphQL Output DTO для сущности соглашения (Agreement)
 */
@ObjectType('Agreement', {
  description: 'Соглашение пользователя с кооперативом',
})
export class AgreementDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID соглашения в блокчейне',
  })
  id?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Имя пользователя, создавшего соглашение',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Тип соглашения',
  })
  type?: string;

  @Field(() => Int, {
    nullable: true,
    description: 'ID программы',
  })
  program_id?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'ID черновика',
  })
  draft_id?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Версия соглашения',
  })
  version?: number;

  @Field(() => AgreementStatus, {
    description: 'Статус соглашения',
  })
  status!: AgreementStatus;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ соглашения',
    nullable: true,
  })
  document?: DocumentAggregateDTO | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Дата последнего обновления в блокчейне',
  })
  updated_at?: Date;
}
