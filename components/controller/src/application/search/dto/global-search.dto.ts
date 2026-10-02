import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import GraphQLJSON from 'graphql-type-json';
import { GlobalSearchGroupStatus } from '../global-search.registry';

registerEnumType(GlobalSearchGroupStatus, {
  name: 'GlobalSearchGroupStatus',
  description: 'Ответила ли группа поиска: ответила, не успела, упала',
});

@InputType('GlobalSearchInput')
export class GlobalSearchInputDTO {
  @Field(() => String, { description: 'Что ищем: имя, ИНН, название документа и так далее' })
  @IsString()
  query!: string;

  @Field(() => Int, { nullable: true, defaultValue: 5, description: 'Сколько находок показать в каждой группе' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}

@ObjectType('GlobalSearchRoute')
export class GlobalSearchRouteDTO {
  @Field(() => String, { description: 'Имя страницы рабочего стола' })
  name!: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Параметры адреса страницы' })
  params?: Record<string, string>;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Параметры запроса в адресе страницы' })
  query?: Record<string, string>;
}

@ObjectType('GlobalSearchHit')
export class GlobalSearchHitDTO {
  @Field(() => String, { description: 'Отличает находку от других в той же группе' })
  key!: string;

  @Field(() => String, { description: 'Что найдено' })
  title!: string;

  @Field(() => String, { nullable: true, description: 'Уточнение: аккаунт, дата, номер' })
  subtitle?: string;

  @Field(() => String, { nullable: true, description: 'Значок находки' })
  icon?: string;

  @Field(() => GlobalSearchRouteDTO, { description: 'Куда ведёт находка' })
  route!: GlobalSearchRouteDTO;
}

@ObjectType('GlobalSearchGroup')
export class GlobalSearchGroupDTO {
  @Field(() => String, { description: 'Ключ группы: пайщики, документы, заказы' })
  key!: string;

  @Field(() => String, { description: 'Заголовок группы' })
  title!: string;

  @Field(() => String, { description: 'Значок группы' })
  icon!: string;

  @Field(() => String, { description: 'Приложение, которому принадлежат находки; ядро — core' })
  extension_name!: string;

  @Field(() => GlobalSearchGroupStatus, { description: 'Ответила ли группа' })
  status!: GlobalSearchGroupStatus;

  @Field(() => [GlobalSearchHitDTO], { description: 'Находки группы' })
  hits!: GlobalSearchHitDTO[];
}
