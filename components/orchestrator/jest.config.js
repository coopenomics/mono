/**
 * @fileoverview Jest конфиг для orchestrator.
 *
 * Юнит-тесты лежат рядом с код-файлами (`*.spec.ts`). Все внешние
 * зависимости (docker / http / postgres) подменяются ин-мемори
 * фейками — testEnvironment 'node', без shell.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
