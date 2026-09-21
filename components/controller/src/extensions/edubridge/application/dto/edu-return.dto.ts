import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { EduReturnStatus } from '../../domain/enums';
import type { EdubridgeReturnRequestEntity } from '../../infrastructure/entities';
import type { ReturnBalance } from '../services/edubridge-return.service';
import './edu-enums.registration';

const ASSET = /^\d+\.\d{4} [A-Z]{1,7}$/;

/** Заявка на возврат остатка кошелька программы в паевой взнос. */
@ObjectType('EduReturnRequest')
export class EduReturnRequestDTO {
  @Field(() => ID, { description: 'Идентификатор заявки' })
  id!: string;

  @Field(() => String, { description: 'Пайщик, подавший заявление' })
  member_username!: string;

  @Field(() => String, { description: 'Сумма возврата в паевой взнос' })
  amount!: string;

  @Field(() => EduReturnStatus, { description: 'Состояние заявки' })
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

/** Остаток кошелька программы и то, что из него ещё можно заявить к возврату. */
@ObjectType('EduReturnBalance')
export class EduReturnBalanceDTO {
  @Field(() => String, { description: 'Остаток кошелька программы' })
  available!: string;

  @Field(() => String, { description: 'Заявлено к возврату и ждёт согласования' })
  pending!: string;

  @Field(() => String, { description: 'Доступно для нового заявления' })
  free!: string;

  constructor(b: ReturnBalance) {
    this.available = b.available;
    this.pending = b.pending;
    this.free = b.free;
  }
}

@InputType('EduReturnStatementInput')
export class EduReturnStatementInputDTO {
  @Field(() => String, { description: 'Сумма возврата в паевой взнос, например «1000.0000 RUB»' })
  @Matches(ASSET)
  amount!: string;
}

@InputType('EduRequestReturnInput')
export class EduRequestReturnInputDTO extends EduReturnStatementInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о возврате членского взноса в паевой взнос' })
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
