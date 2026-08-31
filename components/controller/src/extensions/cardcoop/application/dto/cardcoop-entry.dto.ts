import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import {
  CardcoopEntryOutcome,
  CardcoopEntryStatus,
} from '../../infrastructure/entities/cardcoop-entry-session.typeorm-entity';

registerEnumType(CardcoopEntryOutcome, {
  name: 'CardcoopEntryOutcome',
  description: 'Кем оказался человек, вошедший по карте: пайщиком или кандидатом',
});

registerEnumType(CardcoopEntryStatus, {
  name: 'CardcoopEntryStatus',
  description: 'Состояние быстрой регистрации по карте',
});

/** Членство карты в другом кооперативе — кандидату из них выбирать источник анкеты. */
@ObjectType('CardcoopEntryMembership')
export class CardcoopEntryMembershipDTO {
  @Field(() => String, { description: 'Системное имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Наименование кооператива' })
  displayName!: string;

  @Field(() => String, { nullable: true, description: 'Дата вступления' })
  memberSince!: string | null;
}

/** Сессия входа по карте пайщика. */
@ObjectType('CardcoopEntry')
export class CardcoopEntryDTO {
  @Field(() => String, { description: 'Идентификатор сессии входа' })
  id!: string;

  @Field(() => CardcoopEntryOutcome, { description: 'Пайщик или кандидат' })
  outcome!: CardcoopEntryOutcome;

  @Field(() => CardcoopEntryStatus, { description: 'Состояние быстрой регистрации' })
  status!: CardcoopEntryStatus;

  @Field(() => String, { nullable: true, description: 'Номер карты пайщика' })
  cardNumber!: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Учётное имя пайщика, которого опознала карта; пусто у кандидата',
  })
  username!: string | null;

  @Field(() => [CardcoopEntryMembershipDTO], {
    description: 'Членства карты в других кооперативах — из них выбирается источник анкеты',
  })
  memberships!: CardcoopEntryMembershipDTO[];
}

/** Анкета, полученная от кооператива-источника; выдаётся ровно один раз. */
@ObjectType('CardcoopEntryProfile')
export class CardcoopEntryProfileDTO {
  @Field(() => String, { description: 'Вид субъекта: физлицо, ИП или организация' })
  subjectType!: string;

  @Field(() => GraphQLJSON, { description: 'Анкета для предзаполнения формы вступления' })
  profile!: Record<string, unknown>;
}

/** Запрос переноса анкеты из выбранного кооператива. */
@InputType('CardcoopRequestEntryDisclosureInput')
export class CardcoopRequestEntryDisclosureInputDTO {
  @Field(() => String, { description: 'Идентификатор сессии входа' })
  entry_id!: string;

  @Field(() => String, { description: 'Системное имя кооператива-источника' })
  from_coopname!: string;
}

/** Указание сессии входа. */
@InputType('CardcoopEntryInput')
export class CardcoopEntryInputDTO {
  @Field(() => String, { description: 'Идентификатор сессии входа' })
  entry_id!: string;
}
