import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('CapitalDeallocationLimitInput')
export class DeallocationLimitInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Идентификатор проекта или компонента.' })
  @IsNotEmpty()
  @IsString()
  project_hash!: string;
}

/**
 * Сколько средств можно вернуть из компонента в программу и чем эта сумма ограничена.
 *
 * Итоговый предел — минимум из трёх границ. Возвращаем и составляющие, чтобы
 * председатель видел причину: «больше нельзя, потому что участникам уже выданы
 * ссуды» читается иначе, чем «больше в компонент и не направляли».
 */
@ObjectType('CapitalDeallocationLimit', {
  description: 'Предел возврата средств из компонента в программу',
})
export class DeallocationLimitOutputDTO {
  @Field(() => String, {
    description: 'Максимальная сумма, доступная к возврату',
  })
  max_amount!: string;

  @Field(() => String, {
    description: 'Средства программы, направленные в компонент',
  })
  program_invest_pool!: string;

  @Field(() => String, {
    description: 'Не израсходованная компонентом часть полученных средств',
  })
  unspent!: string;

  @Field(() => String, {
    description: 'Сумма непогашенных ссуд участников компонента',
  })
  outstanding_debt!: string;

  @Field(() => Boolean, {
    description: 'Разрешён ли возврат в текущем статусе компонента',
  })
  is_allowed_by_status!: boolean;
}
