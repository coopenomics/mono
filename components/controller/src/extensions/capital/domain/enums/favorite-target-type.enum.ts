import { registerEnumType } from '@nestjs/graphql';

/** Тип сущности, добавляемой в избранное */
export enum FavoriteTargetType {
  PROJECT = 'PROJECT',
  COMPONENT = 'COMPONENT',
  ISSUE = 'ISSUE',
  ARTIFACT = 'ARTIFACT',
}

registerEnumType(FavoriteTargetType, {
  name: 'CapitalFavoriteTargetType',
  description: 'Тип сущности в избранном: проект, компонент, задача или артефакт',
});
