import { createHash } from 'node:crypto';
import { assertContextHasNoSecrets } from '../audit/audit.service';
import { DeviceTrackingService } from './device-tracking.service';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const LANG = 'ru-RU,ru;q=0.9';
const fpOf = (ua: string | null, lang: string | null) =>
  createHash('sha256').update(`${ua ?? ''}\n${lang ?? ''}`).digest('hex');

function setup() {
  const devices = {
    isKnown: jest.fn(),
    remember: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const newDeviceNotifier = { maybeNotify: jest.fn().mockResolvedValue(undefined) };
  const service = new DeviceTrackingService(devices as never, audit as never, newDeviceNotifier as never);
  return { service, devices, audit, newDeviceNotifier };
}

describe('DeviceTrackingService (Story 3.8 — device tracking)', () => {
  it('новое устройство: remember + audit LoginSuccessful device_new=true, isNewDevice=true', async () => {
    const { service, devices, audit, newDeviceNotifier } = setup();
    devices.isKnown.mockResolvedValueOnce(false);

    const res = await service.recordLogin({
      subjectId: 'user-uuid-1',
      username: 'ant',
      ip: '1.2.3.4',
      userAgent: UA,
      acceptLanguage: LANG,
    });

    expect(res).toEqual({ isNewDevice: true, fingerprint: fpOf(UA, LANG) });
    expect(devices.isKnown).toHaveBeenCalledWith('user-uuid-1', fpOf(UA, LANG));
    expect(devices.remember).toHaveBeenCalledWith('user-uuid-1', fpOf(UA, LANG), { ip: '1.2.3.4', userAgent: UA });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coopid.login.successful',
        subjectId: 'user-uuid-1',
        actor: 'ant',
        result: 'success',
        ip: '1.2.3.4',
        userAgent: UA,
        context: { device_new: true, accept_language: LANG },
      }),
    );
    // Story 3.9: новое устройство → триггерится уведомление (best-effort).
    expect(newDeviceNotifier.maybeNotify).toHaveBeenCalledWith({
      subjectId: 'user-uuid-1',
      username: 'ant',
      ip: '1.2.3.4',
      userAgent: UA,
    });
  });

  it('известное устройство: device_new=false, isNewDevice=false, remember всё равно обновляет', async () => {
    const { service, devices, audit, newDeviceNotifier } = setup();
    devices.isKnown.mockResolvedValueOnce(true);

    const res = await service.recordLogin({
      subjectId: 'user-uuid-1',
      username: 'ant',
      ip: '1.2.3.4',
      userAgent: UA,
      acceptLanguage: LANG,
    });

    expect(res.isNewDevice).toBe(false);
    expect(devices.remember).toHaveBeenCalledTimes(1);
    // Story 3.9: известное устройство — уведомление не шлётся.
    expect(newDeviceNotifier.maybeNotify).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: UA, context: { device_new: false, accept_language: LANG } }),
    );
  });

  it('fingerprint детерминирован для одной пары (UA, Accept-Language) и различен для разных UA', () => {
    const { service } = setup();
    expect(service.computeFingerprint(UA, LANG)).toBe(service.computeFingerprint(UA, LANG));
    expect(service.computeFingerprint(UA, LANG)).not.toBe(service.computeFingerprint('Other/1.0', LANG));
  });

  it('null UA/Accept-Language: fingerprint считается над пустыми, audit пишет null-поля', async () => {
    const { service, devices, audit } = setup();
    devices.isKnown.mockResolvedValueOnce(false);

    const res = await service.recordLogin({
      subjectId: 'u2',
      username: 'bob',
      ip: null,
      userAgent: null,
      acceptLanguage: null,
    });

    expect(res.fingerprint).toBe(fpOf(null, null));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: null, context: { device_new: true, accept_language: null } }),
    );
  });

  it('audit-контекст не содержит секретов (инвариант контура)', async () => {
    const { service, devices, audit } = setup();
    devices.isKnown.mockResolvedValueOnce(false);
    await service.recordLogin({ subjectId: 'u1', username: 'ant', ip: '1.2.3.4', userAgent: UA, acceptLanguage: LANG });
    const context = audit.record.mock.calls[0][0].context;
    expect(() => assertContextHasNoSecrets(context)).not.toThrow();
  });
});
