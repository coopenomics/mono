import { PrivateKey } from '@wharfkit/antelope';

/**
 * Похоже ли значение на валидный приватный ключ (WIF `5…` или `PVT_K1_…`).
 *
 * Используется единым полем входа (Эпик 11, Story 11.6): если действующий пайщик
 * вставил легаси-ключ вместо пароля — desktop предлагает мастер миграции
 * «ключ → пароль», а не пытается войти ключом как раньше. Проверка авторитетная,
 * через WharfKit-парсер (а не regex): корректно принимает оба формата ключа и
 * отсекает пароли/произвольный текст по контрольной сумме.
 */
export function looksLikeWif(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  try {
    PrivateKey.fromString(v);
    return true;
  } catch {
    return false;
  }
}
