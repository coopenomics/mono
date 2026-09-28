import { Type } from 'class-transformer';
import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { SovietMemberInputDTO } from './soviet-member-input.dto';
import { SetVarsInputDTO } from './set-vars-input.dto';

@InputType('Install')
export class InstallDTO {
  @Field(() => [SovietMemberInputDTO])
  @ValidateNested()
  @Type(() => SovietMemberInputDTO)
  soviet!: SovietMemberInputDTO[];

  @Field(() => SetVarsInputDTO)
  @ValidateNested()
  @Type(() => SetVarsInputDTO)
  vars!: SetVarsInputDTO;

  @Field(() => String, {
    nullable: true,
    description: 'Код установки, выданный startInstall владельцу ключа кооператива. Без него совет установить нельзя.',
  })
  @IsOptional()
  @IsString()
  install_code?: string;
}
