#!/usr/bin/env node
/**
 * Сюита документации стола председателя: стенд CI ui-docs.yaml (ветка
 * ci/ui-docs-chairman). Фаза chairman:01-approval заводит договор на подпись.
 *
 *   node bin/run-chairman-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Стол председателя',
    scenarios: [
      'chairman/onboarding',
      'chairman/approvals',
      'chairman/access-roles',
      'chairman/agenda-presets',
      'chairman/notifications-journal',
      'chairman/app-store',
      'chairman/start-pages',
      'chairman/board-members',
      'chairman/cooperative-branches',
      'chairman/registration-fees',
      'chairman/cooperative-key',
      'chairman/payment-provider',
      'chairman/cooperative-contacts',
    ],
  },
];

process.exit(await runSuite({ app: 'chairman', groups: GROUPS, args: process.argv.slice(2) }));
