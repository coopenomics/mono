// Сценарий: «Голосование по компоненту» — вкладка voting внутри карточки компонента.
//
// Логин ivanpetrov → /capital/components/<MVP_HASH>/voting. Снимаются три
// состояния этапа голосования:
//   01-overview      — стартовое состояние (никто ещё не голосовал);
//   02-distributing  — пайщик распределил всю голосующую сумму между другими
//                      участниками (поля заполнены, кнопка активна);
//   03-voted         — голос отправлен, поля заблокированы.
//
// prepare:
//   01..09 — стандартный пайплайн (программы, контрибьюторы, проект, план)
//   07b-clearance-all — допуски (clearance) всем трём пайщикам к проекту 48 и
//                       компоненту 49 — без них контракт capital::vote не примет голос.
//   10-commits-and-voting — два коммита приняты + проект в статусе VOTING

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
  title: 'Голосование по компоненту',
  docPath: 'new/blagorost/voting.md',
  assetsDir: 'assets/new/blagorost/voting',
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
    'capital:07b-clearance-all',
    'capital:08-investments',
    'capital:09-tasks',
    'capital:10-commits-and-voting',
  ],
};

export default async ({ page, shot, env }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await dismissOnboardingDialogs(page);

  await page.goto(
    `${env.BASE_URL}/${env.COOPNAME}/capital/components/${COMPONENT_HASH}/voting`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForSelector('text=На распределении', { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(800);

  // --- Кадр 1: общий вид страницы голосования (никто ещё не голосовал) ---
  await shot(
    page,
    '01-overview',
    'Страница «Голосование» компонента «MVP v1»: участники проекта с полями голосов, сумма «На распределении» и «Голосующая сумма» в шапке. Текущий пайщик не может голосовать сам за себя.',
  );

  // --- Кадр 2: распределение голосов между двумя другими участниками ---
  // Сумма голосов должна точно совпасть с active_voting_amount контракта
  // (4 знака после запятой для RUB). Шапка показывает округление до 2 знаков —
  // реальное значение читаем из атрибута `max` HTML-input голоса.
  const inputs = await page.locator('input.q-field__native').all();
  const editableInputs = [];
  for (const i of inputs) {
    const ro = await i.getAttribute('readonly');
    const disabled = await i.getAttribute('disabled');
    if (!ro && !disabled) editableInputs.push(i);
    if (editableInputs.length === 2) break;
  }
  if (editableInputs.length < 2) {
    throw new Error('Ожидалось 2 редактируемых поля голосования, найдено ' + editableInputs.length);
  }
  const maxAttr = await editableInputs[0].getAttribute('max');
  const totalVoting = parseFloat(maxAttr ?? '');
  if (!Number.isFinite(totalVoting) || totalVoting <= 0) {
    throw new Error('Не удалось прочитать max из input голоса: ' + maxAttr);
  }
  // Делим точно по 4 знакам — без ошибок последнего разряда.
  const firstShare = Math.round(totalVoting * 0.6 * 10000) / 10000;
  const secondShare = Math.round((totalVoting - firstShare) * 10000) / 10000;

  await editableInputs[0].click({ clickCount: 3 });
  await editableInputs[0].fill(String(firstShare));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  await editableInputs[1].click({ clickCount: 3 });
  await editableInputs[1].fill(String(secondShare));
  await page.keyboard.press('Tab');
  await page.waitForTimeout(800);

  await shot(
    page,
    '02-distributing',
    'Та же страница: голосующая сумма распределена между двумя другими участниками — большая часть Смирновой Е. А., меньшая — Иванову И. И. Слайдеры под полями ввода показывают пропорцию. Кнопка «Проголосовать» активна.',
  );

  // --- Кадр 3: после нажатия «Проголосовать» ---
  await page.locator('button.q-btn:has-text("Проголосовать")').first().click();
  // Ждём пока кнопка пропадёт или поля станут disabled (UI признал голос отданным).
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button.q-btn');
      const all = Array.from(document.querySelectorAll('button.q-btn'));
      const submitBtn = all.find((b) => /Проголосовать/i.test(b.textContent || ''));
      if (!submitBtn) return true;
      if (submitBtn.disabled) return true;
      // Если поля ввода стали readonly — голос принят
      const editable = Array.from(document.querySelectorAll('input.q-field__native'))
        .filter((i) => i.type === 'number' && !i.readOnly && !i.disabled);
      return editable.length === 0;
    },
    { timeout: 30000 },
  ).catch(() => {});
  await page.waitForTimeout(5000);

  // Перезагрузим страницу, чтобы UI взял свежее состояние из БД.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('text=На распределении', { timeout: 30000 }).catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(1500);

  await shot(
    page,
    '03-voted',
    'После нажатия «Проголосовать» голос ушёл в блокчейн (capital::vote). Поля у текущего пайщика заблокированы — изменить свой голос больше нельзя. Остальные участники продолжают голосовать со своих сторон.',
  );
};
