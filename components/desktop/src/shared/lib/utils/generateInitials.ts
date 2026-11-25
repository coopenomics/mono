// i18n-ignore-file: служебный справочник юридических приставок и пояснение к нему

/**
 * Инициалы в кружке аватара: у человека — первые буквы первых двух слов,
 * у организации — монограмма из названия без юридической приставки.
 *
 * `ПК "Восход"` раньше давало `П"` (кавычка считалась вторым словом), а если
 * убрать только кавычки — `ПК`, то есть форму собственности вместо названия.
 * Здесь приставки (`ПК`, `ООО`, `АО`, …) отбрасываются, а из оставшегося
 * названия берутся две буквы: `ВО` у «Восхода», `СЗ` у «Северной зари».
 * Когда значимого названия нет (одно `ПК`), кружок получит типовую иконку.
 */
// i18n-ignore: служебный список юридических приставок, не текст интерфейса
const LEGAL_PREFIXES = new Set([
  'пк', 'ооо', 'оао', 'зао', 'пао', 'ао', 'ип', 'кфх', 'тоо', 'одо',
  'кооператив', 'потребительский', 'общество', 'компания', 'предприятие',
]);

export interface AvatarInitials {
  /** Две заглавные буквы; пусто — вместо букв показывается иконка организации. */
  text: string;
  /** Название выглядит как организация (есть юридическая приставка). */
  organization: boolean;
}

export function avatarInitials(name: string | null | undefined): AvatarInitials {
  const cleaned = (name ?? '').replace(/["«»„“”'`´]/g, ' ').trim();
  if (!cleaned) return { text: '', organization: false };

  const words = cleaned.split(/\s+/).filter(Boolean);
  const meaningful = words.filter((word) => {
    const bare = word.toLowerCase().replace(/[.,]/g, '');
    return word.length > 1 && !LEGAL_PREFIXES.has(bare);
  });
  const organization = meaningful.length !== words.length;

  if (!meaningful.length) return { text: '', organization: true };
  if (meaningful.length >= 2) {
    return {
      text: (meaningful[0][0] + meaningful[1][0]).toUpperCase(),
      organization,
    };
  }
  return { text: meaningful[0].slice(0, 2).toUpperCase(), organization };
}

/**
 * Генерирует инициалы из display name
 * @param displayName - имя для генерации инициалов
 * @returns инициалы (максимум 3 буквы) или '-' если имя пустое
 */
export function generateInitials(displayName: string | null | undefined): string {
  if (!displayName) return '-';

  // Разделяем по пробелам и берем первые буквы
  const words = displayName.trim().split(/\s+/);
  const initials = words
    .slice(0, 3) // Максимум 3 слова
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  return initials || '-';
}
