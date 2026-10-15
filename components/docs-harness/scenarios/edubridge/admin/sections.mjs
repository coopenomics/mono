// Сценарий: разделы и уровни каталога курсов на столе администратора.
// Раздел «Математика» с уровнем «9 класс» заводит фаза 02-course; здесь
// администратор добавляет второй раздел через интерфейс.

import { loginAsChairman } from '../../../lib/harness.mjs';
import { EDU, openPage, settleAfterLogin, fill, closeDialog } from '../../../lib/edu.mjs';

export const meta = {
  mode: 'docs',
  feature: 'edubridge.sections',
  title: 'Разделы и уровни каталога',
  docPath: 'new/edubridge/admin/sections.md',
  assetsDir: 'assets/new/edubridge/admin/sections',
  role: 'chairman',
  prepare: ['edubridge:01-install', 'edubridge:02-course'],
};

export default async ({ page, context, shot }) => {
  await loginAsChairman(page, context);
  await settleAfterLogin(page);

  await openPage(page, EDU.admin('sections'), 'Разделы');
  await shot(page, '01-sections', 'Разделы и уровни каталога курсов: раздел «Математика» с уровнем «9 класс». Название и порядок меняются сразу у всех курсов раздела; в каталоге курсы группируются по уровню.');

  await page.locator('button:has-text("Добавить раздел")').first().click();
  await page.waitForSelector('text=Новый раздел', { timeout: 15000 });
  await fill(page, 'Название раздела', 'Физика');
  await shot(page, '02-new-section', 'Окно «Новый раздел»: одно поле — название. Раздел появляется в каталоге, когда в нём есть опубликованный курс.');

  await page.locator('.q-dialog button:has-text("Сохранить")').last().click();
  await page.waitForSelector('text=Новый раздел', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const physics = page.locator('text=Физика').first();
  await physics.waitFor({ state: 'visible', timeout: 15000 });
  await shot(page, '03-section-added', 'Раздел «Физика» добавлен. У каждого раздела — действия: переименовать, переставить выше или ниже, добавить уровень, отправить в архив.');

  // Уровень к новому разделу — вторая кнопка строки.
  const levelBtn = page.locator('button:has-text("Добавить уровень")').last();
  if (await levelBtn.isVisible().catch(() => false)) {
    await levelBtn.click();
    await page.waitForSelector('text=Новый уровень', { timeout: 15000 });
    await fill(page, 'Название уровня', '8 класс');
    await shot(page, '04-new-level', 'Окно «Новый уровень»: уровень живёт внутри раздела, например класс или ступень. Курсы разных разделов с одинаковым названием уровня в каталоге стоят рядом.');
    await closeDialog(page);
  }
};
