/**
 * Токен пайщика для одного приложения каталога (487-18, изолированный фронт).
 *
 * Фронт приложения работает в изолированной рамке стола и токена пайщика не
 * получает. Стол просит у ядра токен приложения; бэкенд приложения опознаёт
 * по нему пайщика портом `accessToken.identify`. Токен принадлежит одному
 * приложению и ядру как токен пайщика не годится.
 */
import { AppSessionService, APP_SESSION_PREFIX } from '~/extensions/apps-catalog-proxy/application/services/app-session.service';
import { RemotePortsService } from '~/extensions/apps-catalog-proxy/application/services/remote-ports.service';
import { AppsCatalogInstallScriptController } from '~/extensions/apps-catalog-proxy/application/controllers/install-script.controller';

const PKG = '@voskhod/exampleapp';
const MEMBER = { username: 'ivanov', role: 'user', status: 'active' };

function build(opts: { secret?: string | undefined; grant?: { ports: string[] } | null } = {}) {
  const config = { get: (key: string) => (key === 'SERVER_SECRET' ? ('secret' in opts ? opts.secret : 'SECRET') : undefined) };
  const grants = {
    byPackage: jest.fn(async (packageId: string) =>
      opts.grant === null ? null : { packageId, ports: opts.grant?.ports ?? ['accessToken', 'document'], chainActions: [] },
    ),
  };
  const sessions = new AppSessionService(config as any, grants as any);
  return { sessions, grants };
}

describe('токен приложения: выдача и опознание', () => {
  afterEach(() => jest.useRealTimers());

  it('happy: токен выдан установленному приложению и опознаёт пайщика с его ролью', async () => {
    const { sessions } = build();
    const { token, expiresAt } = await sessions.issue(PKG, MEMBER);
    expect(token.startsWith(APP_SESSION_PREFIX)).toBe(true);
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(sessions.verify(token, PKG)).toEqual(MEMBER);
    expect(sessions.verify(`Bearer ${token}`, PKG)).toEqual(MEMBER);
  });

  it('break: токен одного приложения другое приложение не опознаёт', async () => {
    const { sessions } = build();
    const { token } = await sessions.issue(PKG, MEMBER);
    expect(sessions.verify(token, '@voskhod/otherapp')).toBeNull();
  });

  it('break: подправленное тело и чужая подпись — отказ', async () => {
    const { sessions } = build();
    const { token } = await sessions.issue(PKG, MEMBER);
    const [body, signature] = token.slice(APP_SESSION_PREFIX.length).split('.');
    const forgedBody = Buffer.from(JSON.stringify({ pkg: PKG, sub: 'chairman', rl: 'chairman', st: 'active', exp: 9_999_999_999 })).toString('base64url');
    expect(sessions.verify(`${APP_SESSION_PREFIX}${forgedBody}.${signature}`, PKG)).toBeNull();
    expect(sessions.verify(`${APP_SESSION_PREFIX}${body}.${signature.slice(0, -2)}xx`, PKG)).toBeNull();
    expect(sessions.verify(`${APP_SESSION_PREFIX}${body}`, PKG)).toBeNull();
  });

  it('break: токен, подписанный секретом другого узла, не принят', async () => {
    const { token } = await build({ secret: 'OTHER-NODE' }).sessions.issue(PKG, MEMBER);
    expect(build().sessions.verify(token, PKG)).toBeNull();
  });

  it('break: срок истёк — отказ', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-26T10:00:00.000Z'));
    const { sessions } = build();
    const { token } = await sessions.issue(PKG, MEMBER);
    jest.setSystemTime(new Date('2026-11-26T10:09:59.000Z'));
    expect(sessions.verify(token, PKG)).toEqual(MEMBER);
    jest.setSystemTime(new Date('2026-11-26T10:10:01.000Z'));
    expect(sessions.verify(token, PKG)).toBeNull();
  });

  it('break: приложение не установлено либо не заявляло порт accessToken — токен не выдаётся', async () => {
    await expect(build({ grant: null }).sessions.issue(PKG, MEMBER)).rejects.toMatchObject({ code: 'APPS_CATALOG_PROXY_APP_SESSION_UNAVAILABLE' });
    await expect(build({ grant: { ports: ['document'] } }).sessions.issue(PKG, MEMBER)).rejects.toMatchObject({
      code: 'APPS_CATALOG_PROXY_APP_SESSION_UNAVAILABLE',
    });
  });

  it('break: на узле не задан SERVER_SECRET — токен подписать нечем', async () => {
    await expect(build({ secret: undefined }).sessions.issue(PKG, MEMBER)).rejects.toMatchObject({ code: 'APPS_CATALOG_PROXY_APP_SESSION_NO_SECRET' });
  });

  it('side: токен пайщика (JWT) токеном приложения не считается', () => {
    expect(AppSessionService.isAppSession('eyJhbGciOi.payload.sig')).toBe(false);
    expect(AppSessionService.isAppSession('Bearer eyJhbGciOi.payload.sig')).toBe(false);
    expect(AppSessionService.isAppSession(`Bearer ${APP_SESSION_PREFIX}x.y`)).toBe(true);
    expect(AppSessionService.isAppSession(undefined)).toBe(false);
  });
});

describe('порт accessToken.identify: токен приложения', () => {
  function ports(sessions: AppSessionService) {
    const accessToken = { identify: jest.fn(async () => ({ username: 'by-jwt', role: 'user', status: 'active' })) };
    const service = new RemotePortsService({} as any, {} as any, accessToken as any, {} as any, {} as any, {} as any, sessions);
    return { service, accessToken };
  }
  const grant = (packageId: string) => ({ packageId, ports: ['accessToken'], chainActions: [] }) as any;

  it('happy: бэкенд приложения опознаёт пайщика по своему токену — обычная проверка токена пайщика не вызывается', async () => {
    const { sessions } = build();
    const { token } = await sessions.issue(PKG, MEMBER);
    const { service, accessToken } = ports(sessions);
    await expect(service.call(grant(PKG), 'voskhod', 'accessToken', 'identify', [`Bearer ${token}`])).resolves.toEqual(MEMBER);
    expect(accessToken.identify).not.toHaveBeenCalled();
  });

  it('break: приложение предъявляет токен, выданный другому приложению, — null', async () => {
    const { sessions } = build();
    const { token } = await sessions.issue(PKG, MEMBER);
    const { service } = ports(sessions);
    await expect(service.call(grant('@voskhod/otherapp'), 'voskhod', 'accessToken', 'identify', [token])).resolves.toBeNull();
  });

  it('side: токен пайщика по-прежнему проверяет ядро', async () => {
    const { sessions } = build();
    const { service, accessToken } = ports(sessions);
    await expect(service.call(grant(PKG), 'voskhod', 'accessToken', 'identify', ['Bearer eyJ.jwt.sig'])).resolves.toMatchObject({ username: 'by-jwt' });
    expect(accessToken.identify).toHaveBeenCalledWith('Bearer eyJ.jwt.sig');
  });
});

describe('выдача токена приложения столу', () => {
  function controller(sessions: AppSessionService, document: unknown = null) {
    return new AppsCatalogInstallScriptController({} as any, {} as any, sessions, { getByHash: jest.fn(async () => document) } as any);
  }

  it('happy: вошедший пайщик получает токен своего имени', async () => {
    const { sessions } = build();
    const out = await controller(sessions).appSession('voskhod', 'exampleapp', { user: MEMBER });
    expect(out.username).toBe('ivanov');
    expect(sessions.verify(out.token, PKG)).toEqual(MEMBER);
  });

  it('break: запрос межсервисным секретом без пайщика — отказ', async () => {
    const { sessions } = build();
    await expect(controller(sessions).appSession('voskhod', 'exampleapp', {})).rejects.toMatchObject({ code: 'APPS_CATALOG_PROXY_APP_SESSION_NO_MEMBER' });
  });

  it('break: координаты пакета вне формата — 404, до выдачи дело не доходит', async () => {
    const { sessions, grants } = build();
    await expect(controller(sessions).appSession('../x', 'exampleapp', { user: MEMBER })).rejects.toMatchObject({ status: 404 });
    expect(grants.byPackage).not.toHaveBeenCalled();
  });

  it('happy: документ для окна подписи стол получает от ядра по хэшу', async () => {
    const { sessions } = build();
    const doc = { full_title: 'Заявление', html: '<p/>', hash: 'A'.repeat(64), meta: {}, binary: '' };
    await expect(controller(sessions, doc).appDocument('a'.repeat(64))).resolves.toEqual(doc);
  });

  it('break: хэш вне формата и неизвестный ядру документ — отказ', async () => {
    const { sessions } = build();
    await expect(controller(sessions).appDocument('not-a-hash')).rejects.toMatchObject({ status: 404 });
    await expect(controller(sessions).appDocument('b'.repeat(64))).rejects.toMatchObject({ code: 'APPS_CATALOG_PROXY_APP_DOCUMENT_NOT_FOUND' });
  });
});
