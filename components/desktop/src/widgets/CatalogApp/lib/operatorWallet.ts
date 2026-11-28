/**
 * Кошелёк членских взносов кооператива живёт у оператора, пополнение — в
 * кабинете кооператива на сайте оператора (вкладка «Подключение»). Узел знает
 * оператора и адрес его сайта из реестра сети без отдельных настроек.
 */

/** Адрес кабинета кооператива у оператора; `null` — сайт оператора не объявлен. */
export function operatorCabinetUrl(site: string | null | undefined, operator: string | null | undefined): string | null {
  if (!site || !operator) return null;
  const base = /^https?:\/\//.test(site) ? site : `https://${site}`;
  return `${base.replace(/\/+$/, '')}/${operator}/connect/overview`;
}

/** Остаток кошелька из актива цепи («1500.0000 RUB») в рублях; `null` — не прочитан. */
export function rubOfAsset(asset: string | null | undefined): number | null {
  if (!asset) return null;
  const value = Number.parseFloat(asset);
  return Number.isFinite(value) ? value : null;
}
