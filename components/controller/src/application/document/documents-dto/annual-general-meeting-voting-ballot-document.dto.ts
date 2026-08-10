import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO, ExcludeCommonProps } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// интерфейс параметров для генерации
type action = Cooperative.Registry.AnnualGeneralMeetingVotingBallot.Action;

// Упрощенный DTO для ответов, только необходимые поля
@InputType('AnswerInput')
export class AnswerInputDTO {
  @Field(() => String, { description: 'ID вопроса' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @Field(() => String, { description: 'Номер вопроса' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Голос (за/против/воздержался)' })
  @IsString()
  @IsNotEmpty()
  vote!: 'for' | 'against' | 'abstained';
}

@InputType(`BaseAnnualGeneralMeetingVotingBallotMetaDocumentInput`)
class BaseAnnualGeneralMeetingVotingBallotMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field(() => String, { description: 'Хеш собрания' })
  @IsString()
  @IsNotEmpty()
  meet_hash!: string;

  @Field(() => String, { description: 'Имя пользователя голосующего' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => [AnswerInputDTO], { description: 'Ответы голосования' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerInputDTO)
  @IsNotEmpty()
  answers!: AnswerInputDTO[];
}

@InputType(`AnnualGeneralMeetingVotingBallotGenerateDocumentInput`)
export class AnnualGeneralMeetingVotingBallotGenerateDocumentInputDTO
  extends IntersectionType(
    BaseAnnualGeneralMeetingVotingBallotMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements action
{
  registry_id!: number;
}

@InputType(`AnnualGeneralMeetingVotingBallotSignedMetaDocumentInput`)
// implements action - здесь мы убираем имплементацию т.к. обогащае данными на уровне фабрики документов в дальнейшем
export class AnnualGeneralMeetingVotingBallotSignedMetaDocumentInputDTO extends IntersectionType(
  BaseAnnualGeneralMeetingVotingBallotMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType(`AnnualGeneralMeetingVotingBallotSignedDocumentInput`)
export class AnnualGeneralMeetingVotingBallotSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => AnnualGeneralMeetingVotingBallotSignedMetaDocumentInputDTO, {
    description: 'Метаинформация для создания протокола решения',
  })
  public readonly meta!: AnnualGeneralMeetingVotingBallotSignedMetaDocumentInputDTO;
}
