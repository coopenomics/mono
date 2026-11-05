// Сценарий: кошелёк пайщика — остатки по программам, паевой взнос и
// заявление на возврат паевого взноса, заявки в работе и движения по кошелькам.
import { loginMember, openMember, participantMeta, USER } from '../../lib/participant.mjs';
import { fill } from '../../lib/edu.mjs';
export const meta = {
  ...participantMeta('wallet', 'Кошелёк'),
  fixtures: ['ivanpetrov'],
};
export default async ({ page, shot }) => {
  await loginMember(page);
  await openMember(page, { url: USER('wallet') });
  await shot(page, '01-wallet', 'Кошелёк пайщика: паевые взносы по программам, доступно, зарезервировано и минимальный неснижаемый остаток.');

  const deposit = page.locator('button:has-text("Совершить взнос")').first();
  if (await deposit.isVisible().catch(() => false)) {
    await deposit.click();
    await page.waitForSelector('text=Паевой взнос', { timeout: 15000 });
    await page.waitForTimeout(600);
    // Подпись поля лежит поверх ввода и перехватывает клик; fill не будит
    // обработчик суммы — фокус и ввод с клавиатуры.
    // На странице две кнопки взноса (шапка и боковая панель), у каждой своё окно;
    // поле открытого окна — последнее с этой подсказкой.
    const amount = page.getByPlaceholder('Введите сумму').last();
    await amount.fill('3000', { force: true });
    await amount.dispatchEvent('input');
    await amount.dispatchEvent('change');
    await page.waitForTimeout(500);
    await shot(page, '02-deposit', 'Паевой взнос: сумма взноса. Кнопка «Продолжить» заводит платёж и показывает реквизиты.');
    await page.locator('.q-dialog button:has-text("Продолжить")').last().click();
    await page.waitForSelector('text=Совершите взнос', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, '03-deposit-payment', 'Реквизиты взноса: код для оплаты из банковского приложения и назначение платежа. После оплаты кассир подтверждает платёж, взнос поступает в кошелёк.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }

  const withdraw = page.locator('button:has-text("Получить возврат")').first();
  if (await withdraw.isVisible().catch(() => false)) {
    await withdraw.click();
    await page.waitForSelector('text=Заявление на возврат паевого взноса', { timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(page, '04-withdraw', 'Заявление на возврат паевого взноса: сумма в пределах доступного и способ получения. Заявление направляется в совет.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }

  // Под карточками кошельков — «В работе» (заявки до выплаты) и «Движения» по
  // всем кошелькам; нажатие на карточку кошелька отбирает историю по нему.
  await page.waitForSelector('text=Движения', { timeout: 20000 });
  await shot(page, '05-movements', 'Под карточками кошельков: «В работе» — заявки на возврат паевого взноса до решения совета, выплаты у кассира, неоплаченные пополнения; «Движения» — история по всем кошелькам пайщика, свежие сверху.');

  const card = page.locator('.wallet--clickable').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(1000);
    await shot(page, '06-movements-filter', 'Нажатие на карточку кошелька отбирает историю движений по этому кошельку; «Все кошельки» снимает отбор.');
  }

  const row = page.locator('.wallet-activity tbody tr').first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(1200);
    await shot(page, '07-movement-process', 'Строка открывает справа сумму, дату и кошелёк; у заявки в работе — ход процесса по шагам, у неоплаченного взноса — реквизиты для оплаты. Документов в панели нет: свои документы пайщик смотрит в разделе «Документы».');
    await page.keyboard.press('Escape');
  }
};
