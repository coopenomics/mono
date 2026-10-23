#!/usr/bin/env node
/**
 * Сюита документации кооперативного мессенджера: стенд CI ui-docs.yaml
 * (ветка ci/ui-docs-chatcoop). Сервер Matrix на стенде подставной; комнаты,
 * события и записи звонков кладут фазы chatcoop:<фаза>.
 *
 *   node bin/run-chatcoop-all.mjs
 */
import { runSuite } from '../lib/suite.mjs';

const GROUPS = [
  {
    name: 'Кооперативный мессенджер',
    scenarios: [
      'chatcoop/install',
      'chatcoop/chat',
      'chatcoop/mobile',
      'chatcoop/calendar',
      'chatcoop/transcriptions',
      'chatcoop/secretary-rooms',
    ],
  },
];

process.exit(await runSuite({ app: 'chatcoop', groups: GROUPS, args: process.argv.slice(2) }));
