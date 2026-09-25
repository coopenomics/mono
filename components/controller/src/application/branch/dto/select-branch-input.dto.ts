import { Type } from 'class-transformer';
import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type { SelectBranchInputDomainInterface } from '~/domain/branch/interfaces/select-branch-domain-input.interface';
import { SelectBranchSignedDocumentInputDTO } from '../../document/documents-dto/select-branch-document.dto';

@InputType('SelectBranchInput')
export class SelectBranchInputDTO implements SelectBranchInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('branch.selectBranchInput.coopnameRequired') })
  @IsString({ message: validationMessage('branch.selectBranchInput.coopnameMustBeString') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @IsNotEmpty({ message: validationMessage('branch.selectBranchInput.branameRequired') })
  @IsString({ message: validationMessage('branch.selectBranchInput.branameMustBeString') })
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('branch.selectBranchInput.usernameRequired') })
  username!: string;

  @Field(() => SelectBranchSignedDocumentInputDTO, {
    description: 'Подписанный электронный документ (generateSelectBranchDocument)',
  })
  @ValidateNested()
  @Type(() => SelectBranchSignedDocumentInputDTO)
  document!: SelectBranchSignedDocumentInputDTO;
}
