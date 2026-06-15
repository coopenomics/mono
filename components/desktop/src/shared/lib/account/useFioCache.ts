import { ref } from 'vue'
import { useAccountStore } from 'src/entities/Account'
import { useBranchStore } from 'src/entities/Branch/model'
import { useSystemStore } from 'src/entities/System/model'

/**
 * Кэш человекочитаемых имён по username — общий для реестров (процессы/заказы/
 * предложения), где из цепочки приходит служебный аккаунт, а показывать нужно
 * человеческое имя (НЕ braname). enrichFio догружает недостающие имена и кладёт
 * в кэш; в UI используется `fioCache.get(username) || username`.
 *
 * Два источника имени:
 *  1. Пайщик — ФИО/название из private_account (individual/organization/ИП).
 *  2. Кооперативный участок (КУ) — на цепочке actor некоторых процессов
 *     (например, списание скоропорта) пишется braname участка, а не пайщик;
 *     такой username не резолвится как ФИО, поэтому добираем имя КУ из реестра
 *     участков (short_name || full_name || full_address). Так в столе бухгалтера
 *     вместо «kaffjpgeznnu» показывается человеческое имя участка.
 */
export function useFioCache() {
  const accountStore = useAccountStore()
  const branchStore = useBranchStore()
  const systemStore = useSystemStore()
  const fioCache = ref(new Map<string, string>())
  let branchesLoaded = false

  // Лениво загружаем реестр КУ один раз и строим braname → имя участка.
  async function branchNameByBraname(): Promise<Map<string, string>> {
    if (!branchesLoaded) {
      try {
        await branchStore.loadBranches({ coopname: systemStore.info.coopname })
      } catch {
        // нет доступа к реестру КУ (не админ) — молча, останется fallback
      }
      branchesLoaded = true
    }
    const map = new Map<string, string>()
    for (const b of branchStore.branches) {
      const label = b.short_name || b.full_name || b.full_address
      if (b.braname && label) map.set(b.braname, label)
    }
    return map
  }

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

    // Те, что не зарезолвились как ФИО пайщика, пробуем как имя КУ (braname).
    const unresolved = usernames.filter((u) => !fioCache.value.has(u))
    if (!unresolved.length) return
    const branchMap = await branchNameByBraname()
    for (const u of unresolved) {
      const name = branchMap.get(u)
      if (name) fioCache.value.set(u, name)
    }
  }

  return { fioCache, enrichFio }
}
