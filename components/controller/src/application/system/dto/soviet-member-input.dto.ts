import { Type } from 'class-transformer';
import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsIn, ValidateNested } from 'class-validator';
import { CreateSovietIndividualDataInputDTO } from '~/application/account/dto/create-individual-data-input.dto';

@InputType('SovietMemberInput')
export class SovietMemberInputDTO {
  @Field(() => CreateSovietIndividualDataInputDTO)
  @ValidateNested()
  @Type(() => CreateSovietIndividualDataInputDTO)
  individual_data!: CreateSovietIndividualDataInputDTO;

  @Field(() => String)
  @IsIn(['chairman', 'member'], { message: validationMessage('system.sovietMemberInput.roleInvalid') })
  role!: 'chairman' | 'member';
}
