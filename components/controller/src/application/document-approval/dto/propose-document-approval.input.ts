import { Field, InputType, Int } from '@nestjs/graphql';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString } from 'class-validator';

@InputType('ProposeDocumentApprovalInput')
export class ProposeDocumentApprovalInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => [Int], { description: 'Документы, выносимые на совет одним решением: один документ или пакет одного приложения' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  registry_ids!: number[];

  @Field(() => String, { nullable: true, description: 'Заголовок вопроса повестки; по умолчанию собирается из названий документов' })
  @IsOptional()
  @IsString()
  title?: string;
}
