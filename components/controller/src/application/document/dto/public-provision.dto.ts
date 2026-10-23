import { Field, ObjectType, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsString } from 'class-validator';

@ObjectType('PublicProvision')
export class PublicProvisionDTO {
  @Field(() => String, { description: 'Название положения' })
  @IsString()
  title!: string;

  @Field(() => String, { description: 'HTML положения, собранный из шаблона реестра в блокчейне' })
  @IsString()
  html!: string;
}

@InputType('GetPublicProvisionInput')
export class GetPublicProvisionInputDTO {
  @Field(() => Int, { description: 'Идентификатор шаблона в реестре документов' })
  @IsInt()
  registry_id!: number;
}
