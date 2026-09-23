import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type { SelectBranchInputDomainInterface } from '~/domain/branch/interfaces/select-branch-domain-input.interface';
import { SelectBranchSignedDocumentInputDTO } from '../../document/documents-dto/select-branch-document.dto';
import { t } from '~/i18n';

@InputType('SelectBranchInput')
export class SelectBranchInputDTO implements SelectBranchInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('branch.selectBranchInput.coopnameRequired') })
  @IsString({ message: t('branch.selectBranchInput.coopnameMustBeString') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @IsNotEmpty({ message: t('branch.selectBranchInput.branameRequired') })
  @IsString({ message: t('branch.selectBranchInput.branameMustBeString') })
  braname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('branch.selectBranchInput.usernameRequired') })
  username!: string;

  @Field(() => SelectBranchSignedDocumentInputDTO, {
    description: 'Подписанный электронный документ (generateSelectBranchDocument)',
  })
  @ValidateNested()
  document!: SelectBranchSignedDocumentInputDTO;
}
