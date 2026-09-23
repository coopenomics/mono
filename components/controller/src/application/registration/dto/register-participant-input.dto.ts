import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GraphQLJSON } from 'graphql-type-json';
import { ParticipantApplicationSignedDocumentInputDTO } from '../../document/documents-dto/participant-application-document.dto';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type {
  IntakeFormAnswerDomainInterface,
  RegisterParticipantDomainInterface,
} from '~/domain/participant/interfaces/register-participant-domain.interface';
import { ProgramKey } from '~/domain/registration/enum';
import { t } from '~/i18n';

// Регистрируем enum для GraphQL
registerEnumType(ProgramKey, {
  name: 'ProgramKey',
  description: 'Ключ выбранной программы регистрации',
});

@InputType('IntakeFormAnswerInput')
export class IntakeFormAnswerInputDTO implements IntakeFormAnswerDomainInterface {
  @Field({ description: 'Идентификатор анкеты из конфигурации регистрации' })
  @IsNotEmpty({ message: t('registration.registerParticipantInput.formIdRequired') })
  @IsString()
  form_id!: string;

  @Field(() => GraphQLJSON, { description: 'Значения полей анкеты: имя поля → значение' })
  @IsObject({ message: t('registration.registerParticipantInput.valuesObjectRequired') })
  values!: Record<string, unknown>;
}

@InputType('RegisterParticipantInput')
export class RegisterParticipantInputDTO implements RegisterParticipantDomainInterface {
  @Field({ description: 'Имя аккаунта пайщика' })
  @IsNotEmpty({ message: t('registration.registerParticipantInput.usernameRequired') })
  @IsString()
  username!: string;

  @Field({ description: 'Имя кооперативного участка', nullable: true })
  @IsString()
  @IsOptional()
  braname?: string;

  @Field(() => ParticipantApplicationSignedDocumentInputDTO, {
    description: 'Подписанный документ заявления на вступление в кооператив от пайщика',
  })
  @ValidateNested()
  @IsNotEmpty({ message: t('registration.registerParticipantInput.statementRequired') })
  statement!: ParticipantApplicationSignedDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ политики конфиденциальности от пайщика',
  })
  @ValidateNested()
  @IsNotEmpty({ message: t('registration.registerParticipantInput.privacyAgreementRequired') })
  privacy_agreement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ положения о цифровой подписи от пайщика',
  })
  @ValidateNested()
  @IsNotEmpty({ message: t('registration.registerParticipantInput.signatureAgreementRequired') })
  signature_agreement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ пользовательского соглашения от пайщика',
  })
  @ValidateNested()
  @IsNotEmpty({ message: t('registration.registerParticipantInput.userAgreementRequired') })
  user_agreement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ положения целевой потребительской программы "Цифровой Кошелёк" от пайщика',
  })
  @ValidateNested()
  @IsNotEmpty({ message: t('registration.registerParticipantInput.walletAgreementRequired') })
  wallet_agreement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ соглашения по благороста (опционально, только если требуется)',
    nullable: true,
  })
  @ValidateNested()
  @IsOptional()
  blagorost_offer?: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанный документ оферты по программе "Генератор" (опционально, только для программы generation)',
    nullable: true,
  })
  @ValidateNested()
  @IsOptional()
  generator_offer?: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, {
    description: 'Подписанная оферта по целевой потребительской программе «Стол заказов» (опционально, только для программы marketplace)',
    nullable: true,
  })
  @ValidateNested()
  @IsOptional()
  marketplace_offer?: SignedDigitalDocumentInputDTO;

  @Field(() => ProgramKey, { description: 'Ключ выбранной программы регистрации', nullable: true })
  @IsOptional()
  program_key?: ProgramKey;

  @Field(() => [IntakeFormAnswerInputDTO], {
    description: 'Ответы на анкеты вступления, которые объявили расширения для выбранной программы и типа аккаунта',
    nullable: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntakeFormAnswerInputDTO)
  @IsOptional()
  intake_answers?: IntakeFormAnswerInputDTO[];
}
