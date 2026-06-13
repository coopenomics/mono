import { ref } from 'vue'
import { useAccountStore } from 'src/entities/Account'

/**
 * Кэш ФИО пайщиков по username — общий для реестров (процессы/заказы/предложения),
 * где из цепочки приходит служебный аккаунт, а показывать нужно человеческое имя
 * (НЕ braname). enrichFio догружает недостающие имена через accountStore и
 * кладёт в кэш; в UI используется `fioCache.get(username) || username`.
 */
export function useFioCache() {
  const accountStore = useAccountStore()
  const fioCache = ref(new Map<string, string>())

  async function enrichFio(rawUsernames: (string | null | undefined)[]): Promise<void> {
    const usernames = [
      ...new Set(rawUsernames.filter((u): u is string => !!u && !fioCache.value.has(u))),
    ]
    if (!usernames.length) return
    await Promise.allSettled(
      usernames.map(async (username) => {
        try {
          const acc = await accountStore.getAccount(username)
          const pd = acc?.private_account
          if (!pd) return
          let fio = ''
          if (pd.type === 'individual' && pd.individual_data) {
            const d = pd.individual_data
            fio = [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ')
          } else if (pd.type === 'organization' && pd.organization_data) {
            fio = (pd.organization_data as any).short_name ?? username
          } else if (pd.type === 'entrepreneur' && pd.entrepreneur_data) {
            const d = pd.entrepreneur_data as any
            fio = [d.last_name, d.first_name, d.middle_name].filter(Boolean).join(' ')
          }
          if (fio) fioCache.value.set(username, fio)
        } catch {
          // молча — username остаётся как fallback
        }
      }),
    )
  }

  return { fioCache, enrichFio }
}
