import { registerEnumType } from '@nestjs/graphql';

/**
 * Тип редактируемой сущности с историей редакций: проект/компонент, задача, артефакт (требование).
 */
export enum ContentEntityType {
  PROJECT = 'PROJECT',
  ISSUE = 'ISSUE',
  STORY = 'STORY',
}

registerEnumType(ContentEntityType, {
  name: 'CapitalContentEntityType',
  description: 'Тип сущности с историей редакций: PROJECT (проект/компонент), ISSUE (задача), STORY (артефакт/требование)',
});
