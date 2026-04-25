import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

@InputType('ReqReturnInput')
export class ReqReturnInputDTO {
  @Field(() => String)
  @IsString()
  username!: string;

  @Field(() => String)
  @IsString()
  request_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO)
  return_statement!: SignedDigitalDocumentInputDTO;
}
