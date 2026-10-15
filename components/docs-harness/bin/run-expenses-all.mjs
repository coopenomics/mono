#!/usr/bin/env node
/**
 * Сюита документации приложения «Расходы»: стенд CI ui-docs.yaml (ветка
 * ci/ui-docs-expenses). Фазы expenses:<фаза> подают служебную записку и
 * проводят решение совета; кассу и отчёт сюита снимает в интерфейсе.
 *
 *   node bin/run-expenses-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Расходы',
    scenarios: [
      'expenses/registry',
      'expenses/cashier',
      'expenses/advances',
    ],
  },
];

process.exit(await runSuite({ app: 'expenses', groups: GROUPS, args: process.argv.slice(2) }));
