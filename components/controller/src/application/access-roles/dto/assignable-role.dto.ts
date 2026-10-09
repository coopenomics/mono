import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('RoleAssignment', { description: 'Пайщик, которому назначена роль' })
export class RoleAssignmentDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика или название организации' })
  display_name!: string;

  @Field(() => String, { description: 'Учётное имя назначившего роль' })
  assigned_by!: string;

  @Field(() => Date, { description: 'Дата назначения' })
  assigned_at!: Date;
}

@ObjectType('AssignableRole', { description: 'Роль приложения, которую председатель назначает пайщикам' })
export class AssignableRoleDTO {
  @Field(() => String, { description: 'Ключ роли' })
  key!: string;

  @Field(() => String, { description: 'Название роли' })
  title!: string;

  @Field(() => String, { description: 'Что роль открывает пайщику' })
  description!: string;

  @Field(() => String, { description: 'Имя приложения, которое объявило роль' })
  extension_name!: string;

  @Field(() => String, { description: 'Название приложения, которое объявило роль' })
  extension_title!: string;

  @Field(() => [RoleAssignmentDTO], { description: 'Пайщики с этой ролью' })
  assignments!: RoleAssignmentDTO[];
}
