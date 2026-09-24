import { DomainError } from '@coopenomics/extension-kit';
import { isSamePassport } from '~/domain/account/interfaces/account-passport-changed.event';
import { VerificationType } from '~/domain/auth-v2/verification/verification.types';
import { PassportChangeListener } from './passport-change.listener';

/**
 * Смена паспорта советом снимает сверку по паспорту: она подтверждала прежний
 * документ. Ошибка отзыва должна отменять изменение данных — кроме случая,
 * когда сверку провёл другой кооператив и снимать нам нечего.
 */
describe('PassportChangeListener', () => {
  const event = { username: 'zoe', actor: 'ant' };
  let types: { resolveForUsername: jest.Mock };
  let onsite: { unverify: jest.Mock };
  let listener: PassportChangeListener;

  beforeEach(() => {
    types = { resolveForUsername: jest.fn().mockResolvedValue([{ type: VerificationType.PassportOnsite }]) };
    onsite = { unverify: jest.fn().mockResolvedValue([]) };
    listener = new PassportChangeListener(types as any, onsite as any);
  });

  it('сверка по паспорту есть — снимается от имени того, кто меняет данные', async () => {
    await listener.onPassportChanged(event);
    expect(onsite.unverify).toHaveBeenCalledWith('ant', 'zoe', expect.stringContaining('Паспортные данные изменены'));
  });

  it('сверки по паспорту нет — отзывать нечего', async () => {
    types.resolveForUsername.mockResolvedValue([]);
    await listener.onPassportChanged(event);
    expect(onsite.unverify).not.toHaveBeenCalled();
  });

  it('сверку провёл другой кооператив — изменение данных не блокируется', async () => {
    onsite.unverify.mockRejectedValue(
      new Error(
        'assertion failure with message: REGISTRATOR_VERIFICATION_NOT_OURS: Верификация по этой процедуре, проведённая вашим кооперативом, не найдена',
      ),
    );
    await expect(listener.onPassportChanged(event)).resolves.toBeUndefined();
  });

  it('тот же отказ контракта, уже превращённый в DomainError, узнаётся по коду', async () => {
    onsite.unverify.mockRejectedValue(DomainError.badRequest('REGISTRATOR_VERIFICATION_NOT_OURS'));
    await expect(listener.onPassportChanged(event)).resolves.toBeUndefined();
  });

  it('иной сбой отзыва пробрасывается — данные не меняются', async () => {
    onsite.unverify.mockRejectedValue(new Error('COOPOS недоступен'));
    await expect(listener.onPassportChanged(event)).rejects.toThrow('COOPOS недоступен');
  });
});

describe('isSamePassport', () => {
  const passport = { series: 1234, number: 567890, code: '123-456', issued_at: '2020/01/01', issued_by: 'ОВД' };

  it('тот же документ, в том числе серия строкой и пробелы в «кем выдан»', () => {
    expect(isSamePassport(passport, { ...passport })).toBe(true);
    expect(isSamePassport(passport, { ...passport, series: '1234' as any, issued_by: ' ОВД ' })).toBe(true);
    expect(isSamePassport(undefined, null)).toBe(true);
  });

  it('любое отличие документа или его удаление — смена паспорта', () => {
    expect(isSamePassport(passport, { ...passport, number: 567891 })).toBe(false);
    expect(isSamePassport(passport, { ...passport, code: '123-457' })).toBe(false);
    expect(isSamePassport(passport, { ...passport, issued_at: '2021/01/01' })).toBe(false);
    expect(isSamePassport(passport, undefined)).toBe(false);
    expect(isSamePassport(undefined, passport)).toBe(false);
  });
});
