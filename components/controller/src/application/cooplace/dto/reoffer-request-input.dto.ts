import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType('ReofferRequestInput')
export class ReofferRequestInputDTO {
  @Field(() => String)
  @IsString()
  request_hash!: string;

  @Field(() => String)
  @IsString()
  new_hash!: string;

  @Field(() => String)
  @IsString()
  new_unit_cost!: string;

  @Field(() => String)
  @IsString()
  new_meta!: string;
}
