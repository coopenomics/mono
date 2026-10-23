#!/usr/bin/env node
/**
 * Сюита документации стола совета: стенд CI ui-docs.yaml (ветка
 * ci/ui-docs-soviet). Стенд готовят фазы soviet:<фаза>
 * (components/api-tests/src/seed/soviet): вопрос о выходе пайщика и голоса
 * совета, входящий платёж, служебная записка на расход.
 *
 *   node bin/run-soviet-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Стол совета',
    scenarios: [
      'soviet/participants',
      'soviet/documents',
      'soviet/payments',
      'soviet/expenses',
      'soviet/agenda',
      'soviet/meets',
      'soviet/cooperatives',
    ],
  },
];

process.exit(await runSuite({ app: 'soviet', groups: GROUPS, args: process.argv.slice(2) }));
