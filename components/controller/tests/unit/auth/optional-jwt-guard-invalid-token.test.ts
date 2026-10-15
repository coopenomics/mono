/**
 * `OptionalGqlJwtAuthGuard` отдаёт запрос гостем только когда клиент гостем и
 * пришёл. Раньше негодный токен тоже превращался в гостя: бэкенд отвечал 200
 * «для незнакомца», клиент принимал этот ответ за свой — рабочий стол приезжал
 * без прав, и пайщика уводило на «Недостаточно прав доступа». Теперь заголовок
 * есть, а пользователя нет — отказ, который клиент умеет обрабатывать.
 */
import { UnauthorizedException } from '@nestjs/common';
import { OptionalGqlJwtAuthGuard } from '@coopenomics/extension-kit';

const resolverStub = (): void => undefined;

function gqlContext(headers: Record<string, string>): any {
  const context: any = {
    getHandler: () => resolverStub,
    getClass: () => class {},
    getType: () => 'graphql',
    getArgs: () => [undefined, {}, { req: { headers } }, {}],
    getArgByIndex: (i: number) => context.getArgs()[i],
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  };
  return context;
}

describe('OptionalGqlJwtAuthGuard: гость и негодный токен — разные случаи', () => {
  const guard = new OptionalGqlJwtAuthGuard();

  it('заголовка нет — гость, запрос идёт дальше без пользователя', () => {
    expect(guard.handleRequest(null, false, new Error('No auth token'), gqlContext({}))).toBeNull();
  });

  it('пользователь распознан — отдаётся как есть', () => {
    const user = { username: 'ant', role: 'chairman' };
    expect(guard.handleRequest(null, user, undefined, gqlContext({ authorization: 'Bearer ok' }))).toBe(user);
  });

  it('заголовок есть, токен истёк — отказ с формулировкой, которую распознаёт клиент', () => {
    const expired = Object.assign(new Error('jwt expired'), { name: 'TokenExpiredError' });
    expect(() =>
      guard.handleRequest(null, false, expired, gqlContext({ authorization: 'Bearer stale' })),
    ).toThrow(new UnauthorizedException('Сессия завершена, требуется повторная авторизация'));
  });

  it('стратегия отказала сама (сессия завершена) — её отказ не подменяется', () => {
    const revoked = new UnauthorizedException('Сессия завершена, требуется повторная авторизация');
    expect(() =>
      guard.handleRequest(revoked, false, undefined, gqlContext({ Authorization: 'Bearer revoked' })),
    ).toThrow(revoked);
  });

  it('пустой заголовок равен его отсутствию — гость', () => {
    expect(guard.handleRequest(null, false, undefined, gqlContext({ authorization: '   ' }))).toBeNull();
  });
});
