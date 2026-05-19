// Сценарий: партнёрский кооператив входит в Восход как пайщик.
//
// Партнёр-1 (organization-пайщик ВОСХОДА с username=partner1, type=organization,
// status=active, is_registered=true) ЗАСЕЯН через boot:extra — см.
// components/boot/src/init/infra.ts. Полный путь регистрации (заявление,
// PayInitial, одобрение советом, активация) лежит отдельно в
// scenarios/registration/ и используется только для документации регистрации.
// Здесь начинается основной partner-flow подключения.
//
// Что снимает сценарий:
//   01 — пустая форма логина
//   02 — заполненные email + WIF
//   03 — после логина: либо чек-страница соглашений (типичный wallet/signature/
//        privacy/user, как для нового пайщика в Capital), либо сразу дашборд,
//        если соглашения уже подписаны.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { env } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

export const meta = {
  title: 'Партнёр-1 входит в Восход как пайщик-организация',
  docPath: 'new/onboarding/01-signin-partner.md',
  assetsDir: 'assets/new/onboarding/01-signin-partner',
  role: 'partner',
};

export default async ({ page, shot }) => {
  const partner = JSON.parse(fs.readFileSync(COOP_FIXTURE_PATH, 'utf8'));

  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(500);
  await shot(
    page,
    '01-signin-empty',
    'Форма входа в ВОСХОД (partner1). Партнёр уже засеян как organization-пайщик '
    + 'с фиксированным email + WIF — регистрацию проходить не нужно.',
  );

  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(partner.email);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(partner.wif);
  await page.waitForTimeout(300);
  await shot(
    page,
    '02-signin-filled',
    `Заполнены email (${partner.email}) и ключ доступа partner1. После «Войти» Восход узнаёт пайщика-организацию и ведёт на ЛК.`,
  );

  await page.locator('button:has-text("Войти")').click();
  await page.waitForURL(/\/(chairman|participant|soviet|user|connect)/, { timeout: 60_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await shot(
    page,
    '03-after-login',
    `partner1 вошёл — URL ${page.url()}. Если есть непринятые соглашения (Положение о ЦПП Кошелёк / ЭП / Политика ПД / Пользовательское) — UI рендерит их каскадом SignAgreementDialog. Иначе сразу видно рабочий стол с кнопкой «Подключение».`,
  );
};
