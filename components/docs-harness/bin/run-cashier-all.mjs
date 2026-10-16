#!/usr/bin/env node
/**
 * Сюита стола кассира: касса, реестр платежей и авансы. Фазы expenses:<фаза>
 * подают служебную записку и проводят решение совета; аванс выдаётся в
 * реестре платежей (cashier/payments) раньше страницы «Авансы».
 *
 *   node bin/run-cashier-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Стол кассира',
    scenarios: [
      'cashier/desk',
      'cashier/payments',
      'cashier/advances',
      'cashier/council-view',
    ],
  },
];

process.exit(await runSuite({ app: 'cashier', groups: GROUPS, args: process.argv.slice(2) }));
