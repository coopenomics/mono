// Сценарий: Пайщик-новичок видит L3 gate ЦПП «Стол заказов».
// Эпик 1 / Story 1.4 + 1.11 — onboarding пайщика в Marketplace.
//
// На странице — canon-виджет OnboardingCPPGate (UX-DR17) со списком ЦПП
// документов. Реальная подпись выполняется через core Registrator-мастер
// (wallet::signagree), эта страница только показывает пакет и редиректит
// в мастер.
//
// Фикстура: ivanpetrov (Иван Сергеевич Петров) — может быть уже подписан
// после прошлых сценариев. Если страница покажет «уже подключены» —
// требуется --reboot.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAs, env, cleanViteOverlays } from '../../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadFixture = (username) =>
  JSON.parse(
    fs.readFileSync(path.resolve(__dirname, `../../../state/participants/${username}.json`), 'utf8'),
  );

export const meta = {
  title: 'L3 онбординг пайщика — gate ЦПП «Стол заказов»',
  docPath: 'new/marketplace/onboarding/member-pick-cpp.md',
  assetsDir: 'assets/new/marketplace/onboarding/member-pick-cpp',
  role: 'user',
  fixture: 'ivanpetrov',
};

export default async ({ page, shot }) => {
  const fixture = loadFixture('ivanpetrov');
  await loginAs(page, fixture);
  await page.evaluate(() => localStorage.setItem('harness:noBranchOverlay', '1'));

  await page.goto(`${env.APP_PREFIX}/${env.COOPNAME}/market/onboarding/member-cpp`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('text=Подключение к Столу заказов', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await cleanViteOverlays(page);

  // 1. Initial state — либо gate OnboardingCPPGate, либо баннер «уже подключены»
  await shot(
    page,
    '01-gate-or-done',
    'Страница онбординга пайщика в Marketplace: если ЦПП ещё не подписана — canon OnboardingCPPGate с пакетом документов (оферта + Положение); если уже — баннер success с датой принятия и кнопкой к каталогу.',
  );

  // 2. Если есть кнопка «Перейти к подписанию» — наводим (без клика, чтобы не редиректить)
  const acceptBtn = page.locator('button:has-text("Перейти к подписанию")');
  if (await acceptBtn.isVisible().catch(() => false)) {
    await acceptBtn.hover();
    await page.waitForTimeout(400);
    await shot(
      page,
      '02-cta-hover',
      'Кнопка «Перейти к подписанию» — переводит пайщика на core Registrator-мастер, где собран шаг подписи документа через wallet::signagree. После подписи backend пересчитает requires_gate=false и пайщик попадёт на /market автоматически.',
    );
  }
};
