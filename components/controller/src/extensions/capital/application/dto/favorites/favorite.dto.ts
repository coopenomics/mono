import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { FavoriteTargetType } from '../../../domain/enums/favorite-target-type.enum';

@InputType('CapitalFavoriteInput', {
  description: 'Добавление или удаление сущности в избранном пользователя',
})
export class CapitalFavoriteInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя — владельца избранного' })
  @IsString()
  username!: string;

  @Field(() => FavoriteTargetType, {
    description: 'Тип сущности: проект, компонент, задача или артефакт',
  })
  @IsEnum(FavoriteTargetType)
  target_type!: FavoriteTargetType;

  @Field(() => String, { description: 'Хеш сущности' })
  @IsString()
  target_hash!: string;
}

@InputType('CapitalFavoritesFilter', {
  description: 'Фильтр списка избранного',
})
export class CapitalFavoritesFilterInputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя — владельца избранного' })
  @IsString()
  username!: string;
}

@ObjectType('CapitalFavorite', {
  description: 'Запись избранного с актуальным наименованием сущности',
})
export class CapitalFavoriteOutputDTO {
  @Field(() => String, { description: 'Имя кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя — владельца избранного' })
  username!: string;

  @Field(() => FavoriteTargetType, {
    description: 'Тип сущности: проект, компонент, задача или артефакт',
  })
  target_type!: FavoriteTargetType;

  @Field(() => String, { description: 'Хеш сущности' })
  target_hash!: string;

  @Field(() => String, { description: 'Актуальное наименование сущности' })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш родителя: у компонента — проект, у задачи и артефакта — владелец',
  })
  parent_hash!: string | null;

  @Field(() => Date, { description: 'Когда добавлено в избранное' })
  created_at!: Date;
}
