import { ObjectType, Field } from '@nestjs/graphql';

/**
 * DTO для параметров документов участника из UData
 * Содержит номера и даты всех документов участника
 */
@ObjectType('ContributorDocumentParameters', {
  description: 'Параметры документов участника из UData',
})
export class ContributorDocumentParametersDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Номер договора УХД участника',
  })
  blagorost_contributor_contract_number?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания договора УХД участника',
  })
  blagorost_contributor_contract_created_at?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Номер соглашения программы генератор',
  })
  generator_agreement_number?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания соглашения генератора',
  })
  generator_agreement_created_at?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Номер соглашения программы благороста',
  })
  blagorost_agreement_number?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания соглашения благороста',
  })
  blagorost_agreement_created_at?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Номер дополнительного соглашения по хранению имущества',
  })
  blagorost_storage_agreement_number?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания дополнительного соглашения по хранению имущества',
  })
  blagorost_storage_agreement_created_at?: string;
}
