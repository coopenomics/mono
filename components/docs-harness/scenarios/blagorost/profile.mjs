// Сценарий: «Профиль» — карточка пайщика в Благоросте.
//
// Открывается на роуте /capital/wallet (заголовок «Профиль» в меню Благороста).
// Доступен любому, кто зарегистрирован как Contributor. У нас это председатель
// `ant` через phase-04.
//
// prepare:
//   capital:01-programs        — программы УХД и Благорост
//   capital:02-extension-config — postgres-конфиг capital extension
//   capital:04-contributor     — регистрирует ant как Contributor (если ещё нет)

import { loginAsChairman } from '../../lib/harness.mjs';

export const meta = {
  title: 'Профиль пайщика в Благоросте',
  docPath: 'new/blagorost/profile.md',
  assetsDir: 'assets/new/blagorost/profile',
  role: 'chairman',
  fixture: 'ant',
  prepare: [
    'capital:01-programs',
    'capital:02-extension-config',
    'capital:04-contributor',
  ],
};

export default async ({ page, context, shot, env }) => {
  // --- Логин председателя ---
  await loginAsChairman(page, context);

  // На свежей цепочке после первого входа всплывают модалки подписания
  // соглашений (ЦПП Кошелёк и т.д.). Закрываем их нативным DOM-кликом.
  for (let i = 0; i < 12; i++) {
    const clicked = await page.evaluate(() => {
      const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
        .filter((p) => getComputedStyle(p).display !== 'none');
      if (portals.length === 0) return false;
      const top = portals[portals.length - 1];
      const btn = Array.from(top.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === 'Подписать' && !b.disabled);
      if (!btn) return false;
      btn.scrollIntoView({ block: 'center', behavior: 'instant' });
      btn.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(3500);
  }

  // --- Открываем профиль ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/capital/wallet`, { waitUntil: 'domcontentloaded' });

  // Ждём пока карточка контрибутора подгрузится (на ней есть display_name).
  await page.waitForSelector('text=Иван', { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(500);

  await shot(
    page,
    '01-overview',
    'Профиль пайщика в Благоросте: ФИО и аватар, уровень и энергия, кошельки Генерации и Благороста, поля «о себе/часов в день/стоимость часа».',
  );

  // --- Таблица взносов по ролям (внизу страницы) ---
  // CapitalProfilePage рендерит roleContributions: 5 строк — Соавтор / Исполнитель /
  // Инвестор / Координатор / Получено в Благорост. На viewport 1120×800 шапка
  // не помещается вместе с таблицей; прокручиваем так, чтобы таблица была
  // у верхней границы видимой области (`block: 'start'`).
  await page.locator('text=Соавтор').first().evaluate((el) => {
    el.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(500);

  await shot(
    page,
    '02-contributions',
    'Таблица взносов по ролям: Соавтор / Исполнитель / Инвестор / Координатор + строка «Получено в Благорост» (доля, перешедшая к пайщику из результатов других участников по правилам ЦПП).',
  );
};
