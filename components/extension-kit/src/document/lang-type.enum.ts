import { registerEnumType } from '@nestjs/graphql';

/** Язык, на котором формируется документ. */
export enum LangType {
  ru = 'ru',
}

registerEnumType(LangType, {
  name: 'LangType',
  description: 'Язык документа',
});
