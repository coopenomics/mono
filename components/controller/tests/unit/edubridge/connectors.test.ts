/** Коннекторы площадок — формат запросов по официальной документации; площадке уходит только почта. */
import { SkillspaceConnector } from '~/extensions/edubridge/infrastructure/connectors/skillspace.connector';
import { GetCourseConnector, getcourseHost } from '~/extensions/edubridge/infrastructure/connectors/getcourse.connector';
import { EduRecipientType } from '~/extensions/edubridge/domain/enums';

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;
const ok = (body: unknown = {}) => Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify(body) });
const status = (code: number, text = '') => Promise.resolve({ ok: false, status: code, text: async () => text });
// Источник ключей: то, что раньше лежало в настройках расширения, теперь отдаёт хранилище привязок.
const cfg = (c: Partial<Record<string, string>>) =>
  ({
    get: async (_coop: string, carrier: string) =>
      carrier === 'skillspace'
        ? { api_key: c.skillspace_api_key ?? '' }
        : { account: c.getcourse_account ?? '', api_key: c.getcourse_api_key ?? '' },
  }) as any;
const req = { coopname: 'voskhod', recipient: { type: EduRecipientType.EMAIL, value: 'kid@x.ru' }, course_ref: '777:12', enrollment_id: 'E1' };

beforeEach(() => fetchMock.mockReset());

describe('SkillspaceConnector', () => {
  it('grant: POST /course/student-invite с token, email и courses[ID]=GROUP; имени нет', async () => {
    fetchMock.mockReturnValueOnce(ok({}));
    const r = await new SkillspaceConnector(cfg({ skillspace_api_key: 'TOK' })).grant(req);
    expect(r.code).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://skillspace.ru/api/open/v1/course/student-invite');
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain('token=TOK');
    expect(body).toContain('email=kid%40x.ru');
    expect(body).toContain('courses%5B777%5D=12');
    expect(body).not.toContain('name=');
  });

  it('revoke: POST /course/:id/student-remove; ошибки площадки — 404 с кодом в теле (как на живой школе)', async () => {
    const c = new SkillspaceConnector(cfg({ skillspace_api_key: 'TOK' }));
    fetchMock.mockReturnValueOnce(status(404, '{"SCHOOL_PUBLIC_TOKEN_NOT_FOUND":"api.error.SCHOOL_PUBLIC_TOKEN_NOT_FOUND"}'));
    expect((await c.revoke(req)).error_code).toBe('UNAUTHORIZED');
    fetchMock.mockReturnValueOnce(status(404, '{"COURSE_NOT_FOUND":"api.error.COURSE_NOT_FOUND"}'));
    const r = await c.revoke(req);
    expect(r.code).toBe('exists');
    expect(fetchMock.mock.calls[1]![0]).toBe('https://skillspace.ru/api/open/v1/course/777/student-remove');
    fetchMock.mockReturnValueOnce(status(404, '{"COURSE_NOT_FOUND":"api.error.COURSE_NOT_FOUND"}'));
    expect((await c.grant(req)).error_code).toBe('COURSE_NOT_FOUND');
    fetchMock.mockReturnValueOnce(ok({ passwordSetupLink: 'https://x/register' }));
    expect((await c.grant(req)).code).toBe('ok');
  });

  it('check: курс и группа сверяются по реестрам школы — название курса, принадлежность группы', async () => {
    const c = new SkillspaceConnector(cfg({ skillspace_api_key: 'TOK' }));
    fetchMock.mockReturnValueOnce(ok([{ id: '777', name: '7 КЛАСС АЛГЕБРА' }]));
    fetchMock.mockReturnValueOnce(ok([{ id: '12', courseId: '777', name: 'гр. 1' }]));
    const r = await c.check('voskhod', '777:12');
    expect(r).toEqual({ found: true, title: '7 КЛАСС АЛГЕБРА' });
    expect(fetchMock.mock.calls[0]![0]).toBe('https://skillspace.ru/api/open/v1/school/course/list?token=TOK');
    fetchMock.mockReturnValueOnce(ok([{ id: '777', name: 'X' }]));
    fetchMock.mockReturnValueOnce(ok([{ id: '12', courseId: '999', name: 'гр. 1' }]));
    expect((await c.check('voskhod', '777:12')).found).toBe(false);
    fetchMock.mockReturnValueOnce(status(401));
    expect((await c.check('voskhod', '777')).unavailable).toBe(true);
  });

  it('приглашение сотрудника школы — понятная ошибка, а не код площадки', async () => {
    // Живой прецедент 2026-09-03: адрес владельца школы числится сотрудником,
    // Skillspace отвечает 400 INVITE_ONLY_EMPLOYEE; выдача уходила в
    // needs_attention с кодом, по которому нельзя понять, что делать.
    fetchMock.mockReturnValueOnce(status(400, '{"INVITE_ONLY_EMPLOYEE":"api.error.INVITE_ONLY_EMPLOYEE"}'));
    const r = await new SkillspaceConnector(cfg({ skillspace_api_key: 'TOK' })).grant(req);
    expect(r.code).toBe('fatal');
    expect(r.error_code).toBe('INVITE_ONLY_EMPLOYEE');
    expect(r.message).toContain('сотруднику школы');
  });

  it('без ключа — fatal NOT_CONFIGURED, сети не касаемся', async () => {
    const r = await new SkillspaceConnector(cfg({})).grant(req);
    expect(r.error_code).toBe('NOT_CONFIGURED');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GetCourseConnector', () => {
  const gc = () => new GetCourseConnector(cfg({ getcourse_account: 'school', getcourse_api_key: 'KEY' }));

  it('grant: POST /pl/api/users, action=add, params=base64 с email и group_name, refresh_if_exists=1', async () => {
    fetchMock.mockReturnValueOnce(ok({ success: true, result: { success: true, user_id: 5 } }));
    const r = await gc().grant({ ...req, course_ref: 'Алгебра-7' });
    expect(r.code).toBe('ok');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://school.getcourse.ru/pl/api/users');
    const body = new URLSearchParams(init.body as URLSearchParams);
    expect(body.get('action')).toBe('add');
    expect(body.get('key')).toBe('KEY');
    const params = JSON.parse(Buffer.from(body.get('params')!, 'base64').toString());
    expect(params.user).toEqual({ email: 'kid@x.ru', group_name: ['Алгебра-7'] });
    expect(params.system.refresh_if_exists).toBe(1);
  });

  it('«Limit reached» — LICENSE_LIMIT; revoke — группа-сигнал :revoked', async () => {
    fetchMock.mockReturnValueOnce(ok({ success: false, result: { error: true, error_message: 'Limit reached' } }));
    expect((await gc().grant(req)).error_code).toBe('LICENSE_LIMIT');
    fetchMock.mockReturnValueOnce(ok({ success: true, result: { success: true } }));
    await gc().revoke({ ...req, course_ref: 'G' });
    const params = JSON.parse(Buffer.from(new URLSearchParams(fetchMock.mock.calls[1]![1].body as URLSearchParams).get('params')!, 'base64').toString());
    expect(params.user.group_name).toEqual(['G:revoked']);
  });

  it('check: GET /pl/api/account/groups, группа ищется только по названию — номер привязкой не считается', async () => {
    // Настоящий ответ GetCourse: группы массивом в `info`.
    fetchMock.mockReturnValue(ok({ success: true, info: [{ id: 9, name: 'Алгебра: 7 класс', last_added_at: null }] }));
    const connector = gc();
    await expect(connector.check('voskhod', 'Алгебра: 7 класс')).resolves.toMatchObject({ found: true, title: 'Алгебра: 7 класс' });
    expect(fetchMock.mock.calls[0]![0]).toContain('https://school.getcourse.ru/pl/api/account/groups?key=KEY');
    // Выдача передаёт привязку площадке как название: номер группы создал бы группу с названием-числом.
    await expect(connector.check('voskhod', '9')).resolves.toMatchObject({ found: false });
    // Экспорт ограничен 100 запросами за 2 часа: второй вопрос взят из памяти.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(connector.listGroups('voskhod')).resolves.toEqual([{ id: '9', name: 'Алгебра: 7 класс' }]);
  });

  it('отказ GetCourse приходит с HTTP 200: неверный ключ проверку подключения не проходит', async () => {
    fetchMock.mockReturnValue(ok({ success: false, info: [], error_message: 'Неавторизованное API-обращение', error: true, error_code: 901 }));
    const connector = gc();
    await expect(connector.ping('voskhod')).resolves.toMatchObject({ ok: false, message: expect.stringContaining('Неавторизованное API-обращение') });
    await expect(connector.check('voskhod', 'Алгебра-7')).resolves.toMatchObject({ found: false, unavailable: true });
    await expect(connector.listGroups('voskhod')).resolves.toEqual([]);
  });

  it('верный ключ: проверка подключения называет число групп; прежний вид ответа `info.items` тоже читается', async () => {
    fetchMock.mockReturnValueOnce(ok({ success: true, info: [{ id: 1, name: 'А' }, { id: 2, name: 'Б' }] }));
    await expect(gc().ping('voskhod')).resolves.toMatchObject({ ok: true, message: expect.stringContaining('2') });
    fetchMock.mockReturnValueOnce(ok({ success: true, info: { items: [{ id: 1, name: 'А' }] } }));
    await expect(gc().listGroups('voskhod')).resolves.toEqual([{ id: '1', name: 'А' }]);
  });

  it('адрес школы: имя аккаунта даёт поддомен GetCourse, домен школы и адрес целиком берутся как есть', async () => {
    expect(getcourseHost('school')).toBe('school.getcourse.ru');
    expect(getcourseHost(' School.getcourse.ru ')).toBe('school.getcourse.ru');
    expect(getcourseHost('https://jivojum.ru/login?x=1')).toBe('jivojum.ru');
    fetchMock.mockReturnValueOnce(ok({ success: true, info: [] }));
    await new GetCourseConnector(cfg({ getcourse_account: 'https://jivojum.ru/', getcourse_api_key: 'KEY' })).ping('voskhod');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://jivojum.ru/pl/api/account/groups?key=KEY');
  });

  it('адрес школы с шаблоном из настроек: готовый домен в поле «Аккаунт» окончание не удваивает', async () => {
    const withTemplate = (account: string) =>
      new GetCourseConnector({ get: async () => ({ account, api_key: 'KEY' }), apiBase: async () => 'https://{account}.getcourse.ru' } as any);
    for (const [account, host] of [['jivojum', 'jivojum.getcourse.ru'], ['jivojum.getcourse.ru', 'jivojum.getcourse.ru'], ['jivojum.ru', 'jivojum.ru']]) {
      fetchMock.mockReset();
      fetchMock.mockReturnValueOnce(ok({ success: true, info: [] }));
      await withTemplate(account).ping('voskhod');
      expect(String(fetchMock.mock.calls[0]![0])).toContain(`https://${host}/pl/api/account/groups`);
    }
  });

  it('школа не отвечает: проверка подключения называет адрес и причину, а не «fetch failed»', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }));
    const result = await new GetCourseConnector(cfg({ getcourse_account: 'нет-такой', getcourse_api_key: 'KEY' })).ping('voskhod');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('ENOTFOUND');
  });
});

describe('адрес API площадки из настроек расширения', () => {
  const based = (base: Record<string, string>) =>
    ({
      get: async (_coop: string, carrier: string) => (carrier === 'skillspace' ? { api_key: 'TOK' } : { account: 'school', api_key: 'KEY' }),
      apiBase: async (carrier: string) => base[carrier],
    }) as any;

  it('без настройки запрос идёт на площадку; с настройкой — на заданный адрес', async () => {
    fetchMock.mockImplementation(() => ok({}));
    await new SkillspaceConnector(cfg({ skillspace_api_key: 'TOK' })).grant(req);
    expect(String(fetchMock.mock.calls[0][0])).toContain('https://skillspace.ru/api/open/v1/');
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => ok({}));
    await new SkillspaceConnector(based({ skillspace: 'http://127.0.0.1:9100/skillspace/' })).grant(req);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/^http:\/\/127\.0\.0\.1:9100\/skillspace\/[a-z]/);
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => ok({}));
    await new GetCourseConnector(based({ getcourse: 'http://127.0.0.1:9100/getcourse/{account}' })).grant(req);
    expect(String(fetchMock.mock.calls[0][0])).toContain('http://127.0.0.1:9100/getcourse/school/pl/api/');
  });
});
