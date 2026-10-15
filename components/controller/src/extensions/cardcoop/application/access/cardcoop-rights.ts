import { Injectable } from '@nestjs/common';
import { memberRolesOf, type AppRights, type MemberRole, type RightsCaller, type RightsTable } from '@coopenomics/extension-kit';

/**
 * Таблица прав расширения «Карта кооператора» (C28-87): свою карту читает
 * принятый пайщик и совет. Страница карты стоит на столе пайщика — право
 * страницы выдаёт таблица ядра.
 */
export const cardcoopRightsTable: RightsTable<MemberRole, never> = {
  participant: [{ when: [], rights: { Card: ['read:own'] } }],
  council: [{ when: [], rights: { Card: ['read:own'] } }],
  chairman: [],
};

/** Описание прав расширения для общего гарда операций (`RightsGuard`). */
@Injectable()
export class CardcoopRights implements AppRights<MemberRole, never> {
  readonly extensionName = 'cardcoop';
  readonly table = cardcoopRightsTable;

  async roles(caller: RightsCaller): Promise<MemberRole[]> {
    return memberRolesOf(caller);
  }
}
