import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

@InputType('DebtLoanRefInput')
export class LoanRefInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хэш займа' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;
}

@InputType('DebtCancelLoanInput')
export class CancelLoanInputDTO extends LoanRefInputDTO {
  @Field(() => String, { nullable: true, description: 'Причина отмены' })
  @IsOptional()
  @IsString()
  reason?: string;
}

@InputType('DebtRepayLoanInput')
export class RepayLoanInputDTO extends LoanRefInputDTO {
  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Сумма возврата' })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление о возврате займа с подписью пайщика' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@InputType('DebtExtendLoanInput')
export class ExtendLoanInputDTO extends LoanRefInputDTO {
  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Новый срок возврата' })
  @IsNotEmpty()
  @IsString()
  new_due_at!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление о продлении срока с подписью пайщика' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
