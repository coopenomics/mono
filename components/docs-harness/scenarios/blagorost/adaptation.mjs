// Сценарий: «Адаптация» — мастер регистрации нового пайщика в Капитал-программе.
//
// На свежей цепочке пайщик, у которого нет Contributor-записи, при заходе в
// /capital/* перенаправляется на /capital/registration — это многошаговый
// мастер: выбор ролей → часы в день → ставка за час (если выбран Исполнитель) →
// о себе → подписание документов УХД → завершение.
//
// Снимаем по кадру на каждом значимом шаге. Документы УХД до конца НЕ
// подписываем — нам важен сам экран с формой и сгенерированным текстом.
// Если подписать — фикстура зарегистрируется как Contributor и при повторном
// прогоне сценарий упадёт (мастер не покажется).
//
// prepare:
//   capital:01-programs        — программы УХД и Благорост в цепочке
//   capital:02-extension-config — глобальные agreements *_done в постгресе
//
// Не используем 04/05 — фикстура newadapter намеренно остаётся БЕЗ Capital
// регистрации, чтобы UI открывал ей мастер.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadFixture(username) {
  return JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../state/participants/${username}.json`), 'utf8'),
  );
}

export const meta = {
  title: 'Адаптация: мастер регистрации пайщика',
  docPath: 'new/blagorost/adaptation.md',
  assetsDir: 'assets/new/blagorost/adaptation',
  role: 'participant',
  fixture: 'newadapter',
  fixtures: ['newadapter'],
  prepare: ['capital:01-programs', 'capital:02-extension-config'],
};

// Подписывает все wallet-онбординг диалоги по очереди, пока DOM не будет
// чист от открытых порталов. Выходим только когда диалогов больше нет, а не
// когда «фоновая страница виднеется» — за её фоном диалог всё ещё перехватывает
// pointer events и ломает дальнейшие клики.
async function dismissAllWalletDialogs(page) {
  const portalsOpen = async () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .some((p) => getComputedStyle(p).display !== 'none'),
    );

  // Сначала ждём появления первого диалога: на свежей цепочке он прилетает
  // через 1-3 сек после navigation.
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
      .some((p) => getComputedStyle(p).display !== 'none'),
    { timeout: 30_000 },
  ).catch(() => {});

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (!(await portalsOpen())) return;

    // Ждём пока в верхнем диалоге появится активная кнопка «Подписать» —
    // пока генерируется документ, она disabled (Loader сверху).
    const btnReady = await page.waitForFunction(
      () => {
        const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
          .filter((p) => getComputedStyle(p).display !== 'none');
        for (const p of portals) {
          const btn = Array.from(p.querySelectorAll('button'))
            .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
          if (btn) return true;
        }
        return false;
      },
      { timeout: 30_000 },
    ).then(() => true).catch(() => false);
    if (!btnReady) {
      // Кнопки нет, но порталы остались — возможно остаточная анимация.
      // Пробуем ещё раз через секунду.
      await page.waitForTimeout(1000);
      continue;
    }

    await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      for (const p of portals) {
        const btn = Array.from(p.querySelectorAll('button'))
          .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
        if (btn) {
          btn.scrollIntoView({ block: 'center', behavior: 'instant' });
          btn.click();
          return;
        }
      }
    });
    // 3.5с на blockchain confirm + следующий документ. Иногда 4-й документ
    // прилетает с большой задержкой — внешний цикл это покроет.
    await page.waitForTimeout(3500);
  }
}

async function clearNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification, .q-notifications__list > *').forEach((n) => n.remove());
  });
}

export default async ({ page, shot, env }) => {
  // --- Шаг 0. Логин пайщика-новичка. ---
  const newadapter = loadFixture('newadapter');
  await loginAs(page, newadapter);

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/projects`, { waitUntil: 'domcontentloaded' });

  // На свежей цепочке у пайщика ещё нет кошелька — сначала подписываем wallet
  // onboarding (Положение о ЦПП, ЭП, политика, пользсоглашение). Без него
  // мастер регистрации Капитала не покажется (в фоне рендерится, но диалог
  // wallet перехватывает все клики).
  await dismissAllWalletDialogs(page);

  // --- Кадр 1. Шаг «Выбор ролей участия» ---
  await page.waitForSelector('text=Выбор ролей участия', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await clearNotifications(page);
  await page.waitForTimeout(500);

  await shot(
    page,
    '01-roles',
    'Шаг 1 мастера регистрации — «Выбор ролей участия»: пять ролей пайщика в Благоросте (Мастер, Соавтор, Исполнитель, Инвестор, Координатор) с описаниями. Можно выбрать несколько.',
  );

  // Выбираем «Исполнитель» — это раскрывает шаги «Часы в день» и «Ставка»,
  // которые мы тоже снимаем.
  await page.locator('text=Исполнитель').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Продолжить")').first().click();

  // --- Кадр 2. Шаг «Ресурс времени» ---
  await page.waitForSelector('text=Ресурс времени', { timeout: 15000 });
  await page.waitForTimeout(500);
  await clearNotifications(page);

  await shot(
    page,
    '02-time-resource',
    'Шаг 2 — «Ресурс времени»: пайщик выбирает, сколько профессиональных часов в день готов отдавать программе (от 1 до 8).',
  );

  // Выбираем 4 часа — это 4-й тайл (индексы 0..7 для значений 1..8).
  await page.locator('.hour-option').nth(3).click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Продолжить")').first().click();

  // --- Кадр 3. Шаг «Стоимость результата за час» ---
  await page.waitForSelector('text=Стоимость результата за час', { timeout: 15000 });
  await page.waitForTimeout(500);

  await page.locator('label:has-text("Стоимость за час") input, input[aria-label="Стоимость за час"]')
    .first().fill('1500').catch(() => {});
  await page.waitForTimeout(400);
  await clearNotifications(page);

  await shot(
    page,
    '03-rate',
    'Шаг 3 — «Стоимость результата за час»: пайщик указывает, во сколько он оценивает свой час работы (заполнено 1500 ₽).',
  );

  await page.locator('button:has-text("Продолжить")').first().click();

  // --- Кадр 4. Шаг «Информация о себе» ---
  await page.waitForSelector('text=Информация о себе', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.locator('label:has-text("О себе") textarea, textarea[aria-label="О себе"]')
    .first()
    .fill('Frontend-разработчик с 8 годами опыта. Vue / TypeScript, продуктовая аналитика. Готов брать задачи интерфейсной части и помогать с UX-полировкой.')
    .catch(() => {});
  await page.waitForTimeout(400);
  await clearNotifications(page);

  await shot(
    page,
    '04-about',
    'Шаг 4 — «Информация о себе»: пайщик кратко рассказывает о своём опыте. Текст становится шаблоном при заявках на участие в проектах.',
  );

  await page.locator('button:has-text("Продолжить")').first().click();

  // --- Кадр 5. Шаг «Подписание документов УХД» ---
  // Документы генерируются на бэке: сначала «Генерация документов...» со
  // спиннером, потом появляется кнопка «Подписать и отправить». Ждём её
  // напрямую — на 60с хватает.
  await page.waitForSelector('button:has-text("Подписать и отправить")', { timeout: 60000 });
  await page.waitForTimeout(800);
  await clearNotifications(page);

  await shot(
    page,
    '05-documents',
    'Шаг 5 — «Подписание документов»: бэк собрал персональные документы УХД (Договор управления, Соглашение о хранении, Соглашение Благорост, Оферта Генератор). Пайщик читает их и подписывает одной кнопкой «Подписать и отправить».',
  );

  // Документы НЕ подписываем: иначе newadapter станет Contributor и при
  // повторном прогоне мастер уже не покажется.
};
