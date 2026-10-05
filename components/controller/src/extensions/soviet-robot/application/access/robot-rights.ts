import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { councilRolesOf, desktopGrantsOf, type AppRights, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';
import { ROBOT_EXTENSION_NAME } from '../../domain/constants';

/**
 * Исполнители стола «Робот совета»:
 *  - `council`  — член совета: роль узла «член совета» или «председатель»;
 *  - `chairman` — председатель совета.
 * Роль узла следует за составом совета в цепи: ядро переставляет её при
 * каждом обновлении совета, поэтому отдельного условия «входит в совет»
 * таблице не нужно.
 */
export type RobotRole = 'council' | 'chairman';

/**
 * Таблица прав стола «Робот совета» (C28-87): роль → право `Ресурс:действие`.
 *
 * Условий у строк нет: совет проходит по роли и на сервере, и на столе
 * (решение владельца 05.10.2026, как на Столе заказов).
 *
 *  - `Robot:read`          — реестр действий автоматизации, состав совета, журнал решений;
 *  - `Robot:delegate`      — делегировать роботу свой голос (действие в цепи со стола);
 *  - `Robot:authorize`     — делегировать роботу подпись протоколов (действие в цепи со стола);
 *  - `RobotKey:read:own`   — состояние своего ключа;
 *  - `RobotKey:manage:own` — передать и удалить свой ключ;
 *  - `RobotKey:read:all`   — ключи всех членов совета;
 *  - `RobotDecision:retry` — повторить обработку застрявшего решения.
 */
export const robotRightsTable: RightsTable<RobotRole, never> = {
  council: [
    {
      when: [],
      rights: {
        Robot: ['read', 'delegate'],
        RobotKey: ['read:own', 'manage:own'],
      },
    },
  ],
  chairman: [
    {
      when: [],
      rights: {
        Robot: ['authorize'],
        RobotKey: ['read:all'],
        RobotDecision: ['retry'],
      },
    },
  ],
};

/** Роли стола по роли пайщика в узле. */
export function robotRolesOf(role: string | null | undefined): RobotRole[] {
  return councilRolesOf(role);
}

/**
 * Описание прав стола «Робот совета»: из него работают и гард операций, и
 * права страниц рабочего стола.
 */
@Injectable()
export class RobotRights implements AppRights<RobotRole, never>, OnModuleInit {
  readonly extensionName = ROBOT_EXTENSION_NAME;
  readonly table = robotRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<RobotRole[]> {
    return robotRolesOf(caller.role);
  }
}
