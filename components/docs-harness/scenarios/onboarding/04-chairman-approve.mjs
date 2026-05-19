// Сценарий: председатель Восхода (ant) заходит в Реестр кооперативов
// (`/voskhod/soviet/union/cooperatives`) и активирует partner1.
//
// Контекст. После 03-partner-connect partner1 на чейне зарегистрирован как
// заявка через `registerCooperative` (status=pending в registrator-контракте).
// Председатель Восхода видит его в таблице UnionPageListOfCooperatives, жмёт
// «Активировать» — это on-chain транзакция `setcoopstatus` в `registrator`,
// которая переводит статус в `active`. После этого provider'а оператор может
// уже запустить установку (или она триггерится автоматически — см. #48).
//
// Доступ к странице: roles=['chairman','member'] + coopname==='voskhod'.
// ant: username='ant', email='ivanov@example.com', WIF=devkey.

import { loginAsChairman, env } from '../../lib/harness.mjs';

export const meta = {
  title: 'Председатель Восхода активирует подключение partner1 в Реестре кооперативов',
  docPath: 'new/onboarding/04-chairman-approve.md',
  assetsDir: 'assets/new/onboarding/04-chairman-approve',
  role: 'chairman',
};

export default async ({ page, shot }) => {
  page.on('console', (msg) => {
    const t = msg.type();
    const txt = msg.text();
    if (t === 'error') console.log(`  [browser:error] ${txt}`);
    else if (t === 'warning' && (txt.includes('кооператив') || txt.includes('Ошибка'))) {
      console.log(`  [browser:warning] ${txt}`);
    } else if (t === 'log' && (txt.includes('активир') || txt.includes('кооператив'))) {
      console.log(`  [browser:log] ${txt}`);
    }
  });
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));

  await loginAsChairman(page);

  // Закроем модалки первого входа (если ant их не прошёл) — функция в lib.
  // Но обычно ant давно прошёл all onboarding-каскад. Если не закроет —
  // не критично, перейдём по URL напрямую.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  // Идём прямо на Реестр кооперативов. Это часть workspace=soviet.
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/soviet/union/cooperatives`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

  // Дождёмся появления q-table с partner1.
  await page.locator('td:has-text("partner1")').first()
    .waitFor({ state: 'visible', timeout: 30_000 });

  await shot(
    page,
    '01-registry-pending',
    'Реестр кооперативов на Столе совета Восхода. Видна заявка partner1 со статусом «на рассмотрении» (badge orange) и доменом partner-dev.coopenomics.world. Кнопка «действия» открывает дропдаун с «Активировать» / «Заблокировать».',
  );

  // Кликаем dropdown «действия» в строке partner1.
  const partnerRow = page.locator('tr:has(td:has-text("partner1"))').first();
  await partnerRow.locator('button:has-text("действия"), .q-btn-dropdown:has-text("действия")').first().click();
  await page.waitForTimeout(500);

  await shot(
    page,
    '02-actions-dropdown',
    'Дропдаун «действия» открыт: пункты «Активировать» и «Заблокировать». Меню привязано к строке partner1.',
  );

  // Кликаем «Активировать».
  await page.locator('.q-item:has-text("Активировать"), [role="menuitem"]:has-text("Активировать")')
    .first()
    .click();

  // Транзакция setcoopstatus отправляется на чейн. Ждём успешного toast'а
  // «Кооператив активирован» (SuccessAlert) либо обновления badge.
  await page.waitForFunction(() => {
    const txt = document.body?.innerText || '';
    return txt.includes('Кооператив активирован') || txt.includes('активен');
  }, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await shot(
    page,
    '03-registry-active',
    'После клика «Активировать» on-chain транзакция setcoopstatus прошла, badge у partner1 переключился на «активен» (teal). С этого момента provider может стартовать установку partner1.',
  );

  console.log(`  URL финиш: ${page.url()}`);
};
