import { ObjectType, Field } from '@nestjs/graphql';
import { IsString, IsOptional } from 'class-validator';
import type { DesktopWorkspaceDomainInterface } from '~/domain/desktop/interfaces/desktop-workspace-domain.interface';

@ObjectType('DesktopWorkspace')
export class DesktopWorkspaceDTO implements DesktopWorkspaceDomainInterface {
  @Field(() => String, { description: 'Уникальное имя workspace' })
  @IsString()
  public readonly name!: string;

  @Field(() => String, { description: 'Отображаемое название workspace' })
  @IsString()
  public readonly title!: string;

  @Field(() => String, { description: 'Имя расширения, которому принадлежит этот workspace' })
  @IsString()
  public readonly extension_name!: string;

  @Field(() => String, { nullable: true, description: 'Иконка для меню' })
  @IsOptional()
  @IsString()
  public readonly icon?: string;

  @Field(() => String, { nullable: true, description: 'Маршрут по умолчанию для этого workspace' })
  @IsOptional()
  @IsString()
  public readonly defaultRoute?: string;

  @Field(() => [String], {
    nullable: true,
    description:
      'Права доступа текущего пользователя в расширении (вид «Resource:action»). ' +
      'Фронт показывает страницу/стол, если её требование входит в этот список. ' +
      'Отсутствует у расширений, не использующих канон прав доступа.',
  })
  @IsOptional()
  public readonly grants?: string[];

  constructor(data: DesktopWorkspaceDomainInterface) {
    this.name = data.name;
    this.title = data.title;
    this.extension_name = data.extension_name;
    this.icon = data.icon;
    this.defaultRoute = data.defaultRoute;
    this.grants = data.grants;
  }
}
