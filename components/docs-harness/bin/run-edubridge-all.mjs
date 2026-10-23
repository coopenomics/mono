#!/usr/bin/env node
/**
 * Сюита документации приложения «Образование»: `pnpm test:ui:edubridge`.
 *
 * Группы идут по цепочке состояния стенда: подключение приложения советом →
 * справочники и курс → преподаватель (оферта, договор, допуск) → ученик
 * (оферта, обучающийся, взнос, подписка) → занятия и расчёты → обзорные
 * экраны. Стенд готовят фазы засева `edubridge:<фаза>`
 * (components/api-tests/src/seed/edubridge), сценарии заявляют их в meta.prepare.
 *
 *   node bin/run-edubridge-all.mjs                 прогон на текущем стенде
 *   node bin/run-edubridge-all.mjs --reboot        с reboot:extra (чистая цепь)
 *   node bin/run-edubridge-all.mjs --only=member/catalog
 *   node bin/run-edubridge-all.mjs --from=teacher/lessons
 *
 * Сюита НЕ входит в `pnpm test` и не вызывается из release.yaml.
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    // «L0» — до глобальных prepare-фаз: установка приложения и подключение
    // ЦПП снимаются живыми, на девственном стенде.
    name: 'L0 — кооператив подключает «Образование» (до подготовки стенда)',
    scenarios: [
      'edubridge/admin/install',
      'edubridge/admin/configure',
    ],
  },
  {
    name: 'Справочники и курс',
    scenarios: [
      'edubridge/admin/sections',
      'edubridge/admin/course-create',
      'edubridge/admin/courses',
      'edubridge/admin/platforms',
    ],
  },
  {
    name: 'Преподаватель: подключение и допуск',
    scenarios: [
      // Строго ДО фазы 03-teacher для рабочей фикстуры: гейт снимается на
      // свежем пайщике из пула, рабочую фикстуру подключает фаза.
      'edubridge/teacher/onboarding',
      'edubridge/admin/teachers',
      'edubridge/teacher/profile',
      'edubridge/teacher/assignments',
    ],
  },
  {
    name: 'Ученик: каталог, подключение, подписка',
    scenarios: [
      'edubridge/member/catalog',
      'edubridge/member/course',
      'edubridge/member/onboarding',
      'edubridge/member/learners',
      'edubridge/member/subscribe',
      'edubridge/member/subscriptions',
    ],
  },
  {
    // Путь взноса преподавателя идёт сквозь сценарии: отчёт в календаре →
    // документы и акт на странице отчётов (совет принимает взнос внутри
    // сценария, фаза 06) → подпись председателя на столе администратора →
    // возврат со стола преподавателя → решения совета и кассир (фаза 07, 08)
    // → выплата в выписке. Порядок менять нельзя.
    name: 'Занятия, отчёты и взносы преподавателя',
    scenarios: [
      'edubridge/teacher/lessons',
      'edubridge/teacher/reports',
      'edubridge/admin/contributions',
      'edubridge/teacher/settlement',
      'edubridge/admin/course',
      'edubridge/admin/group',
      'edubridge/admin/calendar',
    ],
  },
  {
    name: 'Деньги программы: экономика, расход, выплаты',
    scenarios: [
      'edubridge/admin/members',
      'edubridge/admin/economy',
      'edubridge/admin/payments',
      'edubridge/teacher/payout',
    ],
  },
];

process.exit(await runSuite({ app: 'edubridge', groups: GROUPS, args: process.argv.slice(2) }));
