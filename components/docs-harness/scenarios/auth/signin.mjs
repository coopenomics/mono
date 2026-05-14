// Сценарий: вход пайщика (обычного, role=user) в систему.
// Фикстура — ivanpetrov / Иван Сергеевич Петров, создаётся через
//   MONGO_URI=mongodb://127.0.0.1:27017/cooperative-x \
//     pnpm --filter @coopenomics/boot exec esno \
//     src/scripts/add-plain-participant.ts \
//     ivanpetrov ivan.petrov@example.com Иван Петров Сергеевич
// WIF кэшируется в docs-harness/state/participants/ivanpetrov.json
// и дальше читается оттуда — повторный запуск сценария ключ не пересоздаёт.
// Если блокчейн перезапустили — удалить state/participants/ivanpetrov.json
// и прогнать create-скрипт заново.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../state/participants/ivanpetrov.json'), 'utf8')
);

export const meta = {
  title: 'Вход пайщика в систему',
  docPath: 'new/auth/signin.md',
  assetsDir: 'assets/new/auth/signin',
  role: 'participant',
  fixture: FIXTURE.username,
};

export default async ({ page, shot, expect, env }) => {
  // --- Шаг 1. Форма входа ---
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, '01-form', 'Пустая форма входа: поля email и ключ доступа, кнопка «Войти»');

  // --- Шаг 2. Ввод email и приватного ключа ---
  await page.locator('label:has-text("электронную почту")').locator('input').fill(FIXTURE.email);
  await page.locator('label:has-text("ключ доступа")').locator('input').fill(FIXTURE.wif);
  await shot(page, '02-filled', 'Форма с введённым email и приватным ключом (ключ замаскирован)');

  // --- Шаг 3. Отправка: редирект на /user/... ---
  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/voskhod\/user\//, { timeout: 30000 });
  await expect(page).toHaveURL(/\/voskhod\/user\//);

  // Попали в кабинет пайщика. Если соглашения уже подписаны — сразу кошелёк.
  // Если нет (первый вход) — онбординг-модалка с несколькими кнопками «ПОДПИСАТЬ».
  // Ждём пока контент стабилизируется: либо видно «ПОДПИСАТЬ», либо видно карточку кошелька.
  const signBtn = page.locator('button:has-text("ПОДПИСАТЬ")').first();
  const walletMarker = page.locator('text=Стол пайщика, .q-page').first();
  await Promise.race([
    signBtn.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {}),
    walletMarker.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {}),
  ]);

  // --- Ветка А: есть документы на подпись ---
  if (await signBtn.isVisible().catch(() => false)) {
    // страховка: дождёмся пока все документы сформируются
    await page.waitForFunction(
      () => !document.body.innerText.includes('Формируем документ'),
      { timeout: 60000 }
    );
    await page.waitForTimeout(500);

    // 4 соглашения (ЭП, политика, пользовательское, ЦПП Кошелёк) — каждое в отдельном
    // q-dialog (id="q-portal--dialog--N"), диалоги stacked по z-index. Visible только
    // самый верхний. В каждом диалоге кнопка «Подписать» (внутри CSS text-transform:uppercase)
    // глубоко внизу скроллящегося контента; Playwright-click через actionability-check
    // не работает из-за pointer-events на тексте документа — кликаем нативным DOM click.
    for (let i = 0; i < 8; i++) {
      const clicked = await page.evaluate(() => {
        const portals = Array.from(document.querySelectorAll('[id^="q-portal--dialog--"]'))
          .filter(p => getComputedStyle(p).display !== 'none');
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
      // ждём закрытия диалога + появления следующего (signing → blockchain confirm)
      await page.waitForTimeout(3500);
    }
  }

  // --- Шаг 4. Финал: кошелёк пайщика ---
  // После подписания всех соглашений UI сам редиректит/раскрывает страницу кошелька.
  await page.waitForURL(/\/voskhod\/user\/wallet/, { timeout: 60000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Чистим артефакты onboarding-подписания, которые не относятся к «обычному» входу:
  //  - toast'ы «Документ принят» (исчезают сами через ~5 сек, но ускорим)
  //  - счётчик новых уведомлений в шапке (пайщику после первого входа приходят нотификации)
  await page.evaluate(() => {
    document.querySelectorAll('.q-notification').forEach((n) => n.remove());
    document.querySelectorAll('.q-notifications__list > *').forEach((n) => n.remove());
  });
  await page.waitForTimeout(5500); // дополнительный буфер на самоскрытие оставшихся тостов

  await shot(page, '03-wallet', 'Кошелёк пайщика после входа: карточка роли «Пайщик», баланс, меню раздела');
};
