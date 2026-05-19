// Сценарий: регистрация второго кооператива в Восходе (до экрана ReadStatement).
//
// Останавливаемся именно на ReadStatement, чтобы захватить шот сгенерированного
// заявления. Подпись + отправка + оплата вступительного — в сценарии
// 02-sign-and-submit (он повторяет signUp + продолжает).

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { signUpAsOrganization } from '../../lib/registrator-signup.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

const COOP_DATA = {
  emailLocal: 'chairman.partner1',
  short_name: 'Партнёр-1',
  full_name: 'Потребительский кооператив «Партнёр-1»',
  type: 'Потребительский Кооператив',
  represented_by: {
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
    based_on: 'решения общего собрания №1 от 01.01.2026 г',
    position: 'Председатель совета',
  },
  phone: '+7 (901) 123-45-67',
  country: 'Россия',
  city: 'Москва',
  full_address: 'г. Москва, ул. Тестовая, д. 1, оф. 100',
  fact_address: 'г. Москва, ул. Тестовая, д. 1, оф. 100',
  inn: '7700000001',
  ogrn: '1027700000001',
  kpp: '770001001',
  bank: {
    name: 'ПАО Сбербанк',
    corr: '30101810400000000225',
    bik: '044525225',
    kpp: '773601001',
    account: '40703810500000000001',
    currency: 'RUB',
  },
};

export const meta = {
  title: 'Регистрация второго кооператива (Партнёр-1) в Восходе',
  docPath: 'new/onboarding/01-register-coop.md',
  assetsDir: 'assets/new/onboarding/01-register-coop',
  role: 'anonymous',
};

export default async ({ page, shot, env }) => {
  await signUpAsOrganization({
    page,
    shot,
    env,
    coopData: COOP_DATA,
    fixturePath: COOP_FIXTURE_PATH,
  });
};
