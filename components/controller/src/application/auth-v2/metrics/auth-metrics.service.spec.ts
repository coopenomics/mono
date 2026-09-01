import { Counter, register } from 'prom-client';
import { AuthMetricsService } from './auth-metrics.service';

describe('AuthMetricsService — auth-метрики контура CoopID (Story 9.11)', () => {
  let service: AuthMetricsService;

  beforeEach(() => {
    register.resetMetrics(); // обнуляем значения, определения счётчиков сохраняются
    service = new AuthMetricsService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loginAttempt инкрементит auth_login_attempts_total по контуру', async () => {
    service.loginAttempt();
    service.loginAttempt();
    const out = await register.metrics();
    expect(out).toContain('auth_login_attempts_total{contour="oidc"} 2');
  });

  it('loginSuccess инкрементит auth_login_success_total по контуру', async () => {
    service.loginSuccess();
    const out = await register.metrics();
    expect(out).toContain('auth_login_success_total{contour="oidc"} 1');
  });

  it('loginError инкрементит auth_errors_total по контуру и коду ошибки', async () => {
    service.loginError('session_binding_reused');
    service.loginError('timestamp_too_old');
    service.loginError('session_binding_reused');
    const out = await register.metrics();
    expect(out).toContain('auth_errors_total{contour="oidc",error_code="session_binding_reused"} 2');
    expect(out).toContain('auth_errors_total{contour="oidc",error_code="timestamp_too_old"} 1');
  });

  it('метка контура legacy поддержана (задел Story 7.12)', async () => {
    service.loginAttempt('legacy');
    const out = await register.metrics();
    expect(out).toContain('auth_login_attempts_total{contour="legacy"} 1');
  });

  it('инкремент не валит запрос: сбой prom-client проглатывается', () => {
    // счётчик сервиса === зарегистрированный на глобальном реестре инстанс
    const attempts = register.getSingleMetric('auth_login_attempts_total') as Counter<string>;
    const success = register.getSingleMetric('auth_login_success_total') as Counter<string>;
    const errors = register.getSingleMetric('auth_errors_total') as Counter<string>;
    const boom = () => {
      throw new Error('registry boom');
    };
    jest.spyOn(attempts, 'inc').mockImplementation(boom);
    jest.spyOn(success, 'inc').mockImplementation(boom);
    jest.spyOn(errors, 'inc').mockImplementation(boom);

    expect(() => service.loginAttempt()).not.toThrow();
    expect(() => service.loginSuccess()).not.toThrow();
    expect(() => service.loginError('x')).not.toThrow();
  });

  it('повторная сборка сервиса не падает на «metric already registered»', () => {
    expect(() => new AuthMetricsService()).not.toThrow();
    expect(() => new AuthMetricsService()).not.toThrow();
  });
});
