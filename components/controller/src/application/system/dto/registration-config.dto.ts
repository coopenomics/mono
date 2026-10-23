import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IsString, IsBoolean, IsNumber, IsArray, IsOptional } from 'class-validator';
import { AccountType } from '~/application/account/enum/account-type.enum';
import { GraphQLJSON } from 'graphql-type-json';
import type {
  IRegistrationIntakeForm,
  IRegistrationProgram,
} from '~/domain/registration/config/agreement-config.interface';

/**
 * Анкета, которую заявитель заполняет при вступлении. Поля описаны JSON Schema
 * в том же виде, что схема настроек расширения, — их рисует та же форма.
 */
@ObjectType('RegistrationIntakeForm')
export class RegistrationIntakeFormDTO {
  @Field({ description: 'Идентификатор анкеты' })
  @IsString()
  id!: string;

  @Field({ description: 'Заголовок анкеты' })
  @IsString()
  title!: string;

  @Field({ nullable: true, description: 'Пояснение над полями: зачем кооперативу эти сведения' })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => GraphQLJSON, { description: 'JSON Schema полей анкеты' })
  schema!: Record<string, unknown>;

  @Field(() => Int, { description: 'Порядок отображения' })
  @IsNumber()
  order!: number;

  constructor(data?: IRegistrationIntakeForm) {
    if (data) {
      this.id = data.id;
      this.title = data.title;
      this.description = data.description;
      this.schema = data.schema;
      this.order = data.order;
    }
  }
}

/**
 * DTO для описания программы регистрации
 */
@ObjectType('RegistrationProgram')
export class RegistrationProgramDTO {
  @Field({ description: 'Уникальный ключ программы' })
  @IsString()
  key!: string;

  @Field({ description: 'Название программы для отображения' })
  @IsString()
  title!: string;

  @Field({ description: 'Описание программы' })
  @IsString()
  description!: string;

  @Field({ nullable: true, description: 'URL изображения (опционально)' })
  @IsString()
  @IsOptional()
  image_url?: string;

  @Field({ nullable: true, description: 'Минимальные требования для участия' })
  @IsString()
  @IsOptional()
  requirements?: string;

  @Field(() => [AccountType], { description: 'Для каких типов аккаунтов доступна программа' })
  @IsArray()
  applicable_account_types!: AccountType[];

  @Field(() => Int, { description: 'Порядок отображения' })
  @IsNumber()
  order!: number;

  @Field(() => [RegistrationIntakeFormDTO], {
    description: 'Анкеты, которые заявитель заполняет, выбрав программу',
  })
  @IsArray()
  intake_forms!: RegistrationIntakeFormDTO[];

  constructor(data?: IRegistrationProgram) {
    if (data) {
      this.key = data.key;
      this.title = data.title;
      this.description = data.description;
      this.image_url = data.image_url;
      this.requirements = data.requirements;
      this.applicable_account_types = data.applicable_account_types;
      this.order = data.order;
      this.intake_forms = (data.intake_forms ?? []).map((form) => new RegistrationIntakeFormDTO(form));
    }
  }
}

/**
 * DTO для конфигурации программ регистрации
 */
@ObjectType('RegistrationConfig')
export class RegistrationConfigDTO {
  @Field({ description: 'Нужен ли выбор программы' })
  @IsBoolean()
  requires_selection!: boolean;

  @Field(() => [RegistrationProgramDTO], { description: 'Доступные программы' })
  @IsArray()
  programs!: RegistrationProgramDTO[];

  @Field(() => [RegistrationIntakeFormDTO], {
    description: 'Анкеты, которые заполняет любой заявитель этого типа аккаунта, независимо от программы',
  })
  @IsArray()
  intake_forms!: RegistrationIntakeFormDTO[];

  constructor(data?: {
    requires_selection: boolean;
    programs: IRegistrationProgram[];
    intake_forms?: IRegistrationIntakeForm[];
  }) {
    if (data) {
      this.requires_selection = data.requires_selection;
      this.programs = data.programs.map((p) => new RegistrationProgramDTO(p));
      this.intake_forms = (data.intake_forms ?? []).map((form) => new RegistrationIntakeFormDTO(form));
    }
  }
}
