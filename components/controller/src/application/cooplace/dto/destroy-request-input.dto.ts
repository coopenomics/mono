import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

@InputType('DestroyRequestInput')
export class DestroyRequestInputDTO {
  @Field(() => String)
  @IsString()
  request_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO)
  destruction_act!: SignedDigitalDocumentInputDTO;
}
