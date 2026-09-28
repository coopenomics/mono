import { Type } from 'class-transformer';
import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, ValidateNested } from 'class-validator';
import { VarsInputDTO } from './vars-input.dto';
import { UpdateOrganizationDataInputDTO } from '~/application/account/dto/update-organization-data-input.dto';

@InputType('Update')
export class UpdateDTO {
  @Field(() => VarsInputDTO, {
    description: 'Переменные кооператива, используемые для заполнения шаблонов документов',
    nullable: true,
  })
  @ValidateNested()
  @Type(() => VarsInputDTO)
  @IsOptional()
  vars?: VarsInputDTO;

  @Field(() => UpdateOrganizationDataInputDTO, {
    nullable: true,
    description: 'Собственные данные кооператива, обслуживающего экземпляр платформы',
  })
  @ValidateNested()
  @Type(() => UpdateOrganizationDataInputDTO)
  @IsOptional()
  organization_data?: UpdateOrganizationDataInputDTO;
}
