// Сценарий: Стол ПВЗ → «Экономика участка» глазами председателя участка krg.
// Коэффициент экономического участия (99D-23): вкладка «Мои средства» с
// таблицей резерва социально-экономического обеспечения пайщиков по
// получателям и окном строки резерва; вкладка «Итоги месяцев» — текущий месяц
// «идёт» и таблица прогонов; вкладка «Кошелёк участка» — карточка паевого
// кошелька инициатора.
//
// Фикстура: chairkrg (председатель участка krg).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanViteOverlays, dismissOnboardingDialogs, env, loginAs, pickBranchIfAsked } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'));

export const meta = {
  title: 'Экономика участка — резерв обеспечения пайщиков и итоги месяцев',
  docPath: 'new/marketplace/branch-chairman/economy-keu.md',
  assetsDir: 'assets/new/marketplace/branch-chairman/economy-keu',
  role: 'user',
  fixture: 'chairkrg',
  fixtures: ['chairkrg'],
  mode: 'docs',
  feature: 'marketplace.order',
  cases: ['mkt.order.keu.ui.02', 'mkt.order.keu.ui.03'],
};

async function openTab(page, label) {
  await page.locator(`.page-tabs button:has-text("${label}"), [role="tab"]:has-text("${label}"), button:has-text("${label}")`).first().click();
  await page.waitForTimeout(800);
}

export default async ({ page, shot, expect }) => {
  const fixture = loadFixture('chairkrg');
  await page.addInitScript(() => localStorage.setItem('harness:noBranchOverlay', '1'));
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  const target = `${env.APP_PREFIX}/${env.COOPNAME}/market-pvz/economy`;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await page.goto('about:blank');
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pickBranchIfAsked(page);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await dismissOnboardingDialogs(page);
    if (page.url().includes('market-pvz/economy') && !(await page.locator('text=Недостаточно прав доступа').count())) break;
  }
  await cleanViteOverlays(page);

  await shot(
    page,
    '01-wallet-initiator',
    'Вкладка «Кошелёк участка»: общий кошелёк участка и рядом паевой кошелёк инициатора участка — доля инициатора в экономии по итогам месяцев. В сумму общего кошелька он не входит.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Паевой кошелёк инициатора участка').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  await openTab(page, 'Резерв матпомощи');
  await shot(
    page,
    '02-reserve-table',
    'Вкладка «Резерв матпомощи» (резерв социально-экономического обеспечения пайщиков): над таблицей карточки «Верхний предел на получателя» — его задаёт администратор кооператива — и «Резерв участка в месяц», сумма строк, которая учитывается расходом участка в итоге месяца. Таблица — получатель, резерв в месяц, подано заявлений в текущем месяце, остаток. Строка резерва — верхний предел материальной помощи получателя за месяц. Пока администратор не задал предел, вкладка показывает «Резерв выключен».',
    {
      expect: async (p) => {
        await expect(
          p.locator('text=Верхний предел на получателя').or(p.locator('text=Резерв выключен')).first(),
        ).toBeVisible({ timeout: 20000 });
      },
    },
  );

  const addReserve = page.locator('button:has-text("Добавить получателя")').first();
  if (await addReserve.count()) {
    await addReserve.click();
    await page.waitForTimeout(600);
    await shot(
      page,
      '03-reserve-dialog',
      'Окно строки резерва: получатель из председателя и доверенных лиц участка, сумма в месяц не выше верхнего предела кооператива. Отказы контракта показываются текстом: выше предела, посторонний получатель, резерв выключен.',
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Заявления на материальную помощь — строки на «Моих средствах»; строка
  // открывает панель процесса справа. Заявлений на стенде может не быть.
  await openTab(page, 'Мои средства');
  const aidRow = page.locator('.economy__section:has-text("Заявления на материальную помощь") tbody tr').first();
  if (await aidRow.count()) {
    await aidRow.click();
    await page.waitForTimeout(800);
    await shot(
      page,
      '03b-aid-drawer',
      'Заявление на материальную помощь в панели справа: сумма заявления крупно и состояние, налог на доходы и сумма на счёт, реквизиты, ход заявления по шагам — подано, решение совета, выплата кассиром, деньги получены — с датами пройденных шагов. Документов в панели нет: свои документы пайщик смотрит в разделе «Документы».',
      {
        expect: async (p) => {
          await expect(p.locator('text=Ход заявления').or(p.locator('text=Поступит на счёт')).first()).toBeVisible({ timeout: 15000 });
        },
      },
    );
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  await openTab(page, 'Итоги месяцев');
  await shot(
    page,
    '04-periods',
    'Вкладка «Итоги месяцев»: сверху текущий месяц «идёт» — расходы на сегодня (плановые, служебные записки, резерв), материальная помощь за месяц и заказы, которые созреют к первому числу. Ниже по строке на каждый прогон: стоимость списанных заказов, собрано, расходы участка, в фонды, участку, инициатору, возвращено пайщикам, дефицит, ставка списания. Строка открывает состав расходов и распределения справа.',
    {
      expect: async (p) => {
        await expect(p.locator('text=Идёт').first()).toBeVisible({ timeout: 20000 });
      },
    },
  );

  const firstPeriod = page.locator('.q-table tbody tr').first();
  if (await firstPeriod.count()) {
    await firstPeriod.click();
    await page.waitForTimeout(800);
    await shot(
      page,
      '05-period-details',
      'Состав итога месяца: членский взнос участка и ставка списания крупно; факты прогона; расходы — плановые, служебные записки, резерв обеспечения пайщиков, невыплаченная часть прошлого резерва, материальная помощь; распределение — участку, в фонды, инициатору, пайщикам, дефицит; получатель доли инициатора.',
    );
    await page.keyboard.press('Escape');
  }
};
