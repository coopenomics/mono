// Сценарий: partner1 жмёт «Подключение» в Столе пайщика → видит степпер
// ConnectionAgreementStepper и проходит начальные шаги.
//
// После исправления role partner1 в boot/infra.ts (chairman → user) пайщик
// после signin + подписания соглашений попадает на Стол пайщика
// (workspace=participant), где в меню виден пункт «Подключение»
// (`/:coopname/connect`). Видимость: roles=['user'] + isCoop=true + coopname=voskhod.
//
// Степпер (см. widgets/ConnectionAgreementStepper):
//   0 UnionMembershipStep — только если is_unioned (Восход = is_unioned=true)
//   1 IntroStep            — приветствие + выбор тарифа
//   2 FormStep             — реквизиты подключаемого кооператива
//   3 AgreementStep        — текст Соглашения о подключении (подписывается)
//   4 DomainValidationStep — DNS-проверка домена
//   5 ApprovalWaitingStep  — ожидание одобрения председателем Восхода
//   6 InstallationStep     — установка провайдером
//
// Расширенный сценарий: проходим IntroStep → FormStep → AgreementStep
// (подписание + on-chain registerCooperative) → DomainValidationStep.
// IS_UNIONED=false в controller/.env, поэтому UnionMembership/Matrix пропущен.

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loginAs, signOnboardingAgreements } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

export const meta = {
  title: 'Партнёр-1 открывает раздел «Подключение» в Столе пайщика',
  docPath: 'new/onboarding/03-partner-connect.md',
  assetsDir: 'assets/new/onboarding/03-partner-connect',
  role: 'partner',
};

export default async ({ page, shot }) => {
  const partner = JSON.parse(fs.readFileSync(COOP_FIXTURE_PATH, 'utf8'));

  page.on('console', (msg) => {
    const t = msg.type();
    const txt = msg.text();
    if (t === 'error' || t === 'warning') console.log(`  [browser:${t}] ${txt}`);
    else if (t === 'log' && (txt.includes('инстанс') || txt.includes('Ошибка') || txt.includes('isBadGateway') || txt.includes('Подключение'))) {
      console.log(`  [browser:log] ${txt}`);
    }
  });
  page.on('pageerror', (err) => console.log(`  [pageerror] ${err.message}`));
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('/v1/graphql')) {
      try {
        const body = await res.text();
        if (body.includes('Ошибка') || body.includes('error') || body.includes('errors')) {
          if (body.includes('getCurrentInstance') || body.includes('CurrentInstance') || body.includes('Инстанс')) {
            console.log(`  [graphql:${res.status()}] ${body.slice(0, 600)}`);
          }
        }
      } catch {}
    }
  });
  page.on('requestfailed', (req) => {
    const u = req.url();
    if (u.includes('graphql') || u.includes('coopenomics')) {
      console.log(`  [requestfailed] ${req.method()} ${u} — ${req.failure()?.errorText}`);
    }
  });

  await loginAs(page, partner);

  // Каскад соглашений первого входа — закрываем как пайщик.
  await page.locator('button:visible:has-text("Подписать")').first()
    .waitFor({ state: 'visible', timeout: 30_000 }).catch(() => {});
  const signedRes = await signOnboardingAgreements(page, { maxAgreements: 6 });
  console.log(`  подписано соглашений: ${signedRes.signed}/${signedRes.attempts}`);
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await shot(
    page,
    '01-participant-dashboard',
    'partner1 (роль user) после подписи соглашений попадает на Стол пайщика. В левом меню — пункт «Подключение» (виден только пайщикам Восхода, на других кооперативах скрыт условием isCoop && coopname==="voskhod").',
  );

  // Клик по пункту меню «Подключение». Это могут быть варианты:
  //   - q-item с label «Подключение» в side-drawer
  //   - простая ссылка
  // Ищем по тексту + role=link/menuitem.
  const connectMenu = page.locator(':is(a, [role="menuitem"], .q-item):has-text("Подключение")').first();
  await connectMenu.waitFor({ state: 'visible', timeout: 15_000 });
  await connectMenu.click({ force: true });
  await page.waitForURL(/\/connect(\b|\/|\?|$)/, { timeout: 15_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  await shot(
    page,
    '02-connect-stepper',
    'Страница «Подключение к Кооперативной Экономике». IS_UNIONED=false в dev-стенде, шаг UnionMembership пропущен — активный шаг сразу IntroStep (выбор тарифа). Доступен единственный «Тестовый» тариф 1500 RUB/мес, 150 AXON.',
  );

  // ─── IntroStep: выбор тарифа ────────────────────────────────────────────
  const tariffCard = page.locator('.tariff-card:has-text("Тестовый")').first();
  await tariffCard.waitFor({ state: 'visible', timeout: 10_000 });
  await tariffCard.click();
  // Дождаться, пока кнопка «Продолжить» активна (selectedTariff != null).
  const introContinue = page.locator('q-stepper-navigation button:has-text("Продолжить"), .q-stepper__nav button:has-text("Продолжить")').first();
  await introContinue.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForTimeout(500);
  await introContinue.click();

  // ─── FormStep: реквизиты подключаемого кооператива ──────────────────────
  // Используем `partner-dev.coopenomics.world` как announce — он уже проксируется
  // на dev-стек (см. /etc/nginx/sites-available/voskhod-dev.conf), и DNS уже
  // указывает на 176.222.53.50, что нужно для DomainValidationStep.
  await page.locator('label:has-text("Домен или поддомен для запуска"), label:has-text("Домен")').first()
    .locator('input').waitFor({ state: 'visible', timeout: 15_000 });

  await page.locator('label:has-text("Домен")').first().locator('input').fill('partner-dev.coopenomics.world');

  // Заполняем 4 финансовых поля. В Quasar q-input меточный label, не placeholder.
  const setNumberByLabel = async (labelText, value) => {
    const inputs = page.locator(`label:has-text("${labelText}")`).locator('input');
    const count = await inputs.count();
    if (count === 0) throw new Error(`не найден input для "${labelText}"`);
    // Несколько label с одинаковым текстом (физлица/организации) — заполним по индексу.
    for (let i = 0; i < count; i++) {
      const val = Array.isArray(value) ? value[i] : value;
      await inputs.nth(i).fill(String(val));
    }
  };

  await setNumberByLabel('Вступительный взнос', ['100', '1000']);
  await setNumberByLabel('Минимальный паевый взнос', ['300', '3000']);

  await shot(
    page,
    '03-form-filled',
    'FormStep заполнен: announce=partner-dev.coopenomics.world, физлица 100/300 RUB, организации 1000/3000 RUB. Кнопка «Продолжить» доступна.',
  );

  // submit Form компонента — это type=submit внутри q-form.
  const formSubmit = page.locator('button[type="submit"]:has-text("Продолжить")').first();
  await formSubmit.click();

  // ─── AgreementStep: ждём генерации документа ────────────────────────────
  // AgreementStep показывает Loader пока document не готов; затем DocumentHtmlReader.
  // Подождём появления реального текста соглашения (DocumentHtmlReader контейнер).
  const agreementBody = page.locator('.DocumentHtmlReader, .document-html-reader, [class*="DocumentHtml"]').first();
  await agreementBody.waitFor({ state: 'visible', timeout: 60_000 }).catch(() => {});
  // На случай если класс отличается — подождём кнопку «Подписать» как сигнал готовности.
  const signBtn = page.locator('button:has-text("Подписать"):not([disabled])').first();
  await signBtn.waitFor({ state: 'visible', timeout: 60_000 });

  await shot(
    page,
    '04-agreement-ready',
    'AgreementStep: соглашение о подключении сгенерировано (document.sign готов), кнопка «Подписать» активна.',
  );

  // Подписать → wallet.signagree + on-chain registerCooperative. Может занять ≥5s.
  await signBtn.click();

  // После подписания: ConnectionAgreementPage обновит coop+instance, шаг
  // переключится на DomainValidationStep (currentStep=4) или сразу на ApprovalWaiting.
  await page.waitForURL(/\/connect/, { timeout: 10_000 }).catch(() => {});
  // Дождёмся появления заголовка «Настройка домена» либо «Ожидание подтверждения».
  await page.waitForFunction(() => {
    const txt = document.body?.innerText || '';
    return txt.includes('Настройка домена') || txt.includes('Ожидание') || txt.includes('A-запись');
  }, { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await shot(
    page,
    '05-domain-validation',
    'DomainValidationStep: после подписания соглашения и on-chain registerCooperative степпер переходит к проверке DNS. Показан домен partner-dev.coopenomics.world и IP сервера для A-записи.',
  );

  console.log(`  URL финиш: ${page.url()}`);
};
