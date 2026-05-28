/**
 * Regression-тест Story 4.2: после удаления pause-barrier и deprecated broadcast
 * паттерна `@OnEvent('fork::*')` в исходниках controller'а быть НЕ должно.
 *
 * Контракт: единственный путь обработки форка — через ForkRegistryService (см.
 * fork-registry.service.ts + AbstractEntitySyncService). EventEmitter2 для
 * `fork::*` больше не используется. Тест ловит регрессию, если кто-то случайно
 * вернёт декоратор `@OnEvent('fork::*')` в новый syncer.
 *
 * Сканирует `src/` целиком; исключает комментарии (строки, начинающиеся с *).
 */

import { execSync } from 'child_process';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../../../src');

describe('Story 4.2: @OnEvent(fork::*) regression guard', () => {
  it('в src/ нет ни одного активного @OnEvent fork::* декоратора', () => {
    // -R рекурсивно, -E расширенные regexp, --include=*.ts только TS-файлы,
    // -h без имени файла, || true чтобы exit 1 (no matches) не падал в jest.
    const output = execSync(
      `grep -REn --include="*.ts" "@OnEvent\\(['\\\"]fork::" ${SRC_ROOT} || true`,
      { encoding: 'utf-8' }
    ).trim();

    // Отфильтруем строки, которые — комментарии (* в начале после пробелов или // ).
    const offending = output
      .split('\n')
      .filter((line) => line.length > 0)
      .filter((line) => {
        // формат grep -n: path:line:content
        const content = line.split(':').slice(2).join(':').trimStart();
        if (content.startsWith('*') || content.startsWith('//')) return false;
        return true;
      });

    if (offending.length > 0) {
      throw new Error(
        `Найдены активные @OnEvent('fork::*') декораторы (Story 4.2 должна была их удалить):\n` +
          offending.join('\n')
      );
    }
  });
});
