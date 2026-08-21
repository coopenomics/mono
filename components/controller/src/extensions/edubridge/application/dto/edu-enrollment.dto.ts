import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { EduAccessState, EduEnrollmentPeriod, EduEnrollmentStatus } from '../../domain/enums';
import type { EdubridgeCourseEntity, EdubridgeEnrollmentEntity } from '../../infrastructure/entities';
import './edu-enums.registration';

/** Подписка обучающегося на курс с состоянием доступа и сроком. */
@ObjectType('EduEnrollment')
export class EduEnrollmentDTO {
  @Field(() => ID, { description: 'Идентификатор подписки' })
  id!: string;

  @Field(() => ID, { description: 'Обучающийся' })
  learner_id!: string;

  @Field(() => ID, { description: 'Курс' })
  course_id!: string;

  @Field(() => String, { description: 'Название курса' })
  course_title!: string;

  @Field(() => EduEnrollmentPeriod, { description: 'Период членского взноса' })
  period!: EduEnrollmentPeriod;

  @Field(() => Date, { nullable: true, description: 'Оплачено до' })
  paid_until!: Date | null;

  @Field(() => EduEnrollmentStatus, { description: 'Состояние подписки' })
  status!: EduEnrollmentStatus;

  @Field(() => EduAccessState, { description: 'Состояние доступа на площадке' })
  access_state!: EduAccessState;

  @Field(() => String, { description: 'Ключ подписки в цепи' })
  sub_hash!: string;

  constructor(e: EdubridgeEnrollmentEntity, course?: EdubridgeCourseEntity | null) {
    this.id = e.id;
    this.learner_id = e.learner_id;
    this.course_id = e.course_id;
    this.course_title = course?.title ?? '';
    this.period = e.period;
    this.paid_until = e.paid_until;
    this.status = e.status;
    this.access_state = e.access_state;
    this.sub_hash = e.sub_hash;
  }
}

@InputType('EduQuoteInput')
export class EduQuoteInputDTO {
  @Field(() => ID, { description: 'Обучающийся' })
  @IsUUID()
  learner_id!: string;

  @Field(() => ID, { description: 'Курс' })
  @IsUUID()
  course_id!: string;

  @Field(() => EduEnrollmentPeriod, { description: 'Период' })
  @IsEnum(EduEnrollmentPeriod)
  period!: EduEnrollmentPeriod;
}

/** Что нужно, чтобы получить доступ: сумма взноса и хватает ли паевого. */
@ObjectType('EduQuote')
export class EduQuoteDTO {
  @Field(() => String, { description: 'Сумма членского взноса за период' })
  amount!: string;

  @Field(() => String, { description: 'Доступно паевого в главном кошельке' })
  available!: string;

  @Field(() => Boolean, { description: 'Паевого хватает — можно подписывать заявление' })
  enough!: boolean;

  @Field(() => String, { description: 'Сколько не хватает (0 — достаточно)' })
  shortfall!: string;

  @Field(() => Boolean, { description: 'Это продление действующей подписки' })
  is_extension!: boolean;

  @Field(() => Date, { description: 'До какой даты будет оплачено' })
  paid_until!: Date;

  @Field(() => String, { description: 'Ключ подписки в цепи' })
  sub_hash!: string;
}

/** Заявление о конвертации для подписи пайщиком. */
@ObjectType('EduConvertStatement')
export class EduConvertStatementDTO {
  @Field(() => String, { description: 'Хеш документа' })
  hash!: string;

  @Field(() => String, { description: 'Название документа' })
  full_title!: string;

  @Field(() => String, { description: 'HTML для ознакомления' })
  html!: string;

  @Field(() => String, { description: 'PDF в base64' })
  binary!: string;
}

@InputType('EduSubscribeInput')
export class EduSubscribeInputDTO extends EduQuoteInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о конвертации паевого взноса в членский' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
