import { InputType, Field } from '@nestjs/graphql';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('PassportInput')
export class PassportInputDTO {
  @Field()
  @NoMarkup()
  code!: string;

  @Field()
  @NoMarkup()
  issued_at!: string;

  @Field()
  @NoMarkup()
  issued_by!: string;

  @Field()
  number!: number;

  @Field()
  series!: number;
}
