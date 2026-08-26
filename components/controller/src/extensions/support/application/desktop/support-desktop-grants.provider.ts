import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  DESKTOP_GRANTS_REGISTRY_PORT,
  type IDesktopGrantsHook,
  type IDesktopGrantsRegistryPort,
  type InnerDesktopGrantsContext,
} from '@coopenomics/innercoop';
import { isCooperativeRole, isCouncilRole } from '../../constants/support-access';
import {
  SUPPORT_TICKET_CREATE_GRANT,
  SUPPORT_TICKET_OPERATE_GRANT,
} from '../../constants/support-grants';

/**
 * Права пайщика на столах поддержки.
 *
 * Провайдер маленький, потому что и решать тут нечего: роли совет получает из
 * блокчейна, отдельного назначения оператора нет, гейта подключения у стола
 * тоже нет — расширение ставится по умолчанию, оферты и решения совета ему не
 * нужны. Вся логика — две строки: пайщик подаёт обращения, совет ведёт очередь.
 *
 * **Набор один на оба стола.** Платформа зовёт провайдера раз на расширение и
 * прикрепляет ответ ко всем его столам (`desktop.interactor`), поэтому
 * различает столы не провайдер, а требования маршрутов: страницы стола пайщика
 * просят `SupportTicket:create`, страницы стола совета — `SupportTicket:operate`.
 * Совет получает оба права и видит оба стола: член совета остаётся пайщиком и
 * своё обращение подать вправе.
 *
 * **Роли берутся тем же списком, что у резолверов** (`support-access`), а не
 * переписываются здесь заново. Разойдись эти два места — стол показывал бы
 * страницу, на которой сервер отвечает отказом, либо прятал доступную.
 *
 * Сам себя кладёт в реестр при запуске, поэтому ядро не импортирует модуль
 * расширения и цикла зависимостей не возникает.
 */
@Injectable()
export class SupportDesktopGrantsProvider implements IDesktopGrantsHook, OnModuleInit {
  readonly extensionName = 'support';

  constructor(
    @Inject(DESKTOP_GRANTS_REGISTRY_PORT)
    private readonly grantsRegistry: IDesktopGrantsRegistryPort
  ) {}

  onModuleInit(): void {
    this.grantsRegistry.register(this);
  }

  async resolveGrants(ctx: InnerDesktopGrantsContext): Promise<string[]> {
    // Гость и служебная учётная запись вне ролей кооператива не получают
    // ничего — столы им не показываются вовсе.
    //
    // **Статус пайщика здесь намеренно не проверяется.** Резолверы стола
    // пускают по роли и о статусе не спрашивают, а грант строже сервера прячет
    // от человека то, что сервер бы ему отдал. Практическое следствие важнее
    // принципа: на столе пайщика живёт и вызов чата с поддержкой платформы,
    // и он тоже требует `SupportTicket:create`. Отсеки мы неактивных — без
    // обоих входов остался бы ровно тот, у кого что-то со статусом не так и
    // кому надо спросить почему.
    if (!ctx.username) return [];
    if (!isCooperativeRole(ctx.userRole)) return [];

    const grants = [SUPPORT_TICKET_CREATE_GRANT];
    if (isCouncilRole(ctx.userRole)) grants.push(SUPPORT_TICKET_OPERATE_GRANT);
    return grants;
  }
}
