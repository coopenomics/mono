import { Field, ID, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { EduGuaranteeClaimStatus } from '../../domain/enums/guarantee-claim-status.enum';
import type { GuaranteeState } from '../services/edubridge-guarantee.service';
import type { EdubridgeGuaranteeClaimRecord } from '../../infrastructure/entities/edubridge-guarantee-claim.record';

registerEnumType(EduGuaranteeClaimStatus, {
  name: 'EduGuaranteeClaimStatus',
  description: 'Ход заявления об аннулировании подписки по гарантийным условиям',
});

@ObjectType('EduGuaranteeClaim')
export class EduGuaranteeClaimDTO {
  @Field(() => ID, { description: 'Идентификатор заявления' })
  id!: string;

  @Field(() => String, { description: 'Номер заявления' })
  number!: string;

  @Field(() => EduGuaranteeClaimStatus, { description: 'Состояние заявления' })
  status!: EduGuaranteeClaimStatus;

  @Field(() => String, { description: 'Причина аннулирования подписки' })
  reason!: string;

  @Field(() => [String], { description: 'Ссылки на материалы, подтверждающие причину' })
  links!: string[];

  @Field(() => String, { description: 'Стоимость подписки, которая возвращается при удовлетворении заявления' })
  amount!: string;

  @Field(() => Date, { description: 'Когда заявление подано' })
  created_at!: Date;

  @Field(() => Date, { nullable: true, description: 'Когда совет рассмотрел заявление' })
  decided_at!: Date | null;

  constructor(c: EdubridgeGuaranteeClaimRecord) {
    this.id = c.id;
    this.number = c.claim_hash.slice(0, 8).toUpperCase();
    this.status = c.status;
    this.reason = c.reason;
    this.links = c.links ?? [];
    this.amount = c.amount;
    this.created_at = c.created_at;
    this.decided_at = c.decided_at ?? null;
  }
}

/** Гарантийные условия по подписке участника: можно ли подать заявление и что с поданным. */
@ObjectType('EduGuaranteeState')
export class EduGuaranteeStateDTO {
  @Field(() => ID, { description: 'Подписка' })
  enrollment_id!: string;

  @Field(() => Boolean, { description: 'Заявление об аннулировании подписки по гарантийным условиям можно подать' })
  available!: boolean;

  @Field(() => Date, { nullable: true, description: 'До какого дня действуют гарантийные условия' })
  guarantee_until!: Date | null;

  @Field(() => String, { description: 'Стоимость подписки, которая возвращается при удовлетворении заявления' })
  amount!: string;

  @Field(() => EduGuaranteeClaimDTO, { nullable: true, description: 'Поданное заявление' })
  claim!: EduGuaranteeClaimDTO | null;

  constructor(s: GuaranteeState) {
    this.enrollment_id = s.enrollment_id;
    this.available = s.available;
    this.guarantee_until = s.guarantee_until;
    this.amount = s.amount;
    this.claim = s.claim ? new EduGuaranteeClaimDTO(s.claim) : null;
  }
}

@InputType('EduGuaranteeStatementInput')
export class EduGuaranteeStatementInputDTO {
  @Field(() => ID, { description: 'Подписка' })
  @IsUUID()
  enrollment_id!: string;

  @Field(() => String, { description: 'Причина аннулирования подписки' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @Field(() => [String], { nullable: true, description: 'Ссылки на материалы, подтверждающие причину' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  links?: string[];
}

@InputType('EduSubmitGuaranteeClaimInput')
export class EduSubmitGuaranteeClaimInputDTO extends EduGuaranteeStatementInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление об аннулировании подписки по гарантийным условиям' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}
