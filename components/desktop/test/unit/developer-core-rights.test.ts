/**
 * Права ядра в заявке на модерацию: каталог ставит перечень прав из манифеста
 * версии в начало пояснения, стол делит пояснение на права и текст издателя.
 */
import { describe, expect, it } from 'vitest';
import { splitModerationBrief } from '../../extensions/developer/shared/lib/coreRights';

describe('права ядра в заявке на модерацию', () => {
  it('happy: перечень каталога разобран в порты и действия цепи, текст издателя отделён', () => {
    const out = splitModerationBrief(
      'Права ядра: порт accessToken, порт document, действие цепи eosio::refund. Первый выпуск приложения',
    );
    expect(out.rights).toEqual({
      ports: ['accessToken', 'document'],
      chainActions: ['eosio::refund'],
      expansion: false,
      notes: [],
    });
    expect(out.text).toBe('Первый выпуск приложения');
  });

  it('happy: обновление с новыми правами помечено расширением', () => {
    const out = splitModerationBrief('Обновление просит новые права ядра: порт chain. fix');
    expect(out.rights).toMatchObject({ ports: ['chain'], chainActions: [], expansion: true });
    expect(out.text).toBe('fix');
  });

  it('side: имя контракта с точкой не обрывает перечень', () => {
    const out = splitModerationBrief('Права ядра: действие цепи eosio.token::transfer, порт account.');
    expect(out.rights).toMatchObject({ chainActions: ['eosio.token::transfer'], ports: ['account'] });
    expect(out.text).toBe('');
  });

  it('side: замечание каталога вместо прав сохраняется замечанием', () => {
    const out = splitModerationBrief('Обновление просит новые права ядра: манифест версии не прочитан. текст');
    expect(out.rights).toMatchObject({ ports: [], chainActions: [], expansion: true, notes: ['манифест версии не прочитан'] });
  });

  it('break: пояснение без перечня каталога — прав нет, текст целиком принадлежит издателю', () => {
    expect(splitModerationBrief('Обычное пояснение без прав')).toEqual({ rights: null, text: 'Обычное пояснение без прав' });
    expect(splitModerationBrief('')).toEqual({ rights: null, text: '' });
    expect(splitModerationBrief(null)).toEqual({ rights: null, text: '' });
  });

  it('break: слова о правах в середине текста издателя перечнем не считаются', () => {
    const out = splitModerationBrief('Исправление. Права ядра: порт chain. остальное');
    expect(out.rights).toBeNull();
  });
});
