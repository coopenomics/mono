import { InputType, Field, GraphQLISODateTime } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Входные параметры запроса проверки инварианта Dr=Cr по журналу ledger2.
 * fromDate / toDate включительно; если не указаны — весь журнал.
 */
@InputType('ValidateJournalInvariantInput')
export class ValidateJournalInvariantInputDTO {
  @Field(() => String, {
    description: 'Имя кооператива (scope таблицы journal в контракте ledger2)',
  })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Нижняя граница диапазона по created_at включительно (ISO-8601). Если не указана — с начала журнала.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Верхняя граница диапазона по created_at включительно (ISO-8601). Если не указана — до конца журнала.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;
}
