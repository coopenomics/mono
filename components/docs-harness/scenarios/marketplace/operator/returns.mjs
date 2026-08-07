// Сценарий: operator-стол гарантийных возвратов председателя КУ (Story 7.2-7.4).
//
// Поток III «Возврат и списание», шаг 2: председатель кооперативного участка
// рассматривает заявления, поступившие от заказчиков. Полный путь:
//   1. /market-pvz/returns — ввод braname КУ (krg) + «Загрузить заявления».
//      Лента делится на «Ждут удалённого рассмотрения», «Ожидают очного
//      визита» и «Архив».
//   2. По PENDING-заявлению — RemoteDecisionDialog (full-screen takeover):
//      причина + фото пайщика + решение. Здесь председатель приглашает на
//      очный осмотр (aprretrem → APPROVED_FOR_VISIT) либо отказывает удалённо.
//   3. По APPROVED_FOR_VISIT-заявлению — OnSiteDecisionDialog: сверка штрих-кода
//      имущества (mock-сканер), результат осмотра, фото и решение. Приём
//      (accretrn) атомарно восстанавливает средства на программный кошелёк
//      заказчика и возвращает имущество на склад участка.
//
// Заявления-фикстуры: ekaterina, braname=krg, две штуки в PENDING_CHAIRMAN_REVIEW
// (созданы сценарием orderer/returns). Обрабатываем первое до ACCEPTED_AT_VISIT,
// второе остаётся в ленте PENDING.

import { cleanViteOverlays, env, loginAs, dismissOnboardingDialogs } from '../../../lib/harness.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'Стол ПВЗ — гарантийные возвраты',
  docPath: 'new/marketplace/branch-chairman/return-approve.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/return-approve',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
};

const BRANAME = 'krg';

// Ждёт ухода GraphQL-мутации с указанным именем и проверяет статус 200 без errors.
function watchMutation(page, opName) {
  const tracker = { sent: false, status: null, body: null };
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      const body = req.postData() || '';
      if (body.includes(opName)) tracker.sent = true;
    }
  });
  page.on('response', async (res) => {
    if (tracker.sent && tracker.status === null && res.url().includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes(opName)) {
          tracker.status = res.status();
          tracker.body = body.slice(0, 1400);
        }
      } catch {}
    }
  });
  return tracker;
}

async function loadClaims(page) {
  const branameInput = page
    .locator('label:has-text("ID кооперативного участка") input, input[aria-label*="braname"]')
    .first();
  await branameInput.fill(BRANAME);
  await page.locator('button:has-text("Загрузить заявления")').first().click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1800);
  await cleanViteOverlays(page);
}

export default async ({ page, shot }) => {
  const approveTracker = watchMutation(page, 'marketplaceApproveReturnVisit');
  const acceptTracker = watchMutation(page, 'marketplaceAcceptReturnAtVisit');

  // Лента возвратов КУ гейтится ownership `:own-KU` — читать её может только
  // trustee/trusted конкретного участка. Председатель КУ Красногорск — chairkrg
  // (главный председатель кооператива членом КУ krg НЕ является → ForbiddenException).
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/returns`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('.mp-return-operator, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismissOnboardingDialogs(page);
  await cleanViteOverlays(page);

  // === Шаг 1: загрузка ленты заявлений КУ ===
  await loadClaims(page);
  await page.locator('text=Ждут удалённого рассмотрения').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  await shot(
    page,
    '01-pending-list',
    'Стол «Гарантийный возврат — рассмотрение заявлений» председателя КУ Красногорск (krg). Лента разбита на три группы: «Ждут удалённого рассмотрения», «Ожидают очного визита» и «Архив». В каждой карточке — заказ, заказчик, количество, сумма, причина и миниатюры приложенных фото.',
  );

  // === Шаг 2: удалённое решение — пригласить на очный осмотр ===
  await page.locator('button:has-text("Принять решение")').first().click();
  await page.locator('.mp-return-remote').first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  // Решение по умолчанию — «Пригласить на очный осмотр»; заполняем комментарий.
  const remoteComment = page.locator('.mp-return-remote textarea').first();
  await remoteComment.click();
  await remoteComment.fill('Приходите с продукцией в часы работы участка для очного осмотра: вт–сб, 10:00–18:00.');
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-remote-decision',
    'Удалённое решение председателя (full-screen): обращение пайщика с причиной и категорией дефекта, фотографии товара, переключатель решения («Пригласить на очный осмотр» / «Отказать удалённо») и обязательный комментарий, который заказчик увидит в уведомлении.',
  );

  await page.locator('button:has-text("Пригласить на очный осмотр")').first().click();
  let w = 0;
  while (!approveTracker.sent && w < 12000) { await page.waitForTimeout(200); w += 200; }
  if (!approveTracker.sent) throw new Error('[return-approve] кнопка нажата, но мутация marketplaceApproveReturnVisit НЕ ушла');
  let wr = 0;
  while (approveTracker.status === null && wr < 40000) { await page.waitForTimeout(200); wr += 200; }
  console.log(`[return-approve] approveReturnVisit sent=${approveTracker.sent} status=${approveTracker.status}`);
  if (approveTracker.status !== 200) {
    console.log(`[return-approve] approve body: ${approveTracker.body}`);
    throw new Error(`[return-approve] approveReturnVisit вернула статус ${approveTracker.status}`);
  }
  if (approveTracker.body && /"errors":\s*\[/.test(approveTracker.body)) {
    throw new Error(`[return-approve] approveReturnVisit вернула GraphQL errors: ${approveTracker.body}`);
  }

  // === Шаг 3: заявление перешло в «Ожидают очного визита» ===
  // Решение пишется в PG через parser sync (~2-3с после on-chain aprretrem).
  await page.waitForTimeout(4500);
  await loadClaims(page);
  await page.locator('text=Ожидают очного визита').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.locator('button:has-text("Очный осмотр")').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  await shot(
    page,
    '03-approved-for-visit',
    'После удалённого одобрения заявление переместилось в группу «Ожидают очного визита» с датой одобрения. Заказчик приглашён на участок; кнопка «Очный осмотр» открывает следующий шаг — сверку имущества на месте.',
  );

  // === Шаг 4: очный осмотр — сканирование, результат, приём возврата ===
  await page.locator('button:has-text("Очный осмотр")').first().click();
  await page.locator('.mp-return-onsite').first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);
  // 1. Сканируем штрих-код (mock-сканер эмитит код через ~2.1с).
  await page.locator('.mp-return-onsite button:has-text("Сканировать штрих-код имущества")').first().click();
  await page.locator('.mp-return-onsite .mp-barcode-scanner__code').first()
    .waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  // 2. Результат осмотра.
  const inspection = page.locator('.mp-return-onsite textarea').first();
  await inspection.click();
  await inspection.fill('Мешок картофеля осмотрен лично: упаковка повреждена, около трети клубней раздавлены и непригодны. Штрих-код сверён с заказом — совпадает. Возврат обоснован.');
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-onsite-inspection',
    'Очный осмотр (full-screen): председатель сканирует штрих-код имущества для сверки с заказом, фиксирует результат осмотра, при необходимости прикладывает фото и выбирает решение. При приёме зелёный баннер предупреждает, что сумма будет восстановлена на программный кошелёк заказчика, а имущество вернётся на склад участка.',
  );

  await page.locator('button:has-text("Принять возврат и восстановить средства")').first().click();
  let a = 0;
  while (!acceptTracker.sent && a < 12000) { await page.waitForTimeout(200); a += 200; }
  if (!acceptTracker.sent) throw new Error('[return-approve] кнопка нажата, но мутация marketplaceAcceptReturnAtVisit НЕ ушла');
  let ar = 0;
  while (acceptTracker.status === null && ar < 40000) { await page.waitForTimeout(200); ar += 200; }
  console.log(`[return-approve] acceptReturnAtVisit sent=${acceptTracker.sent} status=${acceptTracker.status}`);
  if (acceptTracker.status !== 200) {
    console.log(`[return-approve] accept body: ${acceptTracker.body}`);
    throw new Error(`[return-approve] acceptReturnAtVisit вернула статус ${acceptTracker.status}`);
  }
  if (acceptTracker.body && /"errors":\s*\[/.test(acceptTracker.body)) {
    throw new Error(`[return-approve] acceptReturnAtVisit вернула GraphQL errors: ${acceptTracker.body}`);
  }

  // === Шаг 5: заявление принято, средства восстановлены ===
  await page.waitForTimeout(4500);
  await loadClaims(page);
  await page.locator('text=Возврат принят').first()
    .waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  await shot(
    page,
    '05-accepted',
    'Возврат принят: заявление ушло в «Архив» с отметкой «Возврат принят» и суммой, восстановленной на программный кошелёк заказчика. Backend атомарно провёл компенсирующие операции (возврат средств + возврат имущества на склад) с трассировкой на заявление.',
  );
};
