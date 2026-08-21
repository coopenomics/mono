import { Field, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/** Какую оферту ЦПП «Образование» подписывает пайщик со стола. */
export enum EduOfferKind {
  PARENT = 'parent',
  TEACHER = 'teacher',
}
registerEnumType(EduOfferKind, { name: 'EduOfferKind', description: 'Оферта ЦПП «Образование»: родитель-слушатель или преподаватель' });

/** Почему стол открыт или закрыт. */
export enum EduOnboardingSource {
  /** Кооператив не завершил подключение ЦПП — подписать нечего. */
  NOT_CONFIGURED = 'not_configured',
  /** Оферта подписана. */
  AGREEMENT_SIGNED = 'agreement_signed',
  /** Нужна подпись оферты со стола. */
  GATE_REQUIRED = 'gate_required',
}
registerEnumType(EduOnboardingSource, { name: 'EduOnboardingSource', description: 'Состояние подключения пайщика к столу' });

@ObjectType('EduOfferState')
export class EduOfferStateDTO {
  @Field(() => EduOfferKind, { description: 'Оферта' })
  kind!: EduOfferKind;

  @Field(() => Boolean, { description: 'Нужно подписать оферту, чтобы открыть стол' })
  requires_gate!: boolean;

  @Field(() => EduOnboardingSource, { description: 'Источник состояния' })
  source!: EduOnboardingSource;

  @Field(() => Number, { description: 'Шаблон экземпляра оферты в реестре документов' })
  registry_id!: number;

  @Field(() => String, { nullable: true, description: 'Когда подписана' })
  signed_at?: string;
}

@ObjectType('EduOnboardingState')
export class EduOnboardingStateDTO {
  @Field(() => EduOfferStateDTO, { description: 'Оферта родителя-слушателя' })
  parent!: EduOfferStateDTO;

  @Field(() => EduOfferStateDTO, { description: 'Оферта преподавателя' })
  teacher!: EduOfferStateDTO;
}

@InputType('EduSignOfferInput')
export class EduSignOfferInputDTO {
  @Field(() => EduOfferKind, { description: 'Какая оферта подписывается' })
  @IsEnum(EduOfferKind)
  kind!: EduOfferKind;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный пайщиком экземпляр оферты (3002 или 3004)' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
