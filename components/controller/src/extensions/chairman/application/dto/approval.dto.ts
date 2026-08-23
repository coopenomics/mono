import { ObjectType, Field } from '@nestjs/graphql';
import { BaseOutputDTO } from '@coopenomics/extension-kit/sync';
import { ApprovalStatus } from '../../domain/enums/approval-status.enum';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

/**
 * GraphQL Output DTO для сущности одобрения (Approval)
 */
@ObjectType('Approval', {
  description: 'Одобрение документа председателем совета',
})
export class ApprovalDTO extends BaseOutputDTO {
  @Field(() => Number, {
    nullable: true,
    description: 'ID одобрения в блокчейне',
  })
  id?: number;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Имя пользователя, запросившего одобрение',
  })
  username!: string;

  @Field(() => String, {
    description: 'Хеш одобрения для идентификации',
  })
  approval_hash!: string;

  @Field(() => String, {
    description: 'Контракт обратного вызова для обработки результата',
  })
  callback_contract!: string;

  @Field(() => String, {
    description: 'Действие обратного вызова при одобрении',
  })
  callback_action_approve!: string;

  @Field(() => String, {
    description: 'Действие обратного вызова при отклонении',
  })
  callback_action_decline!: string;

  @Field(() => String, {
    description: 'Метаданные одобрения в формате JSON',
  })
  meta!: string;

  @Field(() => Date, {
    description: 'Дата создания одобрения',
  })
  created_at!: Date;

  @Field(() => ApprovalStatus, {
    description: 'Статус одобрения',
  })
  status!: ApprovalStatus;

  @Field(() => DocumentAggregateDTO, {
    description: 'Документ, требующий одобрения',
    nullable: true,
  })
  document?: DocumentAggregateDTO | null;

  @Field(() => DocumentAggregateDTO, {
    description: 'Одобренный документ (заполняется при подтверждении одобрения)',
    nullable: true,
  })
  approved_document?: DocumentAggregateDTO | null;
}
