// Сценарий: партнёр-1 подписывает каскад типовых соглашений первого входа.
//
// При первом логине Восход показывает 4 SignAgreementDialog параллельно
// (см. widgets/RequireAgreements):
//   1) Положение о ЦПП «Цифровой Кошелёк»
//   2) Положение о Простой Электронной Подписи
//   3) Политика обработки персональных данных
//   4) Пользовательское соглашение
//
// Каждый dialog после клика «Подписать» делает sign(document, username) +
// GraphQL sendAgreement → on-chain wallet::signagree. Засеянный partner1 имеет
// active-ключ default_public_key, поэтому подпись проходит сразу.
//
// Снимаем:
//   01 — первое окно соглашения (документ сформирован)
//   02 — рабочий стол после подписи всех соглашений (виден онбординг председателя)

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loginAs, signOnboardingAgreements } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

export const meta = {
  title: 'Партнёр-1 подписывает каскад соглашений первого входа',
  docPath: 'new/onboarding/02-accept-agreements.md',
  assetsDir: 'assets/new/onboarding/02-accept-agreements',
  role: 'partner',
};

export default async ({ page, shot }) => {
  const partner = JSON.parse(fs.readFileSync(COOP_FIXTURE_PATH, 'utf8'));

  await loginAs(page, partner);
  // Дать первому SignAgreementDialog сформировать документ. Документ
  // формируется composable'ом useGenerateAgreement через GraphQL — занимает
  // 3-6 сек. Ждём появления кнопки «Подписать» (Loader снят).
  await page.locator('button:visible:has-text("Подписать")').first()
    .waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(800);

  await shot(
    page,
    '01-first-agreement',
    `Сразу после первого входа partner1 видит первое из четырёх SignAgreementDialog — «Прочитайте и подпишите документ» (Положение о ЦПП «Цифровой Кошелёк»). Каскад: ЦПП кошелёк → ЭП → политика обработки персональных данных → пользовательское соглашение.`,
  );

  // Подписываем все диалоги по очереди — каждый клик «Подписать» отправляет
  // wallet::signagree в чейн и закрывает окно, следующий всплывает автоматически.
  const result = await signOnboardingAgreements(page, { maxAgreements: 6 });
  console.log(`  подписано соглашений: ${result.signed}/${result.attempts}`);

  // После последней подписи Quasar успокаивается, рендерится Стол председателя.
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await shot(
    page,
    '02-after-signing',
    `Соглашения подписаны (${result.signed} из ${result.attempts}). UI пропускает партнёра на Стол председателя — отсюда стартует онбординг «Адаптируйте кооператив к работе на платформе» (8 шагов, среди них «О вступлении в ПК «Восход»» — это и есть Connection Agreement).`,
  );
};
