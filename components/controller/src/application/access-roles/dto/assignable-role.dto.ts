import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

/** Вид полномочия роли: пайщик видит или меняет. */
export enum RolePermissionAccess {
  READ = 'read',
  WRITE = 'write',
}

registerEnumType(RolePermissionAccess, {
  name: 'RolePermissionAccess',
  description: 'Вид полномочия роли: чтение или запись',
});

@ObjectType('RolePermission', { description: 'Полномочие роли: что пайщик с этой ролью читает или ведёт' })
export class RolePermissionDTO {
  @Field(() => String, { description: 'Что именно читает или ведёт пайщик' })
  title!: string;

  @Field(() => RolePermissionAccess, { description: 'Чтение или запись' })
  access!: RolePermissionAccess;
}

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

  @Field(() => [RolePermissionDTO], { description: 'Полномочия роли по пунктам' })
  permissions!: RolePermissionDTO[];

  @Field(() => [RoleAssignmentDTO], { description: 'Пайщики с этой ролью' })
  assignments!: RoleAssignmentDTO[];
}
