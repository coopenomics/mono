import { InputType, Field } from '@nestjs/graphql';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('EntrepreneurDetailsInput')
export class EntrepreneurDetailsInputDTO {
  @Field(() => String, { description: 'ИНН' })
  @NoMarkup()
  inn!: string;

  @Field(() => String, { description: 'ОГРН' })
  @NoMarkup()
  ogrn!: string;
}
