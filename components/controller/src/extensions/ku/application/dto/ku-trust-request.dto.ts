import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';

@ObjectType('KuTrustRequest', { description: 'Заявка на приём доверенным лицом кооперативного участка' })
export class KuTrustRequestDTO {
  @Field(() => String, { description: 'Хэш заявки' })
  hash!: string;

  @Field(() => Int, { nullable: true, description: 'Идентификатор заявки в блокчейне' })
  id?: number;

  @Field(() => String, { nullable: true, description: 'Имя аккаунта кооператива' })
  coopname?: string;

  @Field(() => String, { nullable: true, description: 'Наименование кооперативного участка' })
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-заявитель' })
  username?: string;

  @Field(() => String, { nullable: true, description: 'ФИО пайщика-заявителя' })
  display_name?: string;

  @Field(() => Boolean, { description: 'Существует ли запись в блокчейне (false — рассмотрена и стёрта)' })
  present!: boolean;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Заявление и договор о полной материальной ответственности',
  })
  application?: object;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Доверенность доверенному лицу/оператору участка с подписью заявителя',
  })
  authority?: object;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Договор о полной материальной ответственности с подписью заявителя — для просмотра и встречной подписи председателя',
  })
  document?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Доверенность доверенному лицу с подписью заявителя — для просмотра и встречной подписи председателя',
  })
  authority_document?: DocumentAggregateDTO;

  @Field(() => Int, { nullable: true, description: 'Номер блока последнего обновления' })
  block_num?: number;
}

@InputType('KuTrustRequestFilterInput', { description: 'Фильтр заявок доверенных лиц кооперативных участков' })
export class KuTrustRequestFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Имя аккаунта кооператива' })
  @IsOptional()
  @IsString()
  coopname?: string;

  @Field(() => String, { nullable: true, description: 'Наименование кооперативного участка' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Пайщик-заявитель' })
  @IsOptional()
  @IsString()
  username?: string;

  @Field(() => Boolean, { nullable: true, description: 'Только записи, существующие в блокчейне' })
  @IsOptional()
  @IsBoolean()
  present?: boolean;
}
