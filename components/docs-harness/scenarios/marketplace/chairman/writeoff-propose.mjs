// Сценарий: chairman-стол списаний скоропорта (Эпик 8).
//
// Поток III «Возврат и списание», шаг 3: председатель кооператива собирает
// проект списания испорченного/просроченного имущества со склада участка,
// подписывает Заявление 1106 и отправляет проект в совет. Backend атомарно
// вызывает propwroff + soviet::createagenda(mktwroff), переводя проект из
// DRAFT в ON_AGENDA. Дальше совет голосует через стандартную повестку.
//
// Роль: главный председатель кооператива (marketplace-роль admin). Лента
// списаний живёт на /market/writeoffs (не /market-pvz/...).

import { cleanViteOverlays, env, loginAsChairman, dismissOnboardingDialogs } from '../../../lib/harness.mjs';

export const meta = {
  title: 'Стол председателя — списания скоропорта',
  docPath: 'new/marketplace/chairman/writeoff-propose.md',
  assetsDir: 'assets/new/marketplace/chairman/writeoff-propose',
  role: 'chairman',
};

// Ждёт ухода GraphQL-мутации с указанным именем, проверяет статус 200 без errors.
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
          tracker.body = body.slice(0, 1600);
        }
      } catch {}
    }
  });
  return tracker;
}

async function waitMutation(page, tracker, opName) {
  let w = 0;
  while (!tracker.sent && w < 12000) { await page.waitForTimeout(200); w += 200; }
  if (!tracker.sent) throw new Error(`[writeoff] кнопка нажата, но мутация ${opName} НЕ ушла`);
  let wr = 0;
  while (tracker.status === null && wr < 40000) { await page.waitForTimeout(200); wr += 200; }
  console.log(`[writeoff] ${opName} sent=${tracker.sent} status=${tracker.status}`);
  if (tracker.status !== 200) {
    console.log(`[writeoff] ${opName} body: ${tracker.body}`);
    throw new Error(`[writeoff] ${opName} вернула статус ${tracker.status}`);
  }
  if (tracker.body && /"errors":\s*\[/.test(tracker.body)) {
    throw new Error(`[writeoff] ${opName} вернула GraphQL errors: ${tracker.body}`);
  }
}

// Перехватывает bearer-токен и GraphQL-endpoint из живых запросов SPA, чтобы
// можно было вызвать произвольную мутацию из сессии председателя.
function captureAuth(page) {
  const auth = { token: null, url: null };
  page.on('request', (req) => {
    if (req.url().includes('/v1/graphql') && req.method() === 'POST') {
      const h = req.headers();
      if (h.authorization) { auth.token = h.authorization; auth.url = req.url(); }
    }
  });
  return auth;
}

// Стол списаний допускает РОВНО ОДИН открытый черновик на кооператив
// (createDraft бросает ConflictException). Упавший прошлый прогон мог оставить
// висящий DRAFT — чистим его через штатную мутацию marketplaceCancelWriteoffDraft
// из сессии председателя, иначе «Новый черновик» недоступен. Делает сценарий
// идемпотентным между перезапусками.
async function cancelStaleDraft(page, auth) {
  let w = 0;
  while (!auth.token && w < 10000) { await page.waitForTimeout(200); w += 200; }
  if (!auth.token) { console.log('[writeoff] bearer не перехвачен — пропускаю cleanup'); return; }
  const res = await page.evaluate(async ({ token, url }) => {
    const open = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({ query: 'query { marketplaceOpenWriteoffDraft { id } }' }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    const id = open?.data?.marketplaceOpenWriteoffDraft?.id;
    if (!id) return { id: null, open };
    const cancel = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: token },
      body: JSON.stringify({
        query: 'mutation($id:String!){ marketplaceCancelWriteoffDraft(id:$id) }',
        variables: { id },
      }),
    }).then((r) => r.json()).catch((e) => ({ error: String(e) }));
    return { id, cancel };
  }, auth);
  console.log(`[writeoff] cleanup открытого черновика: ${JSON.stringify(res)}`);
  if (res.id) await page.waitForTimeout(1500);
}

export default async ({ page, shot }) => {
  const auth = captureAuth(page);
  const createTracker = watchMutation(page, 'marketplaceCreateWriteoffDraft');
  const submitTracker = watchMutation(page, 'marketplaceSubmitWriteoffDraft');

  await loginAsChairman(page);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await dismissOnboardingDialogs(page);

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/writeoffs`, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('.mp-writeoffs, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await dismissOnboardingDialogs(page);

  // Идемпотентность: убираем висящий черновик от предыдущего прогона.
  await cancelStaleDraft(page, auth);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.mp-writeoffs, .q-page').first()
    .waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // === Шаг 1: стол списаний (исходное состояние) ===
  await shot(
    page,
    '01-writeoffs-list',
    'Стол «Списания скоропорта» председателя кооператива. Кнопка «Новый черновик» открывает редактор проекта; ниже — секции «В работе совета» (проекты на повестке/исполнении) и «Архив».',
  );

  // === Шаг 2: новый черновик — состав позиций ===
  await page.locator('button:has-text("Новый черновик")').first().click();
  await page.locator('.q-dialog:has-text("Новый черновик списания")').first()
    .waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);
  // Первая (пустая) позиция уже добавлена — заполняем её.
  const dlg = page.locator('.q-dialog:has-text("Новый черновик списания")').first();
  await dlg.locator('input').nth(0).fill('krg');                       // КУ
  await dlg.locator('input').nth(1).fill('Картофель (партия, порча)'); // Наименование
  await dlg.locator('input').nth(2).fill('1');                         // Кол-во
  await dlg.locator('input').nth(3).fill('120.0000');                  // Сумма
  await dlg.locator('input').nth(4).fill('Истёк срок годности, товар непригоден к выдаче');
  await page.waitForTimeout(400);
  await cleanViteOverlays(page);
  await shot(
    page,
    '02-draft-editor',
    'Редактор черновика: председатель вручную задаёт позиции к списанию — кооперативный участок, наименование, количество, сумму и причину. Внизу — итоговая сумма проекта. Кнопка «Сохранить» создаёт черновик.',
  );

  // Сохраняем черновик.
  await dlg.locator('button:has-text("Сохранить")').first().click();
  await waitMutation(page, createTracker, 'marketplaceCreateWriteoffDraft');
  await page.waitForTimeout(1500);
  await cleanViteOverlays(page);

  // === Шаг 3: открытый черновик на странице ===
  await page.locator('text=Открытый черновик').first()
    .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  await cleanViteOverlays(page);
  await shot(
    page,
    '03-open-draft',
    'Созданный черновик появился в карточке «Открытый черновик» с числом позиций и суммой. Кнопка «Изменить состав» правит позиции, «Подписать и отправить в совет» — формирует Заявление 1106 на подпись.',
  );

  // === Шаг 4: подписание Заявления 1106 ===
  await page.locator('button:has-text("Подписать и отправить в совет")').first().click();
  const signDlg = page.locator('.q-dialog:has-text("Подписание Заявления о списании")').first();
  await signDlg.waitFor({ state: 'visible', timeout: 10000 });
  // backend рендерит Заявление 1106 через document factory — это несколько секунд.
  // Спиннер «Формируем Заявление…» сменяется карточкой с html-документом и кнопкой
  // подписи ВНУТРИ диалога. Ждём оба условия, а не фиксированный таймаут.
  await signDlg.locator('text=Формируем Заявление')
    .waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await signDlg.locator('button:has-text("Подписать и отправить в совет")')
    .waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);
  await shot(
    page,
    '04-sign-statement',
    'Подписание Заявления о списании скоропорта (Заявление 1106): председатель сверяет сформированный документ и подписывает его ключом текущей сессии. По подписи backend инициирует повестку совета о списании.',
  );

  // Контрактный мост Story 8.1 (#202) задеплоен: marketplace::propwroff сам ставит
  // повестку inline-вызовом soviet::createagenda от permission_level{marketplace,active}
  // (statement+meta форвардятся в createagenda). Финальный submit-to-council включён.
  const ENABLE_COUNCIL_SUBMIT = true;
  if (!ENABLE_COUNCIL_SUBMIT) {
    console.log('[writeoff] submit-to-council отключён — сняты шаги 01-04');
    return;
  }

  // Подписываем и отправляем в совет.
  await page.locator('.q-dialog:has-text("Подписание Заявления о списании") button:has-text("Подписать и отправить в совет")')
    .first().click();
  await waitMutation(page, submitTracker, 'marketplaceSubmitWriteoffDraft');
  await page.waitForTimeout(4500);
  await cleanViteOverlays(page);

  // === Шаг 5: проект на повестке совета ===
  await page.locator('text=В работе совета').first()
    .waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  await cleanViteOverlays(page);
  await shot(
    page,
    '05-on-agenda',
    'После подписи проект ушёл в секцию «В работе совета» со статусом «На повестке» и суммой. Дальше совет рассматривает проект и подписывает Протокол списания через стандартную повестку; backend атомарно списывает каждую позицию (o.mkt.wroff + o.mkt.wroff2).',
  );
};
