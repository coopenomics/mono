/** Ключи площадок: хранятся в привязке зашифрованными, наружу — только «задано»; запасной источник — прежние настройки расширения. */
import { EdubridgeConnectorCredentialsStore } from '~/extensions/edubridge/infrastructure/connectors/connector-credentials.store';
import { EduAccessCarrier } from '~/extensions/edubridge/domain/enums';

function make(opts: { stored?: Record<string, string>; legacy?: Record<string, string> } = {}) {
  const binding: any = { carrier: EduAccessCarrier.SKILLSPACE, credentials_encrypted: opts.stored ? `enc:${JSON.stringify(opts.stored)}` : null, credentials_updated_at: null };
  const bindings = { ensure: jest.fn(async () => binding), save: jest.fn(async (b: any) => b) } as any;
  const config = { get: () => ({ connectors: { skillspace_api_key: '', getcourse_account: '', getcourse_api_key: '', ...(opts.legacy ?? {}) } }) } as any;
  const cipher = {
    encrypt: jest.fn((t: string) => `enc:${t}`),
    decrypt: jest.fn((c: string) => { if (!c.startsWith('enc:')) throw new Error('bad key'); return c.slice(4); }),
  } as any;
  const logger = { setContext: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn() } as any;
  return { store: new EdubridgeConnectorCredentialsStore(bindings, config, cipher, logger), binding, bindings, cipher, logger };
}
const F = [{ key: 'api_key' }];

describe('EdubridgeConnectorCredentialsStore', () => {
  it('сохранение шифрует и пишет в привязку; пустое значение оставляет прежнее', async () => {
    const { store, binding, cipher } = make({ stored: { api_key: 'OLD' } });
    const next = await store.set('voskhod', EduAccessCarrier.SKILLSPACE, { api_key: '  ' });
    expect(next).toEqual({ api_key: 'OLD' });
    await store.set('voskhod', EduAccessCarrier.SKILLSPACE, { api_key: 'NEW' });
    expect(cipher.encrypt).toHaveBeenLastCalledWith(JSON.stringify({ api_key: 'NEW' }));
    expect(binding.credentials_encrypted).toBe('enc:{"api_key":"NEW"}');
    expect(binding.credentials_updated_at).toBeInstanceOf(Date);
  });

  it('чтение расшифровывает; пока ничего не сохранено — берётся из прежних настроек расширения', async () => {
    const { store } = make({ legacy: { skillspace_api_key: 'LEGACY' } });
    await expect(store.get('voskhod', EduAccessCarrier.SKILLSPACE)).resolves.toEqual({ api_key: 'LEGACY' });
    await expect(store.isConfigured('voskhod', EduAccessCarrier.SKILLSPACE, F)).resolves.toBe(true);
    await expect(store.setFlags('voskhod', EduAccessCarrier.SKILLSPACE, F)).resolves.toEqual({ api_key: true });
  });

  it('повреждённый шифротекст не роняет — пусто и запись в лог; без полей площадка считается настроенной', async () => {
    const { store, binding, logger } = make({ stored: { api_key: 'X' } });
    binding.credentials_encrypted = 'garbage';
    await expect(store.get('voskhod', EduAccessCarrier.SKILLSPACE)).resolves.toEqual({});
    expect(logger.error).toHaveBeenCalled();
    await expect(store.isConfigured('voskhod', EduAccessCarrier.ONSITE, [])).resolves.toBe(true);
  });
});
