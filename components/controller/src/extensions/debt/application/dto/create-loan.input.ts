import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/** Заявление на заём под обеспечение паевым взносом: заявление и договор с подписью пайщика. */
@InputType('DebtCreateLoanInput')
export class CreateLoanInputDTO {
  @Field(() => String, { description: 'Кооператив' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Пайщик-заёмщик' })
  @IsNotEmpty()
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Ключ обеспечения из реестра обеспечения' })
  @IsNotEmpty()
  @IsString()
  collateral!: string;

  @Field(() => String, { description: 'Хэш займа; его короткая форма — номер договора' })
  @IsNotEmpty()
  @IsString()
  debt_hash!: string;

  @Field(() => String, { description: 'Сумма займа' })
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @Field(() => String, { description: 'Срок возврата' })
  @IsNotEmpty()
  @IsString()
  due_at!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление на получение займа с подписью пайщика' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Договор о беспроцентном займе с подписью пайщика' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  contract!: SignedDigitalDocumentInputDTO;
}
