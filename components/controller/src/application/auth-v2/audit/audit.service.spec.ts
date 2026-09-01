import { AuditService, assertContextHasNoSecrets } from './audit.service';

/**
 * Story 8.2: структурированные audit-поля. DataSource замокан через spy на приватный
 * getDataSource — проверяем форму INSERT (включая первоклассную колонку user_agent) и
 * инвариант secret-blacklist, без реального coop_domain_db.
 */
describe('AuditService — структурированные поля (Story 8.2)', () => {
  function setup() {
    const query = jest.fn((_sql: string, _params: unknown[]) => Promise.resolve(undefined));
    const service = new AuditService();
    jest.spyOn(service as unknown as { getDataSource: () => Promise<unknown> }, 'getDataSource').mockResolvedValue({ query });
    return { service, query };
  }

  it('record пишет user_agent отдельным параметром (а не в context)', async () => {
    const { service, query } = setup();
    await service.record({
      event: 'coopid.login.successful',
      subjectId: 'u1',
      actor: 'ant',
      result: 'success',
      ip: '1.2.3.4',
      userAgent: 'Chrome/120',
      context: { device_new: true },
    });
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('user_agent');
    expect(sql).toContain('INSERT INTO audit_events');
    // Порядок: event, subject_id, actor, result, context(json), ip, user_agent.
    expect(params[0]).toBe('coopid.login.successful');
    expect(params[1]).toBe('u1');
    expect(params[2]).toBe('ant');
    expect(params[3]).toBe('success');
    expect(JSON.parse(params[4] as string)).toEqual({ device_new: true });
    expect(params[5]).toBe('1.2.3.4');
    expect(params[6]).toBe('Chrome/120');
  });

  it('userAgent отсутствует → null', async () => {
    const { service, query } = setup();
    await service.record({ event: 'e', result: 'success' });
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[6]).toBeNull();
  });

  it('context/ip/subject/actor по умолчанию: пустой json, null', async () => {
    const { service, query } = setup();
    await service.record({ event: 'e', result: 'failure' });
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[1]).toBeNull(); // subject_id
    expect(params[2]).toBeNull(); // actor
    expect(JSON.parse(params[4] as string)).toEqual({}); // context
    expect(params[5]).toBeNull(); // ip
  });

  it('secret-blacklist: ключ с token/secret/password/private_key/signature → throw (вкл. вложенность)', async () => {
    const { service, query } = setup();
    await expect(service.record({ event: 'e', result: 'success', context: { access_token: 'x' } })).rejects.toThrow(/секрет/);
    await expect(service.record({ event: 'e', result: 'success', context: { nested: { api_secret: 'x' } } })).rejects.toThrow(/секрет/);
    // Запись в БД не дошла.
    expect(query).not.toHaveBeenCalled();
  });

  it('assertContextHasNoSecrets пропускает безопасные ключи (user_agent, ip_unknown)', () => {
    expect(() => assertContextHasNoSecrets({ user_agent: 'Chrome', ip_unknown: 'internal_call' })).not.toThrow();
  });
});
