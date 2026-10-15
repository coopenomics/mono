#!/usr/bin/env node
/**
 * Сюита документации стола пайщика: стенд CI ui-docs.yaml (ветка
 * ci/ui-docs-participant). Пайщик Иван Петров входит через форму.
 *
 *   node bin/run-participant-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Стол пайщика',
    scenarios: [
      'participant/wallet',
      'participant/profile',
      'participant/cardcoop',
      'participant/requisites',
      'participant/documents',
      'participant/payments',
      'participant/meetings',
      'participant/contacts',
      'participant/settings',
    ],
  },
];

process.exit(await runSuite({ app: 'participant', groups: GROUPS, args: process.argv.slice(2) }));
