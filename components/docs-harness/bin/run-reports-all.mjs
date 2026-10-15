#!/usr/bin/env node
/**
 * Сюита документации стола бухгалтера (приложение reports): стенд CI
 * ui-docs.yaml (ветка ci/ui-docs-reports). Реестры наполняют фикстуры
 * засева стенда и входящий паевой взнос (фаза soviet:03-payment).
 *
 *   node bin/run-reports-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Стол бухгалтера',
    scenarios: [
      'reports/processes',
      'reports/operations',
      'reports/postings',
      'reports/wallets-coop',
      'reports/wallets-participants',
      'reports/accounts',
      'reports/calendar',
      'reports/forms',
      'reports/archive',
      'reports/ndfl',
      'reports/settings',
    ],
  },
];

process.exit(await runSuite({ app: 'reports', groups: GROUPS, args: process.argv.slice(2) }));
