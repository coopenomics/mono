import { Field, InputType } from '@nestjs/graphql';
import { IsIn, ValidateNested } from 'class-validator';
import { CreateSovietIndividualDataInputDTO } from '~/application/account/dto/create-individual-data-input.dto';
import { t } from '~/i18n';

@InputType('SovietMemberInput')
export class SovietMemberInputDTO {
  @Field(() => CreateSovietIndividualDataInputDTO)
  @ValidateNested()
  individual_data!: CreateSovietIndividualDataInputDTO;

  @Field(() => String)
  @IsIn(['chairman', 'member'], { message: t('system.sovietMemberInput.roleInvalid') })
  role!: 'chairman' | 'member';
}
