// Сценарий: кошелёк пайщика — остатки по программам, паевой взнос и
// заявление на возврат паевого взноса.
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
    // Подпись поля лежит поверх ввода и перехватывает клик — значение ставится напрямую.
    await page.locator('.q-dialog input[type="number"]').first().fill('3000');
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
    await shot(page, '04-withdraw', 'Заявление на возврат паевого взноса: сумма в пределах доступного и способ получения. Заявление уходит в совет.');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
  }

  const exit = page.locator('button:has-text("Выйти из кооператива")').first();
  if (await exit.isVisible().catch(() => false)) {
    await exit.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, '05-exit-card', 'Выход из кооператива: заявление на выход. Совет принимает решение, кооператив возвращает паевой взнос.');
    await exit.click();
    await page.waitForTimeout(1500);
    await shot(page, '06-exit-dialog', 'Заявление на выход из кооператива перед подписью.');
    await page.keyboard.press('Escape');
  }
};
