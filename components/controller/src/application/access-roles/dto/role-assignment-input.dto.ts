import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('RoleAssignmentInput')
export class RoleAssignmentInputDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, { description: 'Ключ роли' })
  @IsString()
  @IsNotEmpty()
  role!: string;
}
