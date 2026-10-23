#!/usr/bin/env node
/**
 * Сюита документации приложения «Робот совета»: стенд CI ui-docs.yaml.
 * Робот установлен предустановкой boot; фаза robot:01-activity
 * (components/api-tests/src/seed/robot) даёт ему решения о выходе пайщика.
 *
 *   node bin/run-robot-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'L0 — приложение в каталоге',
    scenarios: ['robot/admin/install'],
  },
  {
    name: 'Робот совета',
    scenarios: ['robot/admin/registry', 'robot/admin/journal', 'robot/admin/state'],
  },
];

process.exit(await runSuite({ app: 'robot', groups: GROUPS, args: process.argv.slice(2) }));
