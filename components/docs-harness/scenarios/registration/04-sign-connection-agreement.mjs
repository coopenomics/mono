// Сценарий: Партнёр-1 (cooperative-пайщик) подписывает соглашение
// о подключении к платформе Кооперативной Экономики.
//
// Поток UX (см. components/desktop/src/widgets/ConnectionAgreementStepper):
//   /:coopname/connect → ConnectionAgreementPage
//   ├── isLoading        → WindowLoader
//   ├── !is_providered   → «обратитесь в ПК ВОСХОД» (заглушка)
//   └── is_providered    → ConnectionAgreementStepper (7 шагов):
//                          0 UnionMembership (опц.) → 1 Intro → 2 Form
//                          → 3 Agreement → 4 DomainValidation
//                          → 5 ApprovalWaiting → 6 Installation
//
// Зависимости:
//   * partner1.json (фикстура signUp из 02-sign-and-submit) — wif/username/email
//
// Backend-зависимости (на тестовом стенде без mock-провайдера платежей
// не выполнены, поэтому сценарий фиксирует то, что реально видит пользователь):
//   * Партнёр-1 ещё не принят как пайщик Восхода (approval pending) —
//     при попытке открыть /connect возможен редирект или закрытая страница.
//   * is_providered ставится после InstallCooperative от Союза — на стенде
//     этого нет, поэтому ожидаем заглушку, а не стэппер.
//
// Цель шотов: задокументировать UX-точку — что именно увидит председатель
// Партнёр-1, когда зайдёт на страницу подключения до того, как Восход
// активирует его инстанс.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { env, dismissOnboardingDialogs } from '../../lib/harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOP_FIXTURE_PATH = path.resolve(__dirname, '../../state/cooperatives/partner1.json');

export const meta = {
  title: 'Партнёр-1 открывает «Соглашение о подключении» к платформе Восхода',
  docPath: 'new/onboarding/04-sign-connection-agreement.md',
  assetsDir: 'assets/new/onboarding/04-sign-connection-agreement',
  role: 'user',
};

export default async ({ page, shot }) => {
  const partner = JSON.parse(fs.readFileSync(COOP_FIXTURE_PATH, 'utf8'));
  if (!partner.username || !partner.wif || !partner.email) {
    throw new Error('partner1.json без username/wif/email — сначала запустите 02-sign-and-submit');
  }

  // --- 1. Логин Партнёр-1. ---
  // На текущем тестовом стенде Партнёр-1 ещё не принят советом Восхода как
  // пайщик (платёж pending → approval не создан → status='joined',
  // is_registered=false в pg.users). Login UI в этом случае:
  //   1) отрабатывает Mutations.Auth.Login (sdk Client.login) успешно,
  //   2) sees !session.isRegistrationComplete → router.push({name:'signup'})
  // Это легитимный UX для шага «вы ещё не приняты — продолжите регистрацию».
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/auth/signin`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('button:has-text("Войти")', { timeout: 30_000 });
  await page.locator('label:has-text("электронную почту")').first().locator('input').fill(partner.email);
  await page.locator('label:has-text("ключ доступа")').first().locator('input').fill(partner.wif);
  await page.locator('button:has-text("Войти")').click();
  // Допускаем оба исхода: signup-redirect (пайщик ещё не принят) либо успешный
  // вход в participant/chairman/soviet/user.
  await page.waitForURL(/\/(chairman|participant|soviet|user|signup)/, { timeout: 30_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await dismissOnboardingDialogs(page);
  await page.waitForTimeout(500);
  console.log(`[04-sign-connection-agreement] url after login: ${page.url()}`);

  const isInSignup = /\/signup\b/.test(page.url());
  if (isInSignup) {
    // Партнёр-1 не пускают глубже — пайщик ещё в статусе joined.
    // Это и есть документируемая точка: оператору Восхода нужно сначала
    // подтвердить платёж и принять заявку (см. сценарий 03 + будущие шаги
    // активации), и только тогда станет доступна страница «Подключение».
    await shot(
      page,
      '01-blocked-signup',
      'Партнёр-1 после первого логина: Восход ещё не принял его как пайщика '
      + '(status=joined, is_registered=false), поэтому фронт перенаправляет '
      + 'обратно на /signup. Доступ к «Соглашению о подключении» откроется '
      + 'после одобрения советом (сценарий 03) и активации (сценарий 05).',
    );
    return;
  }

  await shot(
    page,
    '01-partner-home',
    'Стартовый экран Партнёр-1 после первого входа в Восход (онбординг-диалоги обработаны).',
  );

  // --- 2. Переходим в раздел «Подключение» (/:coopname/connect). ---
  // Маршрут зарегистрирован в extensions/participant/install.ts с условием
  // isCoop === true && coopname === 'voskhod' — открыт всем cooperative-
  // пайщикам Восхода.
  await page.goto(`${env.BASE_URL}/${env.COOPNAME}/connect`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await dismissOnboardingDialogs(page);
  await page.waitForTimeout(1500);
  console.log(`[04-sign-connection-agreement] url after goto /connect: ${page.url()}`);

  const pageState = await page.evaluate(() => {
    const text = (document.body.textContent || '').replace(/\s+/g, ' ');
    return {
      hasStepper: !!document.querySelector('.q-stepper'),
      hasLoader: !!document.querySelector('.window-loader, [class*="loader"]'),
      hasFallback: /обратитесь в ПК ВОСХОД|Перейти на сайт/.test(text),
      hasProvider: /провайдер|is_providered/.test(text),
      activeStepTitle: document.querySelector('.q-stepper__tab--active .q-stepper__title')?.textContent?.trim() || null,
      bodyTextStart: text.trim().slice(0, 300),
    };
  });
  console.log(`[04-sign-connection-agreement] page state: ${JSON.stringify(pageState)}`);

  await shot(
    page,
    '02-connection-page',
    pageState.hasFallback
      ? 'Страница «Подключение» (Партнёр-1): кооператив ещё не подключён к платформе — UI приглашает обратиться к провайдеру ПК ВОСХОД.'
      : pageState.hasStepper
        ? `Страница «Подключение» (Партнёр-1): открыт мастер ConnectionAgreementStepper (активный шаг: ${pageState.activeStepTitle || '—'}).`
        : 'Страница «Подключение» (Партнёр-1): начальное состояние после открытия маршрута /:coopname/connect.',
  );

  // --- 3. Если виден стэппер — пытаемся пройти по шагам и снимать каждый. ---
  if (pageState.hasStepper) {
    // Шаг 0 (опционально) — UnionMembership. На большинстве конфигов is_unioned=false,
    // и Vue стартует с шага 1 (Intro). Если активен 0 — снимаем и пробуем «Продолжить».
    for (let i = 0; i < 7; i++) {
      const stepInfo = await page.evaluate(() => {
        const active = document.querySelector('.q-stepper__tab--active');
        if (!active) return null;
        return {
          title: active.querySelector('.q-stepper__title')?.textContent?.trim() || null,
          stepIndex: Array.from(document.querySelectorAll('.q-stepper__tab')).indexOf(active),
        };
      });
      if (!stepInfo) {
        console.log(`[04-sign-connection-agreement] no active step at iter ${i}`);
        break;
      }
      const safeTitle = (stepInfo.title || `step-${i}`).replace(/[^а-яА-ЯёЁa-zA-Z0-9-]+/g, '-').toLowerCase();
      await shot(
        page,
        `03-step-${i + 1}-${safeTitle}`.slice(0, 60),
        `Шаг «${stepInfo.title || `№${stepInfo.stepIndex}`}» мастера соглашения о подключении.`,
      );

      // Ищем кнопку продвижения дальше. Возможные тексты: «Продолжить», «Далее»,
      // «Подписать», «Сгенерировать», «Подтвердить». На шагах ожидания
      // (DomainValidation/ApprovalWaiting/Installation) их нет — там backend
      // двигает stepper автоматически.
      const nextBtn = page.locator(
        '.q-stepper__step.q-stepper--active-content button:has-text("Продолжить"), '
        + '.q-stepper__step.q-stepper--active-content button:has-text("Далее"), '
        + '.q-stepper__step.q-stepper--active-content button:has-text("Подписать"), '
        + '.q-stepper__step.q-stepper--active-content button:has-text("Подтвердить")',
      ).first();
      const canAdvance = await nextBtn.isVisible({ timeout: 1_000 }).catch(() => false);
      if (!canAdvance) {
        console.log(`[04-sign-connection-agreement] step ${i + 1}: no advance-button — stopping`);
        break;
      }
      const isDisabled = await nextBtn.isDisabled().catch(() => true);
      if (isDisabled) {
        console.log(`[04-sign-connection-agreement] step ${i + 1}: advance-button disabled (нужны действия пайщика)`);
        break;
      }
      await nextBtn.click({ timeout: 5_000 }).catch((e) => console.log(`[04-sign-connection-agreement] click fail: ${e.message}`));
      await page.waitForTimeout(1500);
    }
  }

  // --- 4. Финальный шот — что осталось на экране. ---
  await shot(
    page,
    '99-final-state',
    'Финальное состояние страницы подключения после прохода по доступным шагам — дальше требуется активация Восходом (см. сценарий 05).',
  );
};
