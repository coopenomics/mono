import { InputType, Field } from '@nestjs/graphql';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('RepresentedByInput')
export class RepresentedByInputDTO {
  @Field()
  @NoMarkup()
  based_on!: string;

  @Field()
  @NoMarkup()
  first_name!: string;

  @Field()
  @NoMarkup()
  last_name!: string;

  @Field()
  @NoMarkup()
  middle_name!: string;

  @Field()
  @NoMarkup()
  position!: string;
}
