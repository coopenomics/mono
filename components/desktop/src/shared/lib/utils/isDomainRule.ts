export const isDomain = (val: any) => {
  const domainRegex = /^(?!:\/\/)([a-zA-Zа-яА-ЯёЁ0-9](?:[a-zA-Zа-яА-ЯёЁ0-9-]{0,61}[a-zA-Zа-яА-ЯёЁ0-9])?\.)+[a-zA-Zа-яА-ЯёЁ]{2,}$/;
  return domainRegex.test(val) || 'Введите корректный домен или поддомен';
}
