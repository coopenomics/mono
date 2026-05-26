import { Injectable } from '@nestjs/common';
import config from '~/config/config';
import { ExtensionListingInteractor } from '~/application/appstore/interactors/extension-listing.interactor';
import { DesktopDomainEntity } from '~/domain/desktop/entities/desktop-domain.entity';
import { DesktopWorkspaceDomainEntity } from '~/domain/desktop/entities/workspace-domain.entity';
import { AppRegistry } from '~/extensions/extensions.registry';
import { ExtensionGrantsRegistry } from '../extension-grants.registry';

/** Текущий пользователь из JWT (или undefined для гостя). */
export interface IDesktopRequester {
  username?: string;
  role?: string;
  status?: string;
}

@Injectable()
export class DesktopDomainInteractor {
  constructor(
    private readonly extensionListingInteractor: ExtensionListingInteractor,
    private readonly grantsRegistry: ExtensionGrantsRegistry,
  ) {}

  async getDesktop(requester?: IDesktopRequester): Promise<DesktopDomainEntity> {
    // Получаем установленные desktop расширения
    const apps = await this.extensionListingInteractor.getCombinedAppList({
      is_installed: true,
      is_desktop: true,
      is_available: true,
      enabled: true,
    });

    // Разворачиваем массивы desktops из каждого расширения
    const workspaces: DesktopWorkspaceDomainEntity[] = [];

    for (const app of apps) {
      const registryData = AppRegistry[app.name];
      if (!registryData?.desktops) continue;

      // Канон авторизации столов: если у расширения есть провайдер грантов,
      // вычисляем плоский набор прав текущего пользователя ОДИН раз и
      // прикрепляем его ко всем столам расширения. Видимость столов и страниц
      // (включая онбординг-гейтинг до принятия ЦПП) фронт выводит из грантов,
      // а резолверы расширения остаются настоящим enforcement'ом.
      // Расширение без провайдера → grants=undefined → фронт на legacy ролях.
      const grants = await this.grantsRegistry.resolve(app.name, {
        coopname: config.coopname,
        username: requester?.username,
        userRole: requester?.role,
        userStatus: requester?.status,
        config: app.config,
      });

      for (const desktop of registryData.desktops) {
        workspaces.push(
          new DesktopWorkspaceDomainEntity({
            name: desktop.name,
            title: desktop.title,
            extension_name: app.name,
            icon: desktop.icon,
            defaultRoute: desktop.defaultRoute,
            grants,
          }),
        );
      }
    }

    const layout = 'default';

    return new DesktopDomainEntity({
      coopname: config.coopname,
      layout,
      workspaces,
    });
  }
}
