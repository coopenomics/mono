import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import type { EdubridgeReturnRequestEntity } from '../../infrastructure/entities';
import type { ReturnBalance } from '../services/edubridge-return.service';
import './edu-enums.registration';

/** Заявление пайщика о прекращении участия в программе «Образование». */
@ObjectType('EduReturnRequest')
export class EduReturnRequestDTO {
  @Field(() => ID, { description: 'Идентификатор заявления' })
  id!: string;

  @Field(() => String, { description: 'Пайщик, подавший заявление' })
  member_username!: string;

  @Field(() => String, { description: 'Сумма перевода в паевой взнос: после согласования — переведённая, до него — оценка на день подачи' })
  amount!: string;

  @Field(() => EduReturnStatus, { description: 'Состояние заявления' })
  status!: EduReturnStatus;

  @Field(() => String, { description: 'Идентификатор подписанного заявления' })
  statement_hash!: string;

  @Field(() => String, { description: 'Причина отказа, если кооператив отклонил заявление' })
  decline_reason!: string;

  @Field(() => Date, { description: 'Когда подано заявление' })
  created_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Когда кооператив принял решение' })
  decided_at!: Date | null;

  constructor(e: EdubridgeReturnRequestEntity) {
    this.id = e.id;
    this.member_username = e.member_username;
    this.amount = e.amount;
    this.status = e.status;
    this.statement_hash = e.statement_hash;
    this.decline_reason = e.decline_reason ?? '';
    this.created_at = e.created_at;
    this.decided_at = e.decided_at ?? null;
  }
}

/** Что уйдёт в паевой взнос, если прекратить участие в программе сегодня. */
@ObjectType('EduReturnBalance')
export class EduReturnBalanceDTO {
  @Field(() => String, { description: 'Остаток кошелька программы' })
  available!: string;

  @Field(() => String, { description: 'Сколько вернут по действующим подпискам, если закрыть их сегодня' })
  refunds!: string;

  @Field(() => String, { description: 'Сколько уйдёт в паевой взнос при прекращении участия сегодня' })
  total!: string;

  @Field(() => Int, { description: 'Действующих подписок, которые закроются' })
  subscriptions!: number;

  @Field(() => Boolean, { description: 'Заявление о прекращении участия уже подано и ждёт согласования' })
  has_pending!: boolean;

  constructor(b: ReturnBalance) {
    this.available = b.available;
    this.refunds = b.refunds;
    this.total = b.total;
    this.subscriptions = b.subscriptions;
    this.has_pending = b.has_pending;
  }
}

@InputType('EduRequestReturnInput')
export class EduRequestReturnInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление об аннулировании соглашения об участии в программе «Образование» — без выхода из кооператива' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}

@InputType('EduDeclineReturnInput')
export class EduDeclineReturnInputDTO {
  @Field(() => ID, { description: 'Заявка' })
  @IsUUID()
  id!: string;

  @Field(() => String, { description: 'Причина отказа' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
