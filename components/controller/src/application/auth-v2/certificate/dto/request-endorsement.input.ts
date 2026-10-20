import { Field, InputType } from '@nestjs/graphql';
import { IsString, Matches } from 'class-validator';

/** Кооператив просит обслуживающего оператора заверить его ключ заверения. */
@InputType('RequestCooperativeEndorsementInput')
export class RequestCooperativeEndorsementInputDTO {
  @Field(() => String, { description: 'Учётное имя кооператива, опубликовавшего право заверения' })
  @IsString()
  @Matches(/^[a-z1-5.]{1,12}$/)
  coopname!: string;
}
