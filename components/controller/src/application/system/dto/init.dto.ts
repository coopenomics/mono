import { Field, InputType } from '@nestjs/graphql';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { CreateInitOrganizationDataInputDTO } from '~/application/account/dto/create-organization-data-input.dto';

@InputType('Init')
export class InitDTO {
  @Field(() => CreateInitOrganizationDataInputDTO, {
    description: 'Объект организации кооператива, которая обслуживает данный экземпляр программного обеспечения MONO',
  })
  @ValidateNested()
  organization_data!: CreateInitOrganizationDataInputDTO;

  @Field(() => Boolean, {
    nullable: true,
    description:
      'Признак того, что инициализация выполняется со стороны провайдера. При true coopback ставит init_by_server=true (org_data становится readonly для пользовательского визарда). Поле передаёт provider в callInitSystemMutation.',
  })
  @IsBoolean()
  @IsOptional()
  is_server_init?: boolean;
}
