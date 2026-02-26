import { create } from 'xmlbuilder2';

export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function generateUuid(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
    + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function createXmlDoc(): any {
  return create({ version: '1.0', encoding: 'windows-1251' });
}

export function addFio(
  parent: any,
  fio: { lastName: string; firstName: string; middleName?: string },
): any {
  const el = parent.ele('ФИО')
    .att('Фамилия', fio.lastName)
    .att('Имя', fio.firstName);
  if (fio.middleName) {
    el.att('Отчество', fio.middleName);
  }
  return el.up();
}

export function addSigner(
  parent: any,
  fio: { lastName: string; firstName: string; middleName?: string },
): any {
  const signer = parent.ele('Подписант').att('ПрПодп', '1');
  addFio(signer, fio);
  return signer.up();
}

export function getQuarterPeriodCode(quarter?: number): string {
  switch (quarter) {
    case 1: return '21';
    case 2: return '31';
    case 3: return '33';
    default: return '34';
  }
}

export function getMonthPeriodCode(month?: number): string {
  return month ? String(month).padStart(2, '0') : '01';
}

export function getTaxOfficeCode(kpp: string): string {
  return kpp.substring(0, 4);
}
