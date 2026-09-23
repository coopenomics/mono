import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

/**
 * Сигнал ленты изменений: в таблице цепи изменилась строка. Данных строки нет —
 * стол дочитывает авторитетное состояние запросом, иначе сигнал и запрос
 * начнут расходиться.
 */
@ObjectType('ChainChange')
export class ChainChangeDTO {
  @Field(() => String, { description: 'Контракт, чья таблица изменилась.' })
  code!: string;

  @Field(() => String, { description: 'Таблица контракта.' })
  table!: string;

  @Field(() => String, { description: 'Область таблицы — кооператив.' })
  scope!: string;

  @Field(() => String, { description: 'Ключ изменившейся строки.' })
  primary_key!: string;

  @Field(() => Int, { description: 'Блок, в котором строка изменилась; данные этого блока уже в базе узла.' })
  block_num!: number;
}

@InputType('ChainTableInput')
export class ChainTableInputDTO {
  @Field(() => String, { description: 'Контракт.' })
  @IsString()
  code!: string;

  @Field(() => String, { description: 'Таблица контракта.' })
  @IsString()
  table!: string;
}

@InputType('ChainChangesInput')
export class ChainChangesInputDTO {
  @Field(() => String, { description: 'Кооператив; сверяется с кооперативом узла.' })
  @IsString()
  coopname!: string;

  @Field(() => [ChainTableInputDTO], {
    nullable: true,
    description: 'Какие таблицы слушать. Не задано — все таблицы ленты, доступные пайщику.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChainTableInputDTO)
  tables?: ChainTableInputDTO[];
}
