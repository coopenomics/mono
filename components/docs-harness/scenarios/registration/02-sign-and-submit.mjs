// Сценарий: подписание заявления и его отправка оператору.
//
// Продолжает 01: повторяет signUp до ReadStatement (через общий helper),
// затем галочки → SignStatement (рисуем подпись на canvas) → автоматическая
// подпись всех документов регистрации + отправка заявления → PayInitial.
//
// На PayInitial останавливаемся (без оплаты): шот платёжного экрана уходит
// в документацию. Реальная оплата + WaitingRegistration + переход в реестр —
// в следующем сценарии 03 (под chairman'ом) либо в отдельной интеграции с
// mock-провайдером.

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
  title: 'Подписание заявления и отправка оператору (Партнёр-1 → Восход)',
  docPath: 'new/onboarding/02-sign-and-submit.md',
  assetsDir: 'assets/new/onboarding/02-sign-and-submit',
  role: 'anonymous',
};

export default async ({ page, shot, env }) => {
  // Шаги 01–09: signUp до ReadStatement.
  await signUpAsOrganization({
    page,
    shot,
    env,
    coopData: COOP_DATA,
    fixturePath: COOP_FIXTURE_PATH,
  });

  // --- 10. Отмечаем все галочки соглашений (включая Устав). ---
  // Чекбоксы в q-stepper показываются во всех q-step'ах, но видимые только в
  // активном (остальные display:none). Кликаем все .q-checkbox в активной зоне.
  // Сначала откатываем диалоги ReadAgreementDialog'а, если они открываются от
  // клика по тексту: используем native click на input[type=checkbox] внутри
  // .q-checkbox, чтобы случайно не активировать ссылку на устав или
  // ReadAgreementDialog.
  await page.evaluate(() => {
    const tab = document.querySelector('.q-stepper__tab--active');
    // Активный q-step расположен рядом — Quasar держит общий контейнер
    // .q-stepper__step с одинаковой структурой. Найдём контейнер активного
    // шага через ближайший .q-stepper__step, потомка которого .statement.
    const stepBody = Array
      .from(document.querySelectorAll('.q-stepper__step'))
      .find((el) => el.querySelector('.statement'));
    if (!stepBody) return;
    const checkboxes = stepBody.querySelectorAll(
      '.q-checkbox input[type=checkbox]:not(:checked)',
    );
    checkboxes.forEach((cb) => cb.click());
  });
  await page.waitForTimeout(500);
  await shot(
    page,
    '10-statement-agreements-checked',
    'Все галочки соглашений на ReadStatement проставлены (Устав + динамические соглашения), кнопка «Продолжить» активна.',
  );

  await page.locator('button:has-text("Продолжить")').first().click();

  // --- 11. SignStatement — собственноручная подпись через canvas. ---
  await page.locator('.q-stepper__tab--active:has-text("Подпишите заявление")').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.signature-container canvas').first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(400);
  await shot(
    page,
    '11-sign-statement-empty',
    'Шаг «Подпишите заявление»: канвас для собственноручной подписи (пустой).',
  );

  // Рисуем «подпись»: несколько штрихов мышью внутри canvas. UI проверяет
  // что canvas содержит хоть один ненулевой пиксель.
  const canvas = page.locator('.signature-container canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas boundingBox is null');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  // Длинная диагональ + петля — гарантированно даёт ненулевые пиксели.
  await page.mouse.move(box.x + 40, cy - 20);
  await page.mouse.down();
  await page.mouse.move(cx, cy + 40, { steps: 12 });
  await page.mouse.move(box.x + box.width - 40, cy - 30, { steps: 12 });
  await page.mouse.up();
  await page.mouse.move(cx - 60, cy + 60);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy - 20, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await shot(
    page,
    '12-sign-statement-drawn',
    'Подпись нанесена на canvas. После клика «Продолжить» клиент подписывает все документы регистрации приватным ключом.',
  );

  // Клик «Продолжить» запускает цепочку: signAllRegistrationDocuments → signStatement →
  // sendStatementAndAgreements (это серия GraphQL мутаций; UI в это время
  // крутит Loader с текстом «Подписываем ...»).
  await page.locator('button:has-text("Продолжить")').first().click();

  // --- 12. Переход на PayInitial. ---
  // Может занять несколько секунд (несколько GraphQL мутаций подряд).
  await page.locator('.q-stepper__tab--active:has-text("вступительный взнос")').first()
    .waitFor({ state: 'visible', timeout: 60_000 });
  // Ждём готовности данных оплаты (createInitialPayment).
  await page.locator('text=Пожалуйста, совершите оплату').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);
  await shot(
    page,
    '13-pay-initial',
    'Шаг «Оплатите вступительный взнос»: заявление подписано и отправлено, UI показывает сумму вступительного + минимального паевого взноса и реквизиты для оплаты.',
  );

  // Сценарий завершается на экране оплаты. Дальше — либо ручная оплата (qrpay/yookassa),
  // либо mock-провайдер на тестовом контуре.
};
