import type { DesktopWorkspaceDomainInterface } from '../interfaces/desktop-workspace-domain.interface';

export class DesktopWorkspaceDomainEntity implements DesktopWorkspaceDomainInterface {
  public readonly name: string;
  public readonly title: string;
  public readonly extension_name: string;
  public readonly icon?: string;
  public readonly defaultRoute?: string;
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
