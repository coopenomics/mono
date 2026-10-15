import { Field, Int, ObjectType } from '@nestjs/graphql';

/** Документ, утверждение которого будет перенесено из прежних настроек кооператива в цепь. */
@ObjectType('DocumentApprovalSeedItem')
export class DocumentApprovalSeedItemDTO {
  @Field(() => Int, { description: 'Номер шаблона в реестре документов' })
  registry_id!: number;

  @Field(() => String, { description: 'Название документа' })
  title!: string;

  @Field(() => Int, { description: 'Редакция в сети, которая будет записана утверждённой' })
  version!: number;

  @Field(() => String, { description: 'Номер протокола из настроек кооператива' })
  protocol_number!: string;

  @Field(() => String, { description: 'Дата протокола из настроек кооператива' })
  protocol_day_month_year!: string;

  @Field(() => String, { description: 'Поле настроек, откуда взяты реквизиты' })
  vars_field!: string;
}

/** Итог переноса утверждений. */
@ObjectType('DocumentApprovalSeedResult')
export class DocumentApprovalSeedResultDTO {
  @Field(() => Int, { description: 'Сколько документов было в плане' })
  planned!: number;

  @Field(() => Int, { description: 'Сколько утверждений записано в цепь' })
  applied!: number;

  @Field(() => [Int], { description: 'Документы, по которым запись не удалась' })
  failed!: number[];
}
