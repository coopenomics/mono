import { InputType, Field } from '@nestjs/graphql';
import { NoMarkup } from '~/shared/validators/no-markup.decorator';

@InputType('OrganizationDetailsInput')
export class OrganizationDetailsInputDTO {
  @Field()
  @NoMarkup()
  inn!: string;

  @Field()
  @NoMarkup()
  kpp!: string;

  @Field()
  @NoMarkup()
  ogrn!: string;
}
