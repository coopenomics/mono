import { InputType, Field, Float, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';

// интерфейс параметров для генерации
type action = Cooperative.Registry.ProgramAgreementsAnnulmentStatement.Action;

@InputType('ProgramAgreementWalletInput')
class ProgramAgreementWalletInputDTO implements Cooperative.Registry.ProgramAgreementsAnnulmentStatement.IAnnulmentWallet {
  @Field(() => String, { description: 'Машинное имя кошелька' })
  @IsString()
  wallet_name!: string;

  @Field(() => String, { description: 'Человекочитаемое название кошелька' })
  @IsString()
  human_name!: string;

  @Field(() => String, { description: 'Остаток на день заявления' })
  @IsString()
  balance!: string;

  @Field(() => Boolean, { description: 'Остаток возвращается на главный паевой кошелёк' })
  @IsBoolean()
  returns!: boolean;
}

@InputType('ProgramAgreementInput')
class ProgramAgreementInputDTO implements Cooperative.Registry.ProgramAgreementsAnnulmentStatement.IAnnulmentProgram {
  @Field(() => Int, { description: 'Идентификатор программы' })
  @IsInt()
  program_id!: number;

  @Field(() => String, { description: 'Название программы' })
  @IsString()
  title!: string;

  @Field(() => String, { description: 'Когда подписано соглашение об участии' })
  @IsString()
  agreement_signed_at!: string;

  @Field(() => String, { description: 'Хэш подписанного соглашения' })
  @IsString()
  agreement_hash!: string;

  @Field(() => [ProgramAgreementWalletInputDTO], { description: 'Кошельки программы с остатками' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramAgreementWalletInputDTO)
  wallets!: ProgramAgreementWalletInputDTO[];

  @Field(() => String, { description: 'Сколько возвращается по этой программе' })
  @IsString()
  refund!: string;
}

@InputType('BaseProgramAgreementsAnnulmentMetaDocumentInput')
class BaseProgramAgreementsAnnulmentMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({
    description:
      'Флаг пропуска сохранения документа (используется для предварительной генерации и демонстрации пользователю)',
  })
  @IsBoolean()
  skip_save!: boolean;

  @Field(() => String, { nullable: true, description: 'Хэш процесса выхода; пусто — аннулирование без выхода из кооператива' })
  @IsOptional()
  @IsString()
  exit_hash?: string;

  @Field(() => [ProgramAgreementInputDTO], { description: 'Программы, соглашения по которым аннулируются' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramAgreementInputDTO)
  programs!: ProgramAgreementInputDTO[];

  @Field(() => String, { description: 'Сумма к переводу на главный паевой кошелёк по всем программам' })
  @IsString()
  total_refund!: string;
}

@InputType('ProgramAgreementsAnnulmentGenerateDocumentInput')
export class ProgramAgreementsAnnulmentGenerateDocumentInputDTO
  extends IntersectionType(
    BaseProgramAgreementsAnnulmentMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;

  constructor() {
    super();
  }
}

@InputType('ProgramAgreementsAnnulmentSignedMetaDocumentInput')
export class ProgramAgreementsAnnulmentSignedMetaDocumentInputDTO
  extends IntersectionType(BaseProgramAgreementsAnnulmentMetaDocumentInputDTO, MetaDocumentInputDTO)
  implements action {}

@InputType('ProgramAgreementsAnnulmentSignedDocumentInput')
export class ProgramAgreementsAnnulmentSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ProgramAgreementsAnnulmentSignedMetaDocumentInputDTO)
  public readonly meta!: ProgramAgreementsAnnulmentSignedMetaDocumentInputDTO;
}
