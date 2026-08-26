/**
 * Расширение «Стол поддержки»: два рабочих стола.
 *
 *   1. `support`        — стол пайщика: свои обращения и подача нового.
 *   2. `support-office` — стол совета: очередь обращений кооператива.
 *
 * **Почему два, а не один.** У столов разный состав операций: очередь и
 * счётчики доступны только совету, а стол пайщика их не знает вовсе. Собирать
 * это в один стол с половиной скрытых пунктов меню — то, от чего в Столе
 * заказов уже отказались, разведя роли по столам `market` / `market-supplier` /
 * `market-pvz`.
 *
 * Оба имени объявлены в реестре бэкенда (`AppRegistry['support'].desktops`).
 * Стол, которого там нет, теряет свои маршруты молча — без ошибки и без
 * предупреждения.
 *
 * ── Права ──────────────────────────────────────────────────────────────────
 * Видимость задаётся не ролями, а требованиями `meta.requires`, которые
 * `SupportDesktopGrantsProvider` выдаёт пайщику набором прав. Ветка `roles` в
 * навигационном гарде названа устаревшей им же самим, и заводить на ней новое
 * расширение — значит сразу класть его в очередь на переделку.
 *
 * **Почему у страниц пайщика требование всё же есть, хотя «требований нет».**
 * Провайдер прав один на расширение, и платформа прикрепляет его ответ ко всем
 * столам расширения сразу. Значит стол пайщика становится грант-управляемым за
 * компанию со столом совета, а в таком столе страница БЕЗ требования считается
 * скрытой (`DesktopStore.isPageVisible`: пустой набор прав иначе открыл бы её
 * всем подряд). Поэтому «обращение может подать любой пайщик» выражено правом
 * `SupportTicket:create`, которое провайдер выдаёт каждому пайщику, а не
 * отсутствием требования — иначе стол пайщика не увидел бы никто.
 *
 * **Шлюза (`meta.gate`) у стола нет** — расширение ставится по умолчанию,
 * оферты и решения совета ему не нужны, онбординговых маркеров тоже.
 *
 * **Права прячут, отказывает сервер.** Настоящая проверка — на резолверах;
 * третьего места с теми же правилами заводить не нужно.
 */
import { markRaw } from 'vue';
import { agreementsBase } from 'src/shared/lib/consts/workspaces';
import type { IWorkspaceConfig, IWorkspaceRoute } from 'src/shared/lib/types/workspace';
import {
  MyTicketsPage,
  CreateTicketPage,
  TicketDetailPage,
  QueuePage,
  OperatorTicketDetailPage,
} from './pages';

/** Страницы стола пайщика: список, подача, карточка и вызов чата. */
function memberChildren(): IWorkspaceRoute[] {
  return [
    {
      // Пустой путь: «Мои обращения» — это и есть корень стола, а не
      // страница внутри него. Так же устроен вход в другие столы.
      //
      // ВРЕМЕННАЯ ПОДПИСЬ — вместе с подписью пункта чата ниже ждёт
      // решения председателя: два входа на одном столе ведут в разные
      // организации (совет своего кооператива против поддержки
      // платформы), и подписи обязаны это разводить.
      path: '',
      name: 'support-my-tickets',
      component: markRaw(MyTicketsPage),
      meta: {
        title: 'Мои обращения',
        icon: 'inbox',
        requires: 'SupportTicket:create',
        requiresAuth: true,
        agreements: agreementsBase,
      },
      children: [],
    },
    {
      path: 'new',
      name: 'support-ticket-create',
      component: markRaw(CreateTicketPage),
      meta: {
        title: 'Новое обращение',
        icon: 'edit_note',
        requires: 'SupportTicket:create',
        requiresAuth: true,
        agreements: agreementsBase,
      },
      children: [],
    },
    {
      // ВАЖНО: путь и имя менять нельзя не «по традиции», а потому что на
      // них уже ссылаются письма уведомлений — ссылка собирается как
      // `{frontendUrl}/{coopname}/support/{id}` в
      // `SupportTicketNotificationService.buildTicketUrl`.
      path: ':id',
      name: 'support-ticket',
      component: markRaw(TicketDetailPage),
      meta: {
        title: 'Обращение',
        requires: 'SupportTicket:create',
        requiresAuth: true,
        agreements: agreementsBase,
        // В навигацию не идёт: вход только из списка или по ссылке из
        // письма. Иконки поэтому нет — drawer её и не спросит.
        hidden: true,
      },
      children: [],
    },
    {
      // Быстрый чат поддержки платформы. Переехал сюда из расширения
      // `participant` вместе с именем `support`: пункт вызывает
      // зарегистрированное действие, а не открывает страницу, поэтому у
      // него `action` вместо `component`.
      //
      // ВНИМАНИЕ: чат и обращения ведут в РАЗНЫЕ организации. Chatwoot
      // поднимается с единственным зашитым ключом на
      // `support.coopenomics.world` — это поддержка ПЛАТФОРМЫ, общая для
      // всех кооперативов. Обращения адресуются совету СВОЕГО
      // кооператива. Подписи обязаны это разводить, иначе потоки
      // перепутаются.
      //
      // ВРЕМЕННАЯ ПОДПИСЬ — ждёт решения председателя.
      //
      // Компонента у маршрута нет намеренно: пункт вызывает действие и
      // никуда не ведёт (так же устроен `marketplace-pvz-scan`). Базовых
      // соглашений тоже нет — их не было и у прежнего пункта в
      // `participant`, а закрывать обращение за помощью до подписи
      // документов значит запирать человека там, где он и застрял.
      path: 'chat',
      name: 'support-platform-chat',
      meta: {
        title: 'Чат с поддержкой платформы',
        icon: 'chat',
        requires: 'SupportTicket:create',
        requiresAuth: true,
        action: 'toggleSupportChat',
      },
      children: [],
    },
  ];
}

/**
 * Стол пайщика: свои обращения, подача нового и быстрый чат с поддержкой
 * платформы.
 *
 * Столы объявлены отдельными функциями, а не одним списком: вместе они не
 * помещаются в предел размера функции, а порознь читаются лучше — у каждого
 * стола своя доступность и свой состав страниц.
 */
function memberWorkspace(): IWorkspaceConfig {
  return {
    workspace: 'support',
    extension_name: 'support',
    title: 'Поддержка',
    icon: 'support_agent',
    defaultRoute: 'support-my-tickets',
    routes: [
      {
        meta: {
          title: 'Поддержка',
          icon: 'support_agent',
        },
        path: '/:coopname/support',
        name: 'support',
        children: memberChildren(),
      },
    ],
  };
}

/** Стол совета: очередь обращений кооператива. */
function officeWorkspace(): IWorkspaceConfig {
  return {
    workspace: 'support-office',
    extension_name: 'support',
    title: 'Поддержка (совет)',
    icon: 'support_agent',
    defaultRoute: 'support-queue',
    routes: [
      {
        meta: {
          title: 'Поддержка (совет)',
          icon: 'support_agent',
        },
        path: '/:coopname/support-office',
        name: 'support-office',
        children: [
          {
            path: '',
            name: 'support-queue',
            component: markRaw(QueuePage),
            meta: {
              title: 'Очередь',
              icon: 'inbox',
              requires: 'SupportTicket:operate',
              requiresAuth: true,
              agreements: agreementsBase,
            },
            children: [],
          },
          {
            path: ':id',
            name: 'support-office-ticket',
            component: markRaw(OperatorTicketDetailPage),
            meta: {
              title: 'Обращение',
              requires: 'SupportTicket:operate',
              requiresAuth: true,
              agreements: agreementsBase,
              // Вход из очереди, в навигации не показывается.
              hidden: true,
            },
            children: [],
          },
        ],
      },
    ],
  };
}

export default async function (): Promise<IWorkspaceConfig[]> {
  return [memberWorkspace(), officeWorkspace()];
}
