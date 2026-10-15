import type { Types, Queries, Zeus } from '@coopenomics/sdk';

export type ZExtension = Queries.Extensions.GetExtensions.IOutput[typeof Queries.Extensions.GetExtensions.name][number]

export type ISchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export type ISchemaProperty = {
  type?: ISchemaType;
  description?: Types.Controller.DeserializedDescriptionOfExtension
  default?: any;
  required?: string[];
  properties?: ISchemaProperty;
  items?: ISchemaProperty; // для массивов
  enum?: any[]; // если поле использует перечисления
  format?: string; // формат строки из Zod (`uri` у z.string().url())
  additionalProperties?: boolean;
};

export type IExtensionConfigSchema = {
  properties: ISchemaProperty;
  required?: string[];
  additionalProperties?: boolean;
  type: ISchemaType;
}


export type IExtension = Omit<Zeus.ModelTypes['Extension'], 'schema'> & {
  schema?: IExtensionConfigSchema;
};
