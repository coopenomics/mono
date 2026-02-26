import { Field, InputType } from '@nestjs/graphql';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

/**
 * DTO для завершения регистрации в Capital
 * Используется для отправки подписанных документов в блокчейн
 */

/**
 * DTO для завершения регистрации в Capital через отправку документов в блокчейн
 */
@InputType()
export class CompleteCapitalRegistrationInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя' })
  username!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный договор УХД', nullable: true })
  generation_contract?: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное соглашение о хранении имущества' })
  storage_agreement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    nullable: true,
    description: 'Подписанное соглашение Благорост (только для пути Генератора)'
  })
  blagorost_agreement?: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    nullable: true,
    description: 'Подписанная оферта Генератор (для пути Капитализации)'
  })
  generator_offer?: SignedDigitalDocumentInputDTO;

  @Field(() => String, {
    nullable: true,
    description: 'Информация о себе'
  })
  about?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ставка за час работы'
  })
  rate_per_hour?: string;

  @Field(() => Number, {
    nullable: true,
    description: 'Количество часов в день'
  })
  hours_per_day?: number;
}
