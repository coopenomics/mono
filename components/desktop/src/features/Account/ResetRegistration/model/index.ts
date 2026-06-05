import { api } from '../api'
import { IAccount } from 'src/entities/Account/types';

export function useResetRegistration() {
  // Откат собственной незавершённой регистрации к редактированию данных.
  // Бэкенд снимает заморозку профиля/e-mail, сбрасывает подписанное заявление
  // и непринятый вступительный платёж. Возвращает обновлённый аккаунт.
  async function resetRegistration(): Promise<IAccount> {
    return await api.resetRegistration();
  }

  return { resetRegistration };
}
