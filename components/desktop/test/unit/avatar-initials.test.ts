import { describe, expect, it } from 'vitest';
import { avatarInitials } from 'src/shared/lib/utils/generateInitials';

/**
 * Кружок аватара: кавычки и формы собственности не должны попадать в инициалы.
 * Случай 21.11.2026 (стенд 4): «ПК "Восход"» давало в кружке `П"`.
 */
describe('avatarInitials', () => {
  it('организация: убирает кавычки и юридическую приставку', () => {
    expect(avatarInitials('ПК "Восход"')).toEqual({ text: 'ВО', organization: true });
    expect(avatarInitials('ПК «Северная заря»')).toEqual({ text: 'СЗ', organization: true });
    expect(avatarInitials('ООО Ромашка')).toEqual({ text: 'РО', organization: true });
    expect(avatarInitials('АО «Заря»')).toEqual({ text: 'ЗА', organization: true });
  });

  it('только форма собственности — вместо букв иконка организации', () => {
    expect(avatarInitials('ПК')).toEqual({ text: '', organization: true });
    expect(avatarInitials('ООО')).toEqual({ text: '', organization: true });
    expect(avatarInitials('')).toEqual({ text: '', organization: false });
    expect(avatarInitials(null)).toEqual({ text: '', organization: false });
  });

  it('человек: первые буквы первых двух слов без изменений', () => {
    expect(avatarInitials('Иванов Иван Иванович')).toEqual({ text: 'ИИ', organization: false });
    expect(avatarInitials('Петров Пётр')).toEqual({ text: 'ПП', organization: false });
  });
});
