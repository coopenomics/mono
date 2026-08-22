import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import type { ExpenseRequisiteSnapshotTypeormEntity } from '../../infrastructure/entities/expense-requisite-snapshot.typeorm-entity';

/**
 * Снимок реквизитов получателя по строке расхода. Персональные данные —
 * хранятся только в БД шасси (в блокчейн не пишутся), читаются советом
 * для сверки «куда и за что платим».
 */
@ObjectType('ExpenseRequisite')
export class ExpenseRequisiteOutputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  coopname!: string;

  @Field(() => String, { description: 'Хеш сметы расхода (proposal).' })
  proposal_hash!: string;

  @Field(() => String, { description: 'Хеш строки расхода (item).' })
  item_hash!: string;

  @Field(() => String, { description: 'Получатель платежа (аккаунт пайщика или название организации).' })
  recipient!: string;

  @Field(() => String, { nullable: true, description: 'Тип платёжного метода пайщика (СБП / банковский перевод).' })
  method_type?: string | null;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Снимок данных платёжного метода на момент подачи СЗ.' })
  data?: Record<string, unknown> | null;

  @Field(() => String, { description: 'Реквизиты строкой — как в документе служебной записки.' })
  requisites!: string;

  @Field(() => String, { nullable: true, description: 'Назначение платежа для поручения кассиру.' })
  payment_purpose?: string | null;

  static fromEntity(entity: ExpenseRequisiteSnapshotTypeormEntity): ExpenseRequisiteOutputDTO {
    const dto = new ExpenseRequisiteOutputDTO();
    dto.coopname = entity.coopname;
    dto.proposal_hash = entity.proposal_hash;
    dto.item_hash = entity.item_hash;
    dto.recipient = entity.recipient;
    dto.method_type = entity.method_type;
    dto.data = entity.data;
    dto.requisites = entity.requisites;
    dto.payment_purpose = entity.payment_purpose;
    return dto;
  }
}
