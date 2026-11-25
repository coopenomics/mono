import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { validationMessage } from '@coopenomics/extension-kit';
import { CapitalizationPropertyInvestStatementSignedDocumentInputDTO } from '../../documents-dto/capitalization-property-invest-document.dto';

/**
 * Подача заявления о паевом взносе имуществом в программу «Благорост».
 * Имущество и его оценку сервер берёт из подписанного заявления: отдельных
 * полей с суммой нет, расхождение между ними невозможно.
 */
@InputType('CreateProgramPropertyInput')
export class CreateProgramPropertyInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.coopname.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Имя пайщика, передающего имущество' })
  @IsNotEmpty({ message: validationMessage('capital.createProgramPropertyInput.username.required') })
  @IsString({ message: validationMessage('capital.createProgramPropertyInput.username.string') })
  username!: string;

  @Field(() => CapitalizationPropertyInvestStatementSignedDocumentInputDTO, {
    description: 'Заявление о паевом взносе имуществом, подписанное пайщиком',
  })
  @ValidateNested()
  @Type(() => CapitalizationPropertyInvestStatementSignedDocumentInputDTO)
  statement!: CapitalizationPropertyInvestStatementSignedDocumentInputDTO;
}
