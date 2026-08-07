// Сценарий: Стол председателя кооператива → обзорная экскурсия по marketplace URLs.
// Делает login как chairman (`ant`/`ivanov@example.com`), затем напрямую
// goto к каждому marketplace-маршруту и снимает что вышло.
//
// На текущем стенде session.loadComplete зависает на 5с (init-wallet падает),
// поэтому waitForURL после клика «Войти» бесполезен — используем waitForTimeout
// и goto. После клика «Войти» token успевает сохраниться в IndexedDB, что
// позволяет последующим goto'ам захватить authenticated layout (хедер).

import { cleanViteOverlays, clickMenu, env, passFirstLoginAgreements } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя ПК: экскурсия по marketplace',
  docPath: 'new/marketplace/chairman/dashboard.md',
  assetsDir: 'assets/new/marketplace/chairman/dashboard',
  role: 'chairman',
};

// Маршруты Стола председателя (и встроенные роуты marketplace под /chairman/extensions)
const CHAIRMAN_MENU = [
  { name: '01-onboarding',         text: 'Онбординг',           caption: 'Онбординг: подписание соглашений и активация кооператива' },
  { name: '02-approvals',          text: 'Запросы одобрений',   caption: 'Запросы одобрений: входящие действия пайщиков, ждущие подписи председателя' },
  { name: '03-extensions',         text: 'Каталог приложений',  caption: 'Каталог приложений: установка расширений (Стол заказов, бухгалтерия и т. п.)' },
  { name: '04-system-settings',    text: 'Стартовые страницы',  caption: 'Стартовые страницы: настройка маршрутов после входа для ролей' },
  { name: '05-members',            text: 'Члены совета',        caption: 'Члены совета: реестр и роли совета кооператива' },
  { name: '06-branches',           text: 'Кооперативные Участки', caption: 'Кооперативные Участки: реестр ПВЗ (Красногорск / Одинцово / Мытищи)' },
  { name: '07-register-payments',  text: 'Регистрационные взносы', caption: 'Регистрационные взносы: тарифы вступления и членства' },
  { name: '08-cooperative-key',    text: 'Ключ кооператива',    caption: 'Ключ кооператива: ротация active-ключа председательской подписи' },
  { name: '09-payment-provider',   text: 'Провайдер платежей',  caption: 'Провайдер платежей: настройка интеграции для приёма платежей' },
  { name: '10-contacts',           text: 'Контакты кооператива', caption: 'Контакты кооператива: реквизиты для писем и счетов' },
];

export default async ({ page, shot, context }) => {
  // --- Login (hash router: URL вида #/<coopname>/...)
  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  // Harness escape hatch: отключаем branch-overlay чтобы можно было снять скриншоты
  // всех разделов Стола председателя без процедуры выбора КУ.
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await cleanViteOverlays(page);
  await page.locator('input[type="email"]').first().fill(env.CHAIRMAN_EMAIL);
  await page.locator('input[type="password"]').first().fill(env.CHAIRMAN_WIF);
  await cleanViteOverlays(page);
  await page.locator('button:has-text("Войти")').click();
  // Соглашения первого входа: на свежей цепи каскад модалок перехватывает
  // клики оверлеем, и сценарий падает на «не могу нажать пункт меню».
  await page.waitForFunction(() => !/auth\/signin/.test(window.location.href), { timeout: 30000 }).catch(() => {});
  await passFirstLoginAgreements(page);

  // Дожидаемся редиректа на онбординг председателя
  await page.waitForURL(/chairman/, { timeout: 30000 });
  await page.waitForTimeout(4000);
  await cleanViteOverlays(page);
  await shot(page, '00-after-login', 'Сразу после клика «Войти» — председатель попадает на онбординг Стола председателя. Слева — меню всех разделов (Онбординг, Запросы одобрений, Магазин приложений и др.).');

  // --- Обход меню председателя кликом по пункту, чтобы не триггерить branch-overlay.
  // Пропуск ненайденного пункта запрещён: раньше сценарий на этом месте писал
  // warning и снимал один и тот же экран под десятью именами.
  for (const item of CHAIRMAN_MENU) {
    await clickMenu(page, item.text);
    await page.waitForTimeout(4500);
    await cleanViteOverlays(page);
    await shot(page, item.name, item.caption);
  }
};
