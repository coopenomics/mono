// Сценарий: совет утверждает проект списания протоколом.
//
// Это единственный шаг всей цепочки, который делает не один человек, а орган:
// решение считается принятым, когда за него проголосовало большинство состава
// совета (строго больше половины), и только после этого председателю
// становится доступно «Утвердить» — оно подписывает протокол и исполняет
// решение на цепи.
//
// Поэтому сценарий голосует тремя членами совета из пяти. Каждый голосует в
// своём окне браузера: сессия пайщика лежит в IndexedDB кооператива, и
// переключить её на одной вкладке нельзя, не выйдя из аккаунта.
//
// Отдельного случая реестра у сценария нет: он — обязательная ступень перед
// проведением списания на складе участка, которое и закрывает основной случай.

import { cleanViteOverlays, env, loginAs, loginAsChairman } from '../../../lib/harness.mjs';

/**
 * Члены совета, чьи голоса добираются к голосу председателя. Совет из пяти
 * человек, порог — строго больше половины, то есть нужно три голоса.
 * Пайщикам стенда выдан один и тот же дефолтный ключ, что и председателю.
 */
const EXTRA_VOTERS = [
  { username: 'petr', email: 'sidorov@example.com' },
  { username: 'anna', email: 'petrova@example.com' },
];

/**
 * После голоса цепь и бэкенд учитывают его не мгновенно. Нажать «Утвердить»
 * раньше — получить отказ «голос ещё не учтён», поэтому ждём.
 */
const VOTE_SETTLE_MS = 6000;

export const meta = {
  title: 'Повестка совета — утверждение списания',
  docPath: 'new/marketplace/chairman/writeoff-authorize.md',
  assetsDir: 'assets/new/marketplace/chairman/writeoff-authorize',
  role: 'chairman',
  mode: 'docs',
  feature: 'marketplace.writeoff',
  cases: [],
  prepare: [
    'marketplace:01-l1-accept',
    'marketplace:02-branches',
    'marketplace:03-assign-branches',
    'marketplace:04-supplier',
    'marketplace:05-sign-offer',
    'marketplace-deposits:fund',
  ],
};

/** Карточка вопроса о списании в общей повестке совета. */
const writeoffCard = (p) =>
  p.locator('.question-card').filter({ hasText: /списан/i }).first();

async function openAgenda(p) {
  await p.goto(`${env.APP_PREFIX}/${env.COOPNAME}/soviet/agenda`, {
    waitUntil: 'domcontentloaded',
    timeout: 90000,
  });
  await p.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(2000);
  await cleanViteOverlays(p);
}

export default async ({ page, context, shot, expect }) => {
  await loginAsChairman(page, context);
  await openAgenda(page);

  const card = writeoffCard(page);
  await card.waitFor({ state: 'visible', timeout: 60000 });

  await shot(
    page,
    '01-agenda',
    'Повестка совета: проект списания ждёт голосования. Счётчики слева и справа от галочки показывают, сколько голосов «против» и «за» уже подано; галочка закрашивается, когда решение принято советом.',
  );

  // Голос председателя — первый из трёх необходимых.
  await card.locator('.vote-btn--for').first().click();
  await page.waitForTimeout(VOTE_SETTLE_MS);

  // Остальные голосуют каждый в своём окне: сессия хранится в IndexedDB
  // кооператива и на одной вкладке одновременно живёт только одна.
  const viewport = page.viewportSize();
  for (const voter of EXTRA_VOTERS) {
    const voterContext = await context.browser().newContext({
      viewport,
      locale: 'ru-RU',
    });
    try {
      const voterPage = await voterContext.newPage();
      await loginAs(voterPage, { ...voter, wif: env.CHAIRMAN_WIF });
      await openAgenda(voterPage);
      const voterCard = writeoffCard(voterPage);
      await voterCard.waitFor({ state: 'visible', timeout: 60000 });
      await voterCard.locator('.vote-btn--for').first().click();
      await voterPage.waitForTimeout(VOTE_SETTLE_MS);
    } finally {
      await voterContext.close();
    }
  }

  // Возвращаемся к председателю: голоса собраны, решение принято советом —
  // «Утвердить» перестаёт быть заблокированным.
  await openAgenda(page);
  const cardAfterVotes = writeoffCard(page);
  await cardAfterVotes.waitFor({ state: 'visible', timeout: 60000 });
  const authorizeBtn = cardAfterVotes.locator('button:has-text("Утвердить")').first();
  await expect(authorizeBtn).toBeEnabled({ timeout: 60000 });

  await shot(
    page,
    '02-approved-by-council',
    'Решение принято советом: большинство состава проголосовало «за», галочка исхода закрашена. Председателю стало доступно «Утвердить» — это подпись протокола и исполнение решения.',
  );

  await authorizeBtn.click();

  // Утверждённый вопрос уходит с повестки — это и есть признак исполнения.
  await expect(writeoffCard(page)).toHaveCount(0, { timeout: 120000 });
  await page.waitForTimeout(2000);
  await cleanViteOverlays(page);

  await shot(
    page,
    '03-authorized',
    'Вопрос ушёл с повестки: протокол подписан, решение исполнено. Проект списания перешёл в ожидание подтверждения складом — выбытие имущества оформляет председатель кооперативного участка.',
    {
      expect: async (p) => {
        await expect(writeoffCard(p)).toHaveCount(0);
      },
    },
  );
};
