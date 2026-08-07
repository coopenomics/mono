import { Field, ObjectType } from '@nestjs/graphql';

/**
 * Маркет-контекст текущего пайщика: устанавливается `MarketplaceMembershipGuard`
 * в request/ctx после проверки членства в кооперативе (Story 1.3).
 *
 * `core_roles` — массив core-ролей платформы (`User` / `Member` / `Chairman`).
 * `marketplace_roles` — массив marketplace-специфичных ролей (`buyer`/`supplier`/
 * `recipient`/`treasurer`/`controller`), наполняется в Story 1.6. Сейчас пусто.
 */
/**
 * Настройки адресного хранения, применимые к рабочим столам склада (Эпик 19).
 * Приезжают вместе с контекстом пайщика, чтобы интерфейс не показывал боксы
 * и координаты там, где кооператив их не включал.
 */
@ObjectType('MarketplaceWarehouseSettings')
export class MarketplaceWarehouseSettingsDTO {
  @Field(() => Boolean, { description: 'Имущество складывается в боксы — тару со своим QR-кодом.' })
  public readonly containers_enabled!: boolean;

  @Field(() => Boolean, {
    description: 'Склад адресуется координатами «секция × ярус».',
  })
  public readonly cells_enabled!: boolean;

  @Field(() => Boolean, {
    description: 'Место хранения указывается при закрывающей подписи акта приёмки.',
  })
  public readonly posting_on_reception_required!: boolean;

  constructor(init: {
    containers_enabled: boolean;
    cells_enabled: boolean;
    posting_on_reception_required: boolean;
  }) {
    this.containers_enabled = init.containers_enabled;
    this.cells_enabled = init.cells_enabled;
    this.posting_on_reception_required = init.posting_on_reception_required;
  }
}

@ObjectType('MarketplaceCurrentMember')
export class MarketplaceCurrentMemberDTO {
  @Field(() => String)
  public readonly username!: string;

  @Field(() => [String])
  public readonly core_roles!: string[];

  @Field(() => [String])
  public readonly marketplace_roles!: string[];

  @Field(() => [String], {
    description: 'Кооперативные участки, в которых пайщик — доверенное лицо (для столов оператора ПВЗ)',
  })
  public readonly branches!: string[];

  @Field(() => MarketplaceWarehouseSettingsDTO, {
    description: 'Настройки адресного хранения, включённые в кооперативе.',
  })
  public readonly warehouse_settings!: MarketplaceWarehouseSettingsDTO;

  constructor(init: {
    username: string;
    core_roles: string[];
    marketplace_roles: string[];
    branches: string[];
    warehouse_settings: MarketplaceWarehouseSettingsDTO;
  }) {
    this.username = init.username;
    this.core_roles = init.core_roles;
    this.marketplace_roles = init.marketplace_roles;
    this.branches = init.branches;
    this.warehouse_settings = init.warehouse_settings;
  }
}

export interface IMarketplaceCurrentMember {
  username: string;
  core_roles: string[];
  marketplace_roles: string[];
}
