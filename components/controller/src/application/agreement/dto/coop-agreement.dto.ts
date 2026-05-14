import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Конфиг соглашения кооператива (`soviet::coagreements`): какие типы
 * соглашений кооператив требует с пайщика (`wallet`/`privacy`/`signature`/
 * `user`/`blagorost`/`generator`/`marketplace`) и какой draft_id за каждым.
 *
 * Используется фронтом (`RequireAgreements`) для определения, что должно
 * быть подписано, и для матчинга версий через `agreementTemplates`.
 */
@ObjectType('CoopAgreement')
export class CoopAgreementDTO {
  @Field(() => String, { description: 'Тип соглашения (wallet, privacy, signature, user, blagorost, generator, marketplace)' })
  type!: string;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => Int, { description: 'Идентификатор программы (0 — непрограммное; >0 — программа из soviet::programs)' })
  program_id!: number;

  @Field(() => Int, { description: 'Идентификатор шаблона документа (registry_id из draft::drafts)' })
  draft_id!: number;
}
