export const getDefaultProtocolNumber = (): string => {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = now.getFullYear()

  // i18n-ignore: код номера документа, не текст интерфейса
  return `СС-${day}-${month}-${year}`
}

export const getDefaultProtocolDate = (): string => {
  const now = new Date()
  const day = now.getDate()
  const months = [
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'января',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'февраля',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'марта',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'апреля',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'мая',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'июня',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'июля',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'августа',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'сентября',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'октября',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'ноября',
    // i18n-ignore: часть формата даты по-русски для протокола — как формат даты
    'декабря',
  ]
  const month = months[now.getMonth()]
  const year = now.getFullYear()

  // i18n-ignore: формат даты по-русски для протокола, не элемент интерфейса
  return `${day} ${month} ${year} г.`
}
