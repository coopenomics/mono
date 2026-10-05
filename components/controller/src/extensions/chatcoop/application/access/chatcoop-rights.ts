import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  desktopGrantsOf,
  memberRolesOf,
  type AppRights,
  type MemberRole,
  type RightsCaller,
  type RightsTable,
} from '@coopenomics/extension-kit';
import { DESKTOP_GRANTS_REGISTRY_PORT, type IDesktopGrantsRegistryPort } from '@coopenomics/innercoop';

/** Имя рабочего стола расширения: под ним выдаются права страниц. */
export const CHATCOOP_DESKTOP_NAME = 'chatcoop';

/** Права пайщика на Столе связи: своя учётная запись связи, календарь, комнаты, расшифровки. */
const MEMBER_RIGHTS = {
  ChatAccount: ['manage:own'],
  Calendar: ['read', 'subscribe:own'],
  ChatRoom: ['read'],
  Transcription: ['read', 'annotate'],
};

/**
 * Таблица прав Стола связи (C28-87): роль → право `Ресурс:действие`.
 *
 * Совет проходит по роли в любом статусе учётной записи, поэтому права
 * пайщика названы в его строке повторно. В какую именно комнату пайщик
 * вхож, решает членство в проекте — эту сверку ведёт сервис связи.
 */
export const chatcoopRightsTable: RightsTable<MemberRole, never> = {
  participant: [{ when: [], rights: MEMBER_RIGHTS }],
  council: [
    {
      when: [],
      rights: {
        ...MEMBER_RIGHTS,
        Calendar: ['read', 'subscribe:own', 'manage'],
        SecretaryRoom: ['manage'],
      },
    },
  ],
  chairman: [],
};

/**
 * Описание прав Стола связи: по нему работают общий гард операций расширения
 * (`RightsGuard`) и права страниц рабочего стола.
 */
@Injectable()
export class ChatcoopRights implements AppRights<MemberRole, never>, OnModuleInit {
  readonly extensionName = CHATCOOP_DESKTOP_NAME;
  readonly table = chatcoopRightsTable;

  constructor(@Inject(DESKTOP_GRANTS_REGISTRY_PORT) private readonly grantsRegistry: IDesktopGrantsRegistryPort) {}

  onModuleInit(): void {
    this.grantsRegistry.register(desktopGrantsOf(this));
  }

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }
}
