// Сценарий: «Получение допуска (clearance) к Проекту/Компоненту».
//
// Свежий пайщик ivanpetrov (Contributor зарегистрирован, но без clearance
// к компоненту 49) заходит на страницу компонента — видит вместо плавающей
// кнопки «+» кнопку «Принять участие (J)». Нажимает её, выбирает роли,
// при выборе ролей master/author/creator появляется поле «О себе»,
// отправляет отклик. Запрос уходит председателю на одобрение (flow совета —
// в этом сценарии не снимаем).
//
// Кадры:
//   01-component-without-clearance — страница компонента без допуска;
//                                    плавающая кнопка «Принять участие (J)»
//                                    в правом нижнем углу.
//   02-clearance-dialog            — диалог с 6 ролями участия (Мастер,
//                                    Соавтор, Исполнитель, Инвестор,
//                                    Координатор, Участник).
//   03-clearance-with-about        — выбраны роли «Соавтор» + «Исполнитель»;
//                                    раскрылось поле «Опишите какой вклад
//                                    вы можете внести в проект» (О себе).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loginAs, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

const COMPONENT_HASH = createHash('sha256').update('blago:project:49').digest('hex');

export const meta = {
  title: 'Получение допуска (clearance)',
  docPath: 'new/blagorost/clearance.md',
  assetsDir: 'assets/new/blagorost/clearance',
  role: 'participant',
  fixture: 'ivanpetrov',
  fixtures: ['ivanpetrov', 'ekaterina'],
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
    'capital:05-additional-contributors',
    'capital:06-create-project-koshelek',
    'capital:07-master-and-plan',
  ],
};

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
}

async function dropPersistentSign(page) {
  // На капитальных страницах может всплывать persistent-диалог
  // «Прочитайте и подпишите документ» (Положение ЦПП), не относящийся к
  // сценарию — режем portal из DOM.
  await page.evaluate(() => {
    document.querySelectorAll('[id^="q-portal--dialog--"]').forEach((p) => {
      if (p.textContent?.includes('Прочитайте и подпишите')) p.remove();
    });
  });
}

export default async ({ page, shot, env }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  // --- 01: страница компонента без допуска ---
  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await dropPersistentSign(page);
  await page.waitForTimeout(500);
  // Ждём пока на странице появится кнопка «Принять участие» — маркер «без допуска».
  await page.waitForSelector('text=Принять участие', { timeout: 15000 });
  await clearNotifications(page);

  await shot(
    page,
    '01-component-without-clearance',
    'Компонент «MVP v1» в Благоросте, страница пайщика без допуска: вместо плавающей кнопки «+» в правом нижнем углу — оранжевая кнопка «Принять участие (J)». Это вход в подачу заявки на допуск.',
  );

  // --- 02: открытый диалог выбора ролей ---
  await page.locator('button:has-text("Принять участие")').first().click({ force: true });
  await page.waitForSelector('div.q-dialog:visible:has-text("Выберите роли участия")', { timeout: 10000 });
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-clearance-dialog',
    'Диалог «Откликнуться на приглашение в проект»: список из шести ролей (Мастер, Соавтор, Исполнитель, Инвестор, Координатор, Участник) — каждая карточкой с описанием. Можно выбрать одну или несколько.',
  );

  // --- 03: выбраны роли с раскрытым полем «О себе» ---
  // Карточки RoleCard кликабельны по всему телу — ищем по заголовку и кликаем.
  await page.locator('.role-selector :text-is("Соавтор")').first().click();
  await page.waitForTimeout(300);
  await page.locator('.role-selector :text-is("Исполнитель")').first().click();
  await page.waitForTimeout(500);
  // После выбора master/author/creator появляется textarea «Опишите вклад…».
  const aboutTextarea = page
    .locator('div.q-dialog:visible label:has-text("Опишите какой вклад")')
    .locator('textarea')
    .first();
  await aboutTextarea.waitFor({ state: 'visible', timeout: 8000 });
  await aboutTextarea.fill(
    'Я разрабатываю Vue-приложения уже семь лет, недавно собрал кошелёк на Quasar для другого кооператива. Готов взять виджеты балансов, экран операций и работу с дизайн-системой. Идею кошелька участвовал обсуждать в чате — есть пара уточнений к тому, как считается доступная сумма для возврата.',
  );
  await page.waitForTimeout(700);

  await shot(
    page,
    '03-clearance-with-about',
    'Тот же диалог: выбраны роли «Соавтор» и «Исполнитель» (карточки подсвечены), под списком раскрылось поле «Опишите какой вклад вы можете внести в проект». Поле обязательно, если выбрана хотя бы одна творческая роль (Мастер / Соавтор / Исполнитель).',
  );
};
