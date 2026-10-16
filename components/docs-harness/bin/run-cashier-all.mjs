#!/usr/bin/env node
/**
 * Сюита стола кассира: касса, реестр платежей стола кассира и авансы пайщика.
 * Фазы expenses:<фаза> подают служебную записку и проводят решение совета.
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
    ],
  },
];

process.exit(await runSuite({ app: 'cashier', groups: GROUPS, args: process.argv.slice(2) }));
