#!/usr/bin/env node
/**
 * Сюита документации приложения «Кооперативный участок»: стенд CI ui-docs.yaml.
 *
 * Главный путь — учреждение участка собранием пайщиков: объявление, участие,
 * голосование, протокол, заявление в совет, решение совета, новый участок,
 * доверенные лица. Сценарии идут строго по порядку: каждый продолжает
 * состояние предыдущего. Стенд готовят фазы ku:<фаза>
 * (components/api-tests/src/seed/ku) и marketplace:02-branches (участки krg/odn/myt).
 *
 *   node bin/run-ku-all.mjs
 *   node bin/run-ku-all.mjs --only=ku/admin/branches
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'L0 — председатель включает «Кооперативный участок»',
    scenarios: ['ku/admin/install'],
  },
  {
    name: 'Участки кооператива',
    scenarios: ['ku/admin/branches'],
  },
  {
    name: 'Учреждение участка собранием пайщиков',
    scenarios: [
      'ku/member/meeting-create',
      'ku/member/meeting-join',
      'ku/member/meeting-vote',
      'ku/member/meeting-council',
    ],
  },
  {
    name: 'Доверенные лица участка',
    scenarios: [
      'ku/member/trusted-request',
      'ku/branch-chairman/trusted-approve',
    ],
  },
];

process.exit(await runSuite({ app: 'ku', groups: GROUPS, args: process.argv.slice(2) }));
