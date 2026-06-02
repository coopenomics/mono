import { Field, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

@InputType('CreateProgramExpenseInput')
export class CreateProgramExpenseInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хэш расхода программы' })
  @IsNotEmpty() @IsString()
  expense_hash!: string;

  @Field(() => String, { description: 'Исполнитель расхода (на чей счёт поступит)' })
  @IsNotEmpty() @IsString()
  creator!: string;

  @Field(() => String, { description: 'Сумма расхода (формат asset)' })
  @IsNotEmpty() @IsString()
  amount!: string;

  @Field(() => String, { description: 'Описание расхода программы' })
  @IsNotEmpty() @IsString()
  description!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление о расходе программы (registry 1012)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@InputType('ApproveProgramExpenseInput')
export class ApproveProgramExpenseInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя председателя (approver)' })
  @IsNotEmpty() @IsString()
  approver!: string;

  @Field(() => String, { description: 'Хэш расхода программы' })
  @IsNotEmpty() @IsString()
  expense_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Одобренное заявление (registry 1012)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO)
  approved_statement!: SignedDigitalDocumentInputDTO;
}

@InputType('AuthorizeProgramExpenseInput')
export class AuthorizeProgramExpenseInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хэш расхода программы' })
  @IsNotEmpty() @IsString()
  expense_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Решение совета (registry 1013)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO)
  authorization!: SignedDigitalDocumentInputDTO;
}

@InputType('PayProgramExpenseInput')
export class PayProgramExpenseInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String) @IsNotEmpty() @IsString()
  expense_hash!: string;
}

@InputType('DeclineProgramExpenseInput')
export class DeclineProgramExpenseInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String) @IsNotEmpty() @IsString()
  expense_hash!: string;

  @Field(() => String, { description: 'Причина отклонения' })
  @IsNotEmpty() @IsString()
  reason!: string;
}

@InputType('TopupProgramExpensePoolInput')
export class TopupProgramExpensePoolInputDTO {
  @Field(() => String) @IsNotEmpty() @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Сумма пополнения пула расходов программы (формат asset)' })
  @IsNotEmpty() @IsString()
  amount!: string;
}
