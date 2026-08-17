/**
 * Заглушка `@octokit/rest` для юнит-прогона (подключается через moduleNameMapper
 * в jest.config.js).
 *
 * Пакет с 21-й версии — pure ESM ("type": "module", в exports только
 * `dist-src/index.js`), а jest гоняет код в CJS и падает на нём с
 * «Cannot use import statement outside a module» ещё на стадии импорта:
 * тесты реестра расширений тянут `extensions.registry` → `capital-extension.module`
 * → `github.service`/`git.service`, а те — `@octokit/rest`.
 *
 * В юнит-тестах к GitHub никто не ходит, поэтому вместо возни с трансформацией
 * всего ESM-куста octokit (core, request, endpoint, graphql, auth-token,
 * extension-*, universal-user-agent, before-after-hook) подменяем сам пакет.
 * Тесту, которому нужен настоящий клиент, место в интеграционном прогоне.
 */
export class Octokit {
  constructor(public readonly options?: unknown) {}
}
