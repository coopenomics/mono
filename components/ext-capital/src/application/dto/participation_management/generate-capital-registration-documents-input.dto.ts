import { Field, InputType } from '@nestjs/graphql';

/**
 * DTO для генерации пачки документов на странице регистрации в Capital
 * Генерирует документы в зависимости от выбранной программы:
 * - Для пути Генератора: GenerationContract, StorageAgreement, BlagorostAgreement
 * - Для пути Благороста: GenerationContract, StorageAgreement
 */
@InputType()
export class GenerateCapitalRegistrationDocumentsInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  username!: string;

  @Field(() => String, { nullable: true, description: 'Язык документов (по умолчанию ru)' })
  lang?: string;
}
