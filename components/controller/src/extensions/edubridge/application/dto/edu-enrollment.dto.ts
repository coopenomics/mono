import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsUUID, Matches, ValidateNested } from 'class-validator';
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

  @Field(() => String, { description: 'Уплаченный взнос за период' })
  paid_amount!: string;

  @Field(() => String, { nullable: true, description: 'Возвращено при отмене' })
  refunded_amount!: string | null;

  @Field(() => String, { nullable: true, description: 'Основание возврата по Положению ЦПП' })
  refund_reason!: string | null;

  @Field(() => Date, { nullable: true, description: 'Когда подписка отменена' })
  cancelled_at!: Date | null;

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
    this.paid_amount = e.paid_amount;
    this.refunded_amount = e.refunded_amount;
    this.refund_reason = e.refund_reason;
    this.cancelled_at = e.cancelled_at;
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

  @Field(() => Int, { description: 'Сколько месяцев оплачивает взнос: один при помесячном, месяцы до конца курса при взносе разом' })
  months!: number;

  @Field(() => String, { description: 'Сумма помесячных взносов за эти месяцы' })
  base_amount!: string;

  @Field(() => String, { description: 'Скидка за взнос разом; при помесячном взносе — ноль' })
  discount_amount!: string;

  @Field(() => String, { description: 'Сколько зачтётся с кошелька членских взносов программы' })
  from_program!: string;

  @Field(() => String, { description: 'Сколько конвертируется с главного паевого — недостающая часть' })
  to_convert!: string;

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

@InputType('EduSubscribeInput')
export class EduSubscribeInputDTO extends EduQuoteInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о конвертации паевого взноса в членский' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}

/** Что вернут при отмене подписки — стол показывает это до нажатия. */
@ObjectType('EduRefundPreview')
export class EduRefundPreviewDTO {
  @Field(() => String, { description: 'Основание возврата по Положению ЦПП' })
  reason!: string;

  @Field(() => String, { description: 'Сколько вернётся ученику' })
  refund!: string;

  @Field(() => String, { description: 'Сколько остаётся в фонде программы' })
  withheld!: string;

  @Field(() => Int, { description: 'Занятий оплачено периодом' })
  lessons_paid!: number;

  @Field(() => Int, { description: 'Занятий прошло к моменту отмены' })
  lessons_used!: number;

  @Field(() => Boolean, { description: 'Возврат идёт сразу на паевой' })
  to_share!: boolean;
}

@InputType('EduReturnToShareInput')
export class EduReturnToShareInputDTO {
  @Field(() => String, { description: 'Сумма возврата в паевой («1000.0000 RUB»)' })
  @Matches(/^\d+\.\d{4} [A-Z]{1,7}$/, { message: 'Сумма должна быть в формате «1000.0000 RUB»' })
  amount!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о возврате членского взноса в паевой' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
