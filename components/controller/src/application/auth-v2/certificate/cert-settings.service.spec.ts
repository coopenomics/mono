import {
  CERT_TTL_DEFAULT_SECONDS,
  CERT_TTL_MAX_SECONDS,
  CERT_TTL_MIN_SECONDS,
} from '~/domain/auth-v2/ports/coop-settings.port';
import { CertSettingsService } from './cert-settings.service';

function makeService(overrides: { get?: number | null; getThrows?: boolean } = {}) {
  const settingsRepo = {
    getCertTtlSeconds: jest.fn(async () => {
      if (overrides.getThrows) throw new Error('db down');
      return overrides.get ?? null;
    }),
    setCertTtlSeconds: jest.fn().mockResolvedValue(undefined),
  };
  const service = new CertSettingsService(settingsRepo as any);
  return { service, settingsRepo };
}

describe('CertSettingsService.getCertTtlSeconds', () => {
  it('пустая БД → дефолт 3600', async () => {
    const { service } = makeService({ get: null });
    await expect(service.getCertTtlSeconds()).resolves.toBe(CERT_TTL_DEFAULT_SECONDS);
  });

  it('сбой репозитория → дефолт (не падает)', async () => {
    const { service } = makeService({ getThrows: true });
    await expect(service.getCertTtlSeconds()).resolves.toBe(CERT_TTL_DEFAULT_SECONDS);
  });

  it('валидное значение в пределах возвращается как есть', async () => {
    const { service } = makeService({ get: 7200 });
    await expect(service.getCertTtlSeconds()).resolves.toBe(7200);
  });

  it('значение ниже MIN зажимается к MIN (защита от мусора в БД)', async () => {
    const { service } = makeService({ get: 5 });
    await expect(service.getCertTtlSeconds()).resolves.toBe(CERT_TTL_MIN_SECONDS);
  });

  it('значение выше MAX зажимается к MAX (24ч)', async () => {
    const { service } = makeService({ get: 999999 });
    await expect(service.getCertTtlSeconds()).resolves.toBe(CERT_TTL_MAX_SECONDS);
  });
});

describe('CertSettingsService.setCertTtlSeconds', () => {
  it('значение в пределах сохраняется и возвращается', async () => {
    const { service, settingsRepo } = makeService();
    await expect(service.setCertTtlSeconds(1800)).resolves.toBe(1800);
    expect(settingsRepo.setCertTtlSeconds).toHaveBeenCalledWith(1800);
  });

  it('выше MAX зажимается перед записью, возвращается эффективное', async () => {
    const { service, settingsRepo } = makeService();
    await expect(service.setCertTtlSeconds(100000)).resolves.toBe(CERT_TTL_MAX_SECONDS);
    expect(settingsRepo.setCertTtlSeconds).toHaveBeenCalledWith(CERT_TTL_MAX_SECONDS);
  });

  it('ниже MIN зажимается к MIN перед записью', async () => {
    const { service, settingsRepo } = makeService();
    await expect(service.setCertTtlSeconds(1)).resolves.toBe(CERT_TTL_MIN_SECONDS);
    expect(settingsRepo.setCertTtlSeconds).toHaveBeenCalledWith(CERT_TTL_MIN_SECONDS);
  });

  it('нечисловое значение → дефолт', async () => {
    const { service, settingsRepo } = makeService();
    await expect(service.setCertTtlSeconds(Number.NaN)).resolves.toBe(CERT_TTL_DEFAULT_SECONDS);
    expect(settingsRepo.setCertTtlSeconds).toHaveBeenCalledWith(CERT_TTL_DEFAULT_SECONDS);
  });
});
