<template>
  <main class="dev-ui">
    <header class="dev-ui__head">
      <div>
        <div class="t-eyebrow">MONO Platform v2</div>
        <h1 class="dev-ui__title">Базовые компоненты</h1>
        <p class="t-sm t-muted">
          Минимальный набор обёрток <code>src/shared/ui/base/*</code>, регистрируется
          глобально через <code>boot/ui.ts</code>. Используется как фундамент для
          компоновки страниц.
        </p>
      </div>
      <ThemeToggle />
    </header>

    <!-- ============ 00 TOKEN PALETTE ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">00</span>
        <h2 class="dev-ui__sect-title">Палитра системы</h2>
        <p class="dev-ui__sect-sub">
          Текущие значения CSS-токенов <code>--p-*</code> для активной темы.
          Меняй цвет любого токена — компоненты ниже перекрасятся в реальном
          времени. Кнопка «Сбросить» возвращает дефолтные значения из
          <code>tokens.css</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__token-head">
          <span class="t-sm t-muted">
            Активная тема: <b>{{ themeName }}</b> · переопределено
            <b>{{ overriddenCount }}</b> токен(ов)
          </span>
          <BaseButton variant="ghost" size="sm" @click="resetTokens">
            Сбросить
          </BaseButton>
        </div>

        <template v-for="group in tokenGroups" :key="group.title">
          <div class="dev-ui__token-group-title">{{ group.title }}</div>
          <div class="dev-ui__tokens">
            <label
              v-for="t in group.items"
              :key="t.key"
              :class="['dev-ui__token', { 'dev-ui__token--overridden': overridden[t.key] }]"
            >
              <span class="dev-ui__token-swatch" :style="{ background: `var(${t.key})` }" />
              <div class="dev-ui__token-meta">
                <div class="dev-ui__token-name">{{ t.label }}</div>
                <code class="dev-ui__token-key">{{ t.key }}</code>
              </div>
              <input
                v-if="t.type === 'color'"
                type="color"
                class="dev-ui__token-picker"
                :value="hexValues[t.key] || '#000000'"
                @input="(e) => onColorChange(t.key, (e.target as HTMLInputElement).value)"
              />
              <input
                v-else
                type="text"
                class="dev-ui__token-text"
                :value="resolvedValues[t.key]"
                @change="(e) => onTextChange(t.key, (e.target as HTMLInputElement).value)"
              />
            </label>
          </div>
        </template>
      </div>
    </section>

    <!-- ============ 01 BUTTONS ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">01</span>
        <h2 class="dev-ui__sect-title">Кнопки</h2>
        <p class="dev-ui__sect-sub">
          Один solid акцент, нейтральные secondary/ghost, скрытый destructive.
          Размеры sm · md · lg. Иконочная кнопка через <code>iconOnly</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="u-row u-row--wrap u-row--gap-4">
          <BaseButton variant="primary">Совершить взнос</BaseButton>
          <BaseButton variant="secondary">Получить возврат</BaseButton>
          <BaseButton variant="ghost">Отменить</BaseButton>
          <BaseButton variant="danger">Удалить</BaseButton>
        </div>
        <div class="u-row u-row--wrap u-row--gap-4" style="margin-top: 16px">
          <BaseButton variant="primary" size="lg">Большая основная</BaseButton>
          <BaseButton variant="secondary" size="sm">Малая вторичная</BaseButton>
          <BaseButton variant="ghost" size="sm">Малая ghost</BaseButton>
          <BaseButton variant="secondary" icon-only aria-label="Копировать">⎘</BaseButton>
          <BaseButton variant="primary" disabled>Disabled</BaseButton>
        </div>
        <div class="u-row u-row--wrap u-row--gap-4" style="margin-top: 16px; max-width: 320px">
          <BaseButton variant="primary" block>Растянутая (block)</BaseButton>
        </div>
      </div>
    </section>

    <!-- ============ 02 INPUTS ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">02</span>
        <h2 class="dev-ui__sect-title">Поля ввода</h2>
        <p class="dev-ui__sect-sub">
          Hairline-граница, focus — кольцо акцента. Префикс/суффикс через props,
          моноширинный режим — для логинов и идентификаторов.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="grid-2">
          <BaseInput v-model="inputText" label="E-mail" placeholder="user@example.com" type="email" />
          <BaseInput v-model="inputMono" label="Имя аккаунта" mono />
          <BaseInput v-model="inputAmount" label="Сумма возврата" suffix="RUB" />
          <BaseInput v-model="inputError" label="Поле с ошибкой" error="Введите корректное значение" />
        </div>
      </div>
    </section>

    <!-- ============ 03 SELECT ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">03</span>
        <h2 class="dev-ui__sect-title">Выпадающий список</h2>
        <p class="dev-ui__sect-sub">
          Натив <code>&lt;select&gt;</code> с canon-оформлением. Для async-источников и
          мульти-выбора — отдельные компоненты в следующих эпиках.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="grid-2">
          <BaseSelect
            v-model="selectMethod"
            label="Способ получения"
            placeholder="Выберите способ"
            :options="paymentOptions"
          />
          <BaseSelect
            v-model="selectPeriod"
            label="Период"
            :options="periodOptions"
            hint="Можно изменить позже в фильтре отчётов"
          />
        </div>
      </div>
    </section>

    <!-- ============ 04 CHIPS & BADGES ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">04</span>
        <h2 class="dev-ui__sect-title">Чипы и статусы</h2>
        <p class="dev-ui__sect-sub">
          Чип — заливка. Бэйдж со статус-точкой — для строк таблиц и информационных
          панелей. Один и тот же набор вариантов.
        </p>
      </div>
      <div class="grid-2">
        <div class="dev-ui__stage">
          <div class="t-eyebrow" style="margin-bottom: 14px">Чипы</div>
          <div class="u-row u-row--wrap u-row--gap-2">
            <BaseChip variant="pos">Завершён</BaseChip>
            <BaseChip variant="accent">Активный</BaseChip>
            <BaseChip variant="info">В обработке</BaseChip>
            <BaseChip variant="warn">Ожидает подписи</BaseChip>
            <BaseChip variant="neg">Отклонён</BaseChip>
            <BaseChip variant="neutral">Черновик</BaseChip>
          </div>
        </div>
        <div class="dev-ui__stage">
          <div class="t-eyebrow" style="margin-bottom: 14px">Точка + текст</div>
          <div class="stack stack--3">
            <BaseBadge variant="pos">Завершён · 10.03.2026</BaseBadge>
            <BaseBadge variant="accent">Активный</BaseBadge>
            <BaseBadge variant="info">В обработке советом</BaseBadge>
            <BaseBadge variant="warn">Ожидает 2 подписи</BaseBadge>
            <BaseBadge variant="neg">Отклонён · 02.04.2026</BaseBadge>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 05 CARDS ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">05</span>
        <h2 class="dev-ui__sect-title">Карточки</h2>
        <p class="dev-ui__sect-sub">
          Базовый контейнер: surface, hairline-граница, радиус 12. Шапка с заголовком
          и действиями — через слоты или props.
        </p>
      </div>
      <div class="grid-2">
        <BaseCard title="Удостоверение пайщика" subtitle="Регистрационные данные">
          <template #actions>
            <BaseButton variant="ghost" size="sm">Изменить</BaseButton>
          </template>
          <p class="t-sm t-muted">
            Базовая карточка с заголовком, сабтайтлом и кнопкой действия в шапке.
            Внутри — произвольное содержимое через дефолтный слот.
          </p>
        </BaseCard>

        <BaseCard variant="flat" title="Flat-вариант">
          <p class="t-sm t-muted">
            Без рамки, фон <code>surface-2</code>. Удобно для вложенных карточек
            и второго уровня иерархии.
          </p>
        </BaseCard>
      </div>
    </section>

    <!-- ============ 06 BANNERS ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">06</span>
        <h2 class="dev-ui__sect-title">Баннеры</h2>
        <p class="dev-ui__sect-sub">Тонкая полоса с иконкой и текстом. Внутри диалогов и в шапке экранов.</p>
      </div>
      <div class="dev-ui__stage">
        <div class="stack stack--3">
          <BaseBanner variant="info">
            <template #icon>i</template>
            Заявление будет отправлено в совет кооператива на рассмотрение.
          </BaseBanner>
          <BaseBanner variant="pos">
            <template #icon>✓</template>
            Паевой взнос на сумму 1&nbsp;000,00&nbsp;RUB успешно проведён в реестре.
          </BaseBanner>
          <BaseBanner variant="warn">
            <template #icon>!</template>
            Требуется подпись 2&nbsp;из&nbsp;5 членов совета.
          </BaseBanner>
          <BaseBanner variant="neg">
            <template #icon>×</template>
            Не удалось проверить подпись. Обновите ключ и повторите.
          </BaseBanner>
        </div>
      </div>
    </section>

    <!-- ============ 07 DIALOG ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">07</span>
        <h2 class="dev-ui__sect-title">Диалоги</h2>
        <p class="dev-ui__sect-sub">
          Модальное окно с шапкой, телом и подвалом действий. Telleport в body,
          закрытие по backdrop и Escape — управляемое через props.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="u-row u-row--wrap u-row--gap-4">
          <BaseButton @click="dialogOpen = true">Открыть диалог</BaseButton>
        </div>

        <BaseDialog v-model="dialogOpen" title="Паевой взнос">
          <p class="t-sm t-muted" style="margin: 0">
            Укажите сумму взноса в ЦПП «Цифровой кошелёк». Документ будет
            сформирован и подписан автоматически.
          </p>
          <BaseInput v-model="dialogAmount" label="Сумма" suffix="RUB" />
          <template #footer>
            <BaseButton variant="ghost" @click="dialogOpen = false">Отменить</BaseButton>
            <BaseButton variant="primary" @click="dialogOpen = false">Продолжить</BaseButton>
          </template>
        </BaseDialog>
      </div>
    </section>

    <!-- ============ 08 FORM ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">08</span>
        <h2 class="dev-ui__sect-title">Форма</h2>
        <p class="dev-ui__sect-sub">
          Контейнер <code>BaseForm</code> с собственным submit, общей ошибкой
          через prop <code>error</code>, кнопками в слоте <code>#footer</code>.
        </p>
      </div>
      <div class="dev-ui__stage" style="max-width: 480px">
        <BaseForm :loading="formLoading" :error="formError" @submit="onFormSubmit">
          <BaseInput v-model="formEmail" label="E-mail" type="email" required placeholder="chairman@voskhod.ru" />
          <BaseInput v-model="formPass" label="Пароль" type="password" required />
          <template #footer="{ loading }">
            <BaseButton variant="ghost" type="button">Отмена</BaseButton>
            <BaseButton variant="primary" type="submit" :disabled="loading">
              {{ loading ? 'Отправка…' : 'Войти' }}
            </BaseButton>
          </template>
        </BaseForm>
      </div>
    </section>

    <!-- ============ 09 EMPTY STATE ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">09</span>
        <h2 class="dev-ui__sect-title">Пустые состояния</h2>
        <p class="dev-ui__sect-sub">Скромная иконка-плитка, заголовок, сабтайтл, действие.</p>
      </div>
      <div class="dev-ui__stage">
        <EmptyState
          title="Способы получения платежей не добавлены"
          body="Добавьте банковскую карту или реквизиты, чтобы кооператив мог перечислять вам средства."
        >
          <template #icon>$</template>
          <template #action>
            <BaseButton variant="primary">Добавить способ</BaseButton>
          </template>
        </EmptyState>
      </div>
    </section>

    <!-- ============ 10 AVATAR ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">10</span>
        <h2 class="dev-ui__sect-title">Аватары</h2>
        <p class="dev-ui__sect-sub">
          Размеры xs · sm · md · lg · xl. Если задан <code>src</code> — картинка;
          иначе инициалы из props <code>name</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="u-row u-row--gap-6" style="align-items: center">
          <Avatar name="Антон Председатель" size="xs" />
          <Avatar name="Антон Председатель" size="sm" />
          <Avatar name="Антон Председатель" />
          <Avatar name="Антон Председатель" size="lg" tone="accent" />
          <Avatar name="Антон Председатель" size="xl" tone="primary" />
        </div>
      </div>
    </section>

    <!-- ============ 11 TABLE ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">11</span>
        <h2 class="dev-ui__sect-title">Таблица</h2>
        <p class="dev-ui__sect-sub">
          Базовая таблица: header uppercase eyebrow, hairline-разделители,
          tabular-nums для числовых колонок.
        </p>
      </div>
      <BaseTable :columns="tableColumns" :rows="tableRows" row-key="id">
        <template #cell-status="{ value }">
          <BaseBadge :variant="(value as 'pos' | 'warn' | 'neg')">
            {{ statusLabel(value as string) }}
          </BaseBadge>
        </template>
        <template #cell-amount="{ value }">
          <span class="t-num">{{ value }} RUB</span>
        </template>
      </BaseTable>
    </section>

    <!-- ============ 12 LAYOUT — APP DRAWER (rail) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">12</span>
        <h2 class="dev-ui__sect-title">Боковая панель (AppDrawer)</h2>
        <p class="dev-ui__sect-sub">
          Solid surface (no gradient), активный пункт — soft-primary заливка
          пилюлей + 2-px рейл слева (deep teal). Принимает <code>items</code> и
          <code>activeKey</code> через props.
        </p>
      </div>
      <div class="dev-ui__stage" style="padding: 0">
        <div class="dev-ui__rail-demo">
          <AppDrawer
            coop-name="ПК «Восход»"
            coop-meta="Стол пайщика"
            :items="railItems"
            :active-key="railActive"
            show-cmdk
            cmdk-label="Найти"
            @select="(i) => (railActive = i.key)"
          >
            <template #footer>
              <RailUserCard
                v-model:collapsed="railUserCollapsed"
                name="Муравьёв А.Н."
                role="Председатель совета"
                :balance="'400,00'"
                symbol="RUB"
                balance-route="/_dev/ui#wallet"
                show-signout
                @primary-action="onTopUp"
                @balance-click="onBalanceClick"
                @signout="onSignout"
              />
            </template>
          </AppDrawer>
          <div class="dev-ui__rail-stub">
            <div class="t-muted t-sm">— контент текущего раздела —</div>
            <div class="t-meta t-faint">Активный пункт: <code>{{ railActive }}</code></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 13 LAYOUT — APP HEADER (topbar) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">13</span>
        <h2 class="dev-ui__sect-title">Шапка приложения (AppHeader)</h2>
        <p class="dev-ui__sect-sub">
          Каноничный паттерн <code>[≡] crumb · · · действия │ глобальные</code>.
          Поддерживает простой title и multi-level breadcrumb с chevron'ами.
        </p>
      </div>
      <div class="dev-ui__stage" style="padding: 0; overflow: hidden">
        <AppHeader title="Кошелёк" @toggle-menu="onMenuToggle">
          <template #actions>
            <BaseButton variant="primary" size="sm">Совершить взнос</BaseButton>
            <button class="icon-btn" aria-label="Ещё действия" type="button">⋯</button>
          </template>
          <template #notifications>
            <button class="icon-btn dev-ui__notifs" aria-label="Уведомления" type="button">
              ☷<span class="dev-ui__notifs-dot" />
            </button>
          </template>
          <template #theme>
            <ThemeToggle />
          </template>
        </AppHeader>
      </div>
      <div class="dev-ui__stage" style="padding: 0; overflow: hidden">
        <AppHeader
          :breadcrumbs="[
            { label: 'Мастерская' },
            { label: 'Проект «Восход 2025»' },
          ]"
          @toggle-menu="onMenuToggle"
        >
          <template #actions>
            <BaseButton variant="primary" size="sm">Новый взнос</BaseButton>
          </template>
          <template #notifications>
            <button class="icon-btn" aria-label="Уведомления" type="button">☷</button>
          </template>
          <template #theme>
            <ThemeToggle />
          </template>
        </AppHeader>
      </div>
    </section>

    <!-- ============ 14 LAYOUT — PAGE HEAD ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">14</span>
        <h2 class="dev-ui__sect-title">Шапка страницы (PageHead)</h2>
        <p class="dev-ui__sect-sub">
          Eyebrow + title + subtitle + actions. Используется для страниц
          без подстраниц — единственный носитель действий, если нет
          <code>PageTabs</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <PageHead
          eyebrow="Контактные данные"
          title="Потребительский Кооператив «Восход»"
          subtitle="ИНН 9728130611 · ОГРН 124770283346 · Зарегистрирован в реестре кооперативов с 15 марта 2024 года."
        >
          <template #actions>
            <BaseButton variant="secondary" size="sm">Скопировать карточку</BaseButton>
          </template>
        </PageHead>
      </div>
    </section>

    <!-- ============ 15 LAYOUT — PAGE TABS ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">15</span>
        <h2 class="dev-ui__sect-title">Вкладки страницы (PageTabs)</h2>
        <p class="dev-ui__sect-sub">
          Подстраницы текущего раздела. Sub-action — отдельный слот справа,
          отделён hairline. Используется ВМЕСТО <code>page-head__actions</code>
          когда у страницы есть подстраницы.
        </p>
      </div>
      <div class="dev-ui__stage" style="padding: 0; overflow: hidden">
        <PageTabs :tabs="walletTabs" :active-key="walletTab" @select="(t) => (walletTab = t.key)" />
      </div>
      <div class="dev-ui__stage" style="padding: 0; overflow: hidden; margin-top: 12px">
        <PageTabs :tabs="projectTabs" :active-key="projectTab" @select="(t) => (projectTab = t.key)">
          <template #actions>
            <BaseButton variant="ghost" size="sm">Фильтр</BaseButton>
          </template>
        </PageTabs>
      </div>
    </section>

    <!-- ============ 16 LAYOUT — APP FRAME (вся связка) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">16</span>
        <h2 class="dev-ui__sect-title">Каркас приложения</h2>
        <p class="dev-ui__sect-sub">
          AppDrawer + AppHeader + PageTabs в живой связке. Никаких legacy
          QLayout/QDrawer — только canon-разметка через layout-обёртки.
        </p>
      </div>
      <div class="dev-ui__stage" style="padding: 0; overflow: hidden">
        <div class="dev-ui__appframe">
          <AppDrawer
            coop-name="ПК «Восход»"
            coop-meta="Стол пайщика"
            :items="frameItems"
            :active-key="frameActive"
            show-cmdk
            @select="(i) => (frameActive = i.key)"
          >
            <template #footer>
              <RailUserCard
                v-model:collapsed="frameUserCollapsed"
                name="Муравьёв А.Н."
                role="Председатель совета"
                :balance="'400,00'"
                symbol="RUB"
                show-signout
                @primary-action="onTopUp"
                @signout="onSignout"
              />
            </template>
          </AppDrawer>
          <div class="dev-ui__appframe-content">
            <AppHeader title="Кошелёк">
              <template #actions>
                <BaseButton variant="primary" size="sm">Совершить взнос</BaseButton>
              </template>
              <template #notifications>
                <button class="icon-btn" aria-label="Уведомления" type="button">☷</button>
              </template>
              <template #theme>
                <ThemeToggle />
              </template>
            </AppHeader>
            <PageTabs :tabs="walletTabs" :active-key="walletTab" @select="(t) => (walletTab = t.key)" />
            <div class="dev-ui__appframe-body">
              <div class="t-sm t-muted">— содержимое вкладки —</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 17 WALLET CARD — programs × compact / full ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">17</span>
        <h2 class="dev-ui__sect-title">Кошелёк (WalletCard)</h2>
        <p class="dev-ui__sect-sub">
          Канонический <code>.wallet</code> с программным акцентом
          (<code>--prog-blagorost</code>, <code>--prog-wallet</code>,
          <code>--prog-generator</code>). Compact-вариант (<code>.wallet--row</code>)
          для слота шапки; full — для дашборда.
        </p>
      </div>

      <div class="dev-ui__stage">
        <h3 class="dev-ui__h3">Compact (для слота шапки)</h3>
        <div class="dev-ui__grid dev-ui__grid--3">
          <WalletCard
            compact
            program="blagorost"
            balance="125 400,00"
            symbol="RUB"
          />
          <WalletCard
            compact
            program="wallet"
            balance="48 250,75"
            symbol="RUB"
          />
          <WalletCard
            compact
            program="generator"
            balance="6 320,00"
            symbol="RUB"
          />
        </div>

        <h3 class="dev-ui__h3" style="margin-top: 20px">Full (дашборд)</h3>
        <div class="dev-ui__grid dev-ui__grid--2">
          <WalletCard
            program="blagorost"
            subtitle="Капитализация результатов интеллектуальной деятельности"
            balance="125 400,00"
            symbol="RUB"
            locked-balance="12 000,00"
          />
          <WalletCard
            program="wallet"
            subtitle="Свободный остаток"
            balance="48 250,75"
            symbol="RUB"
          />
          <WalletCard
            program="generator"
            subtitle="Генерация результатов интеллектуальной деятельности"
            balance="6 320,00"
            symbol="RUB"
            locked-balance="2 100,00"
          />
          <WalletCard
            program="wallet"
            subtitle="Пустой счёт"
            balance="0,00"
            symbol="RUB"
            empty
          />
        </div>

        <h3 class="dev-ui__h3" style="margin-top: 20px">Состояние loading</h3>
        <div class="dev-ui__grid dev-ui__grid--3">
          <WalletCard
            compact
            program="blagorost"
            balance=""
            symbol="RUB"
            loading
          />
          <WalletCard
            program="wallet"
            balance=""
            symbol="RUB"
            loading
          />
        </div>
      </div>
    </section>

    <!-- ============ 18 WALLET CARD MINI — connected widget ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">18</span>
        <h2 class="dev-ui__sect-title">Кошелёк · connected (WalletCardMini)</h2>
        <p class="dev-ui__sect-sub">
          <code>widgets/wallet-card-mini</code> — обёртка над WalletCard,
          подключена к Pinia <code>useWalletStore</code> и роутеру (клик →
          <code>name: 'wallet'</code>). На dev-странице store пустой (никто
          не вызвал <code>loadUserWallet</code>) — отрисуется skeleton-loading.
          На реальных страницах после init процесса покажет настоящий баланс.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__grid dev-ui__grid--3">
          <WalletCardMini program="wallet" />
          <WalletCardMini program="blagorost" />
          <WalletCardMini program="generator" />
        </div>
      </div>
    </section>

    <!-- ============ 19 AUTH CARD — композит ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">19</span>
        <h2 class="dev-ui__sect-title">Карточка аутентификации (AuthCard)</h2>
        <p class="dev-ui__sect-sub">
          Композит из <code>.card</code> + center-aligned head + footer-slot.
          Используется на страницах входа / восстановления / приглашения.
          AuthLayout — обёртка для full-page центрирования с тоглом темы.
        </p>
      </div>
      <div class="dev-ui__stage">
        <AuthCard
          title="Вход для пайщиков"
          subtitle="Цифровой Кооператив"
          :max-width="480"
        >
          <BaseForm>
            <BaseInput
              label="Электронная почта"
              type="email"
              placeholder="example@coop.ru"
              autocomplete="email"
            />
            <BaseInput
              label="Ключ доступа"
              type="password"
              autocomplete="current-password"
            />
            <BaseButton variant="primary" block type="submit">Войти</BaseButton>
          </BaseForm>
          <template #footer>
            <a href="#" class="t-sm t-muted">Потеряли ключ?</a>
            <span class="t-sm t-muted">·</span>
            <a href="#" class="t-sm">Нет аккаунта?</a>
          </template>
        </AuthCard>
      </div>
    </section>

    <!-- ============ 20 RESET KEY — двухэтапный flow (E7) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">20</span>
        <h2 class="dev-ui__sect-title">Перевыпуск ключа (ResetKey flow)</h2>
        <p class="dev-ui__sect-sub">
          Двухэтапный flow: пайщик вводит email — получает письмо со ссылкой —
          переходит — видит уже сгенерированный приватный ключ — копирует и
          подтверждает «Я сохранил ключ» — ключ устанавливается on-chain через
          <code>resetKey({token, public_key})</code>. Текущий ключ ввести нельзя
          (его нет — он потерян); новый ключ только генерируется в браузере.
        </p>
      </div>
      <div class="dev-ui__stage rk-dev__stage">
        <div class="rk-dev__frame">
          <div class="rk-dev__caption">Шаг 1. Запрос восстановления (email)</div>
          <LostKey />
        </div>
        <div class="rk-dev__frame">
          <div class="rk-dev__caption">Шаг 2a. После submit — «проверьте почту»</div>
          <ResetKeyForm mode="check-mail" :account="null" />
        </div>
        <div class="rk-dev__frame">
          <div class="rk-dev__caption">Шаг 2b. Переход по ссылке — «сохраните ключ»</div>
          <ResetKeyForm
            mode="save-key"
            :account="rkMockAccount"
            :loading="rkLoading"
            @submit="onRkMockSubmit"
          />
        </div>
      </div>
    </section>

    <!-- ============ 21 ACCOUNT BADGE (E8.5) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">21</span>
        <h2 class="dev-ui__sect-title">Бейдж аккаунта (AccountBadge)</h2>
        <p class="dev-ui__sect-sub">
          Имя on-chain аккаунта (12-символьный EOSIO username) в моноширинном шрифте.
          Размеры <code>sm</code>/<code>md</code>, копирование в буфер, опциональная
          ссылка на explorer.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="row q-col-gutter-md items-center">
          <div class="col-auto">
            <AccountBadge account-name="ivanov12345" />
          </div>
          <div class="col-auto">
            <AccountBadge account-name="petrov54321" size="md" />
          </div>
          <div class="col-auto">
            <AccountBadge account-name="kooperativ1" :copyable="false" />
          </div>
          <div class="col-auto">
            <AccountBadge
              account-name="explorer1234"
              linkable
              explorer-url="https://explorer.coopenomics.world/account/explorer1234"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 22 DATA ROW (E8.3) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">22</span>
        <h2 class="dev-ui__sect-title">Строка данных (DataRow)</h2>
        <p class="dev-ui__sect-sub">
          Унифицированная пара <code>label: value</code> для реестровых карточек —
          паспорт, ИНН, реквизиты, on-chain поля. Опционально mono-режим для ID/хешей,
          опциональная copy-кнопка, slot <code>value-override</code> для нестандартного
          рендера значения.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <DataRow label="ФИО" value="Иванов Иван Иванович" />
          <DataRow label="ИНН" value="772345678901" mono copyable />
          <DataRow label="СНИЛС" value="123-456-789 00" mono />
          <DataRow label="Email" value="ivanov@example.ru" copyable />
          <DataRow label="Адрес" value="г. Москва, ул. Ленина, д. 1, кв. 23" hint="Адрес регистрации по паспорту" />
          <DataRow label="On-chain аккаунт">
            <template #value-override>
              <AccountBadge account-name="ivanov12345" />
            </template>
          </DataRow>
          <DataRow label="Дата регистрации" value="—" />
        </div>
      </div>
    </section>

    <!-- ============ 23 CONTACT SHEET (E8.2) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">23</span>
        <h2 class="dev-ui__sect-title">Контакты (ContactSheet)</h2>
        <p class="dev-ui__sect-sub">
          Карточка контактов с типизированными иконками, кликабельными ссылками
          (<code>mailto:</code>/<code>tel:</code>/<code>t.me</code>), копированием
          и опциональной отметкой verified.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <ContactSheet :contacts="contactsDemo" />
        </div>
      </div>
    </section>

    <!-- ============ 24 IDENTITY PANEL (E8.1) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">24</span>
        <h2 class="dev-ui__sect-title">Идентификация (IdentityPanel)</h2>
        <p class="dev-ui__sect-sub">
          Карточка пайщика/контрагента: аватар + ФИО + on-chain badge + статус + роль.
          Режим <code>compact</code> для шапок/списков, <code>full</code> — для реестров и кабинета.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <IdentityPanel :identity="identityFullDemo">
            <template #actions>
              <BaseButton variant="ghost" size="sm">Открыть</BaseButton>
            </template>
          </IdentityPanel>
          <IdentityPanel :identity="identityPendingDemo" />
          <IdentityPanel :identity="identityBlockedDemo" />
          <IdentityPanel compact :identity="identityCompactDemo" />
        </div>
      </div>
    </section>

    <!-- ============ 25 PERSON CARD (E8.4) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">25</span>
        <h2 class="dev-ui__sect-title">Карточка человека (PersonCard)</h2>
        <p class="dev-ui__sect-sub">
          Презентация человека для реестров, собраний, дел: фото, ФИО, роль,
          on-chain badge, контакты, slot <code>meta</code>. Режим
          <code>compact</code> — одна строка для списков, <code>comfortable</code> —
          полноценная карточка.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__person-grid">
          <PersonCard :person="personFullDemo">
            <template #meta>
              Пайщик с 12 марта 2022 г.
            </template>
          </PersonCard>
          <PersonCard :person="personShortDemo" />
          <div class="dev-ui__person-compact-list">
            <PersonCard density="compact" :person="personFullDemo" />
            <PersonCard density="compact" :person="personShortDemo" />
            <PersonCard density="compact" :person="personMinDemo" />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 26 DOCUMENT ROW (E9.1) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">26</span>
        <h2 class="dev-ui__sect-title">Строка документа (DocumentRow)</h2>
        <p class="dev-ui__sect-sub">
          Документ в списочном виде: иконка типа с tint'ом, заголовок, статус
          через <code>BaseBadge</code>, дата/автор/описание. Клик emit
          <code>open</code> (рутинг — в connected-обёртке).
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <DocumentRow :document="docDraftDemo">
            <template #actions>
              <BaseButton variant="ghost" size="sm">…</BaseButton>
            </template>
          </DocumentRow>
          <DocumentRow :document="docSignedDemo" />
          <DocumentRow :document="docPendingDemo" />
          <DocumentRow :document="docRejectedDemo" />
        </div>
      </div>
    </section>

    <!-- ============ 27 SIGNATURE CARD (E9.3) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">27</span>
        <h2 class="dev-ui__sect-title">Карточка подписи (SignatureCard)</h2>
        <p class="dev-ui__sect-sub">
          Статус подписи документа: подписавший + on-chain аккаунт + статус.
          Для <code>signed</code> — хеш в моно-блоке + ссылка на explorer; для
          <code>rejected</code> — <code>BaseBanner</code> с причиной.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <SignatureCard :signature="signatureSignedDemo" />
          <SignatureCard :signature="signaturePendingDemo" />
          <SignatureCard :signature="signatureRejectedDemo" />
        </div>
      </div>
    </section>

    <!-- ============ 28 ACTIVITY TIMELINE (E9.4) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">28</span>
        <h2 class="dev-ui__sect-title">Хронология событий (ActivityTimeline)</h2>
        <p class="dev-ui__sect-sub">
          Вертикальный таймлайн событий с типизированными иконками. С
          <code>groupByDate</code> — события группируются по дням (Сегодня,
          Вчера, конкретные даты).
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__data-stack">
          <ActivityTimeline :events="timelineDemo" group-by-date />
        </div>
      </div>
    </section>

    <!-- ============ 29 DOCUMENT SIGNATURES (E9.5 — реальная модель) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">29</span>
        <h2 class="dev-ui__sect-title">Подписи документа (DocumentSignatures)</h2>
        <p class="dev-ui__sect-sub">
          Реальная модель: контрольная сумма, список приложенных подписей с
          раскрытием деталей (подписант, публичный ключ, цифровая подпись,
          статус верификации), кнопки «скачать» и «сверить». Встраивается
          в <code>BaseDocument</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__doc-sig-grid">
          <DocumentSignatures v-bind="docSignaturesDemo" />
          <DocumentSignatures v-bind="docSignaturesInvalidDemo" />
        </div>
      </div>
    </section>

    <!-- ============ 30 DOCUMENT PREVIEW (E9.2) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">30</span>
        <h2 class="dev-ui__sect-title">Превью документа (DocumentPreview)</h2>
        <p class="dev-ui__sect-sub">
          HTML/PDF/IMAGE/TXT. HTML прогоняется через DOMPurify (можно отключить
          <code>:sanitize="false"</code>). <code>loading</code> и
          <code>error</code> — стейты сверху.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__preview-grid">
          <DocumentPreview :document="previewHtmlDemo" height="320px" />
          <DocumentPreview :document="{ type: 'pdf' }" loading height="320px" />
          <DocumentPreview :document="{ type: 'pdf' }" error="Сервер вернул 503" height="320px" />
        </div>
      </div>
    </section>

    <!-- ============ 31 AMOUNT INPUT (E10.1) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">31</span>
        <h2 class="dev-ui__sect-title">Денежный ввод (AmountInput)</h2>
        <p class="dev-ui__sect-sub">
          Символ валюты как суффикс, тысячные через неразрывный пробел,
          <code>precision</code> приходит из marketplace asset config.
          <code>showMax</code> + <code>balance</code> — кнопка «макс»,
          подставляющая баланс.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__form-grid">
          <AmountInput
            v-model="amountDemo"
            label="Сумма поддержки"
            symbol="RUB"
            :precision="2"
            placeholder="0,00"
          />
          <AmountInput
            v-model="amountMaxDemo"
            label="Сумма перевода"
            symbol="RUB"
            :precision="2"
            :balance="125342.5"
            show-max
            show-balance
          />
          <AmountInput
            :model-value="50000"
            label="С ошибкой превышения"
            symbol="RUB"
            :precision="2"
            :max="40000"
            error="Сумма больше доступного остатка"
            @update:model-value="() => {}"
          />
          <AmountInput
            :model-value="1234567.89"
            label="Только чтение"
            symbol="RUB"
            :precision="2"
            readonly
            @update:model-value="() => {}"
          />
        </div>
      </div>
    </section>

    <!-- ============ 32 OTP INPUT (E10.2) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">32</span>
        <h2 class="dev-ui__sect-title">OTP-ввод (OtpInput)</h2>
        <p class="dev-ui__sect-sub">
          6 ячеек, автопереход фокуса, Backspace откатывает на предыдущую,
          <code>paste</code> заполняет все. Цифры из regex <code>/^\d$/</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__otp-stack">
          <div>
            <h3 class="dev-ui__h3">обычное состояние</h3>
            <OtpInput v-model="otpDemo" :length="6" />
            <div class="dev-ui__meta-line">Текущее значение: <code>{{ otpDemo || '—' }}</code></div>
          </div>
          <div>
            <h3 class="dev-ui__h3">ошибка</h3>
            <OtpInput
              :model-value="otpErrorDemo"
              :length="6"
              error="Код подтверждения не совпадает"
              @update:model-value="(v) => otpErrorDemo = v"
            />
          </div>
          <div>
            <h3 class="dev-ui__h3">disabled</h3>
            <OtpInput :model-value="'1234'" :length="6" disabled @update:model-value="() => {}" />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 33 FILTER BAR (E10.3) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">33</span>
        <h2 class="dev-ui__sect-title">Панель фильтров (FilterBar)</h2>
        <p class="dev-ui__sect-sub">
          Поиск (debounce 300мс) + dropdown-фильтры + chip'ы активных значений
          с remove + «сбросить всё». Управляется через <code>v-model</code>
          (значения) и <code>v-model:search</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <FilterBar
          v-model="filterValuesDemo"
          v-model:search="filterSearchDemo"
          :filters="filterDefsDemo"
          search-placeholder="Поиск по реестру…"
        />
        <div class="dev-ui__meta-line">
          search: <code>{{ filterSearchDemo || '—' }}</code> ·
          values: <code>{{ JSON.stringify(filterValuesDemo) }}</code>
        </div>
      </div>
    </section>

    <!-- ============ 34 FILE UPLOADER (E10.4) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">34</span>
        <h2 class="dev-ui__sect-title">Загрузка файлов (FileUploader)</h2>
        <p class="dev-ui__sect-sub">
          Drag&drop зона или клик. Валидация по <code>accept</code>,
          <code>maxSize</code>, <code>maxFiles</code> — нарушения уходят в
          <code>@error</code>. Прогресс реальной загрузки — слот
          <code>progress</code>, который заполняет connected-обёртка.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__form-grid">
          <div>
            <h3 class="dev-ui__h3">single</h3>
            <FileUploader
              v-model="singleFileDemo"
              accept=".pdf,.docx"
              :max-size="5 * 1024 * 1024"
              hint="PDF или DOCX, до 5 МБ"
              @error="(e) => uploadErrorDemo = e.message"
            />
          </div>
          <div>
            <h3 class="dev-ui__h3">multiple</h3>
            <FileUploader
              v-model="multiFilesDemo"
              accept="image/*,.pdf"
              multiple
              :max-files="4"
              :max-size="10 * 1024 * 1024"
              hint="Изображения или PDF, до 4 файлов по 10 МБ"
              @error="(e) => uploadErrorDemo = e.message"
            />
          </div>
        </div>
        <div v-if="uploadErrorDemo" class="dev-ui__meta-line dev-ui__meta-line--neg">
          Ошибка: {{ uploadErrorDemo }}
        </div>
      </div>
    </section>

    <!-- ============ 35 VERTICAL STEPPER (E10.5) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">35</span>
        <h2 class="dev-ui__sect-title">Вертикальный степпер (VerticalStepper)</h2>
        <p class="dev-ui__sect-sub">
          Многошаговые сценарии: регистрация, создание проекта, договор.
          Состояния: <code>pending</code>/<code>current</code>/<code>completed</code>/<code>error</code>.
          По клику на завершённый шаг — emit <code>change</code> (возврат назад).
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__stepper-grid">
          <div>
            <h3 class="dev-ui__h3">регистрация</h3>
            <VerticalStepper
              :steps="stepperStepsDemo"
              :active-key="stepperActiveDemo"
              :completed="stepperCompletedDemo"
              @change="(key) => stepperActiveDemo = key"
            />
          </div>
          <div>
            <h3 class="dev-ui__h3">с ошибкой и опциональным шагом</h3>
            <VerticalStepper
              :steps="stepperWithErrorSteps"
              active-key="payment"
              :completed="['main', 'participants']"
              :errored="['payment']"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 36 NOTIFICATION CENTER (E11.1) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">36</span>
        <h2 class="dev-ui__sect-title">Центр уведомлений (NotificationCenter)</h2>
        <p class="dev-ui__sect-sub">
          Panel-content для popover в шапке. Группировка по категориям
          (системные/финансовые/голосования/сообщения), unread bullet,
          «Прочитать все», EmptyState и «Показать все».
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__notification-grid">
          <div>
            <h3 class="dev-ui__h3">с уведомлениями</h3>
            <NotificationCenter
              :notifications="notificationsDemo"
              @markAllRead="onMarkAllRead"
              @open="onNotificationOpen"
              @viewAll="onNotificationViewAll"
            />
            <p class="dev-ui__meta-line" v-if="notificationLog">{{ notificationLog }}</p>
          </div>
          <div>
            <h3 class="dev-ui__h3">пустой</h3>
            <NotificationCenter :notifications="[]" />
          </div>
          <div>
            <h3 class="dev-ui__h3">загрузка</h3>
            <NotificationCenter :notifications="[]" :loading="true" />
          </div>
        </div>
      </div>
    </section>

    <!-- ============ 37 COMMAND PALETTE (E11.2) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">37</span>
        <h2 class="dev-ui__sect-title">Палитра команд (CommandPalette)</h2>
        <p class="dev-ui__sect-sub">
          ⌘K / Ctrl+K. Иерархия <strong>рабочих столов</strong> и их страниц.
          Активный стол sticky сверху с бейджем «Активный». Пустой запрос — иерархия,
          с запросом — плоский список (со столом-префиксом у каждой страницы).
          Стол отдельной строкой появляется только если запрос явно начинается
          с его имени или содержит «стол»/«workspace».
        </p>
      </div>
      <div class="dev-ui__stage">
        <button type="button" class="dev-ui__btn" @click="commandPaletteOpen = true">
          Открыть палитру (рабочие столы и страницы)
        </button>
        <p class="dev-ui__meta-line" v-if="commandLog">{{ commandLog }}</p>
        <CommandPalette
          v-model="commandPaletteOpen"
          :workspaces="commandWorkspacesDemo"
          @select-workspace="onSelectWorkspace"
          @select-page="onSelectPage"
        />
      </div>
    </section>

    <!-- ============ 38 DETAILS DRAWER (E11.3) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">38</span>
        <h2 class="dev-ui__sect-title">Side-sheet детализации (DetailsDrawer)</h2>
        <p class="dev-ui__sect-sub">
          Боковая панель справа 480px для quick-view документа/договора/пайщика.
          Slots: <code>default</code> + <code>actions</code> в шапке + <code>footer</code>.
          На xs — fullscreen.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="dev-ui__drawer-controls">
          <button type="button" class="dev-ui__btn" @click="drawerOpen = true">
            Открыть DetailsDrawer
          </button>
          <button type="button" class="dev-ui__btn" @click="drawerWideOpen = true">
            Открыть широкий (640px)
          </button>
        </div>

        <DetailsDrawer
          v-model="drawerOpen"
          title="Договор пая № 0001"
        >
          <template #actions>
            <button type="button" class="dev-ui__btn dev-ui__btn--ghost">Скачать</button>
          </template>
          <DataRow label="Подписан" value="12 мая 2026" />
          <DataRow label="Сумма пая" value="50 000,00 RUB" />
          <DataRow label="Статус" value="Действует" />
          <p style="margin-top: 16px; color: var(--p-ink-2);">
            Содержимое drawer'а скроллится при переполнении. Закрывается Esc,
            кликом по backdrop или крестиком в шапке.
          </p>
          <template #footer>
            <button type="button" class="dev-ui__btn">Перейти к договору</button>
          </template>
        </DetailsDrawer>

        <DetailsDrawer
          v-model="drawerWideOpen"
          title="Реестр пайщика"
          :width="640"
        >
          <p>Drawer с увеличенной шириной — для длинных таблиц/реестров.</p>
        </DetailsDrawer>
      </div>
    </section>

    <!-- ============ 39 TOASTS (E11.x) ============ -->
    <section class="dev-ui__sect">
      <div class="dev-ui__sect-head">
        <span class="dev-ui__sect-num">39</span>
        <h2 class="dev-ui__sect-title">Тосты (Notify)</h2>
        <p class="dev-ui__sect-sub">
          Системный feedback в правом нижнем углу: успех / ошибка / информация
          / in-app push. Тёмный фон, цветная иконка по типу. API в
          <code>src/shared/api/alerts.ts</code>, визуал — в
          <code>quasar-canon.css</code>.
        </p>
      </div>
      <div class="dev-ui__stage">
        <div class="u-row u-row--wrap u-row--gap-4">
          <BaseButton variant="primary" @click="showSuccessToast">Успех</BaseButton>
          <BaseButton variant="secondary" @click="showSuccessWithActionToast">Успех с действием</BaseButton>
          <BaseButton variant="danger" @click="showFailToast">Ошибка</BaseButton>
          <BaseButton variant="ghost" @click="showNotifyToast">In-app push</BaseButton>
          <BaseButton variant="ghost" @click="showNotifyWithAvatarToast">In-app push с аватаром</BaseButton>
        </div>
      </div>
    </section>

  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { Dark } from 'quasar';
import { AppDrawer } from 'src/shared/ui/layout/AppDrawer';
import { AppHeader } from 'src/shared/ui/layout/AppHeader';
import { PageHead } from 'src/shared/ui/layout/PageHead';
import { PageTabs } from 'src/shared/ui/layout/PageTabs';
import { RailUserCard } from 'src/shared/ui/domain/RailUserCard';
import { WalletCard } from 'src/shared/ui/domain/WalletCard';
import { WalletCardMini } from 'src/widgets/wallet-card-mini';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { AmountInput } from 'src/shared/ui/domain/AmountInput';
import { OtpInput } from 'src/shared/ui/domain/OtpInput';
import { FilterBar } from 'src/shared/ui/domain/FilterBar';
import { FileUploader } from 'src/shared/ui/domain/FileUploader';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import { NotificationCenter } from 'src/shared/ui/domain/NotificationCenter';
import { CommandPalette } from 'src/shared/ui/domain/CommandPalette';
import { DetailsDrawer } from 'src/shared/ui/domain/DetailsDrawer';
import { SuccessAlert, FailAlert, NotifyAlert } from 'src/shared/api';
import { LostKey } from 'src/widgets/Registrator/LostKey';
import { ResetKeyForm } from 'src/widgets/Registrator/ResetKey';
import { useCreateUser } from 'src/features/User/CreateUser';
import type { RailItem, RailSection } from 'src/shared/ui/layout/AppDrawer';
import type { PageTab } from 'src/shared/ui/layout/PageTabs';
import type { IGeneratedAccount } from 'src/shared/lib/types/user';
import type { ContactItem } from 'src/shared/ui/domain/ContactSheet';
import type { Identity } from 'src/shared/ui/domain/IdentityPanel';
import type { Person } from 'src/shared/ui/domain/PersonCard';
import type { DocumentRowDoc } from 'src/shared/ui/domain/DocumentRow';
import type { Signature } from 'src/shared/ui/domain/SignatureCard';
import type { ActivityEvent } from 'src/shared/ui/domain/ActivityTimeline';
import type { DocumentPreviewDoc } from 'src/shared/ui/domain/DocumentPreview';
import type { FilterDefinition, FilterValues } from 'src/shared/ui/domain/FilterBar';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import type { NotificationItem } from 'src/shared/ui/domain/NotificationCenter';
import type { CommandPaletteWorkspace } from 'src/shared/ui/domain/CommandPalette';

/* === Token palette ============================================================
   Подмножество --p-* токенов, формирующих визуальную идентичность.
   Меняем через input[type=color] → setProperty на documentElement —
   inline-style на :root перебивает все CSS-правила, мгновенный отклик. */
interface TokenDef {
  key: string;
  label: string;
  type: 'color' | 'rgba';
}
interface TokenGroup {
  title: string;
  items: TokenDef[];
}
const tokenGroups: TokenGroup[] = [
  {
    title: 'Основной цвет',
    items: [
      { key: '--p-primary', label: 'Primary', type: 'color' },
      { key: '--p-primary-hover', label: 'Primary · hover', type: 'color' },
      { key: '--p-primary-press', label: 'Primary · press', type: 'color' },
    ],
  },
  {
    title: 'Поверхности',
    items: [
      { key: '--p-canvas', label: 'Canvas (фон страницы)', type: 'color' },
      { key: '--p-canvas-2', label: 'Canvas-2', type: 'color' },
      { key: '--p-surface', label: 'Surface (карточки)', type: 'color' },
      { key: '--p-surface-2', label: 'Surface-2', type: 'color' },
      { key: '--p-surface-3', label: 'Surface-3', type: 'color' },
    ],
  },
  {
    title: 'Текст',
    items: [
      { key: '--p-ink', label: 'Ink (основной)', type: 'color' },
      { key: '--p-ink-on-primary', label: 'Ink · on-primary', type: 'color' },
    ],
  },
  {
    title: 'Линии',
    items: [
      { key: '--p-line', label: 'Line (тонкая)', type: 'rgba' },
      { key: '--p-line-1', label: 'Line-1', type: 'rgba' },
      { key: '--p-line-2', label: 'Line-2', type: 'rgba' },
    ],
  },
  {
    title: 'Статусы',
    items: [
      { key: '--p-pos', label: 'Positive', type: 'color' },
      { key: '--p-neg', label: 'Negative', type: 'color' },
      { key: '--p-warn', label: 'Warning', type: 'color' },
      { key: '--p-info', label: 'Info', type: 'color' },
    ],
  },
  {
    title: 'Программные тинты',
    items: [
      { key: '--prog-blagorost', label: 'Blagorost', type: 'color' },
      { key: '--prog-wallet', label: 'Wallet', type: 'color' },
      { key: '--prog-generator', label: 'Generator', type: 'color' },
    ],
  },
];

const resolvedValues = reactive<Record<string, string>>({});
const hexValues = reactive<Record<string, string>>({});
const overridden = reactive<Record<string, boolean>>({});

function readTokens(): void {
  if (typeof document === 'undefined') return;
  const styles = getComputedStyle(document.documentElement);
  const inlineKeys = new Set<string>();
  for (let i = 0; i < document.documentElement.style.length; i++) {
    const k = document.documentElement.style.item(i);
    if (k.startsWith('--p-') || k.startsWith('--prog-')) inlineKeys.add(k);
  }
  for (const g of tokenGroups) {
    for (const t of g.items) {
      const val = styles.getPropertyValue(t.key).trim();
      resolvedValues[t.key] = val;
      if (t.type === 'color') hexValues[t.key] = toHex(val);
      overridden[t.key] = inlineKeys.has(t.key);
    }
  }
}

function toHex(value: string): string {
  if (!value) return '#000000';
  if (value.startsWith('#')) {
    if (value.length === 4) {
      // #abc → #aabbcc
      return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
    }
    return value.slice(0, 7).toLowerCase();
  }
  const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((n) => parseInt(n, 10).toString(16).padStart(2, '0'));
    return `#${r}${g}${b}`;
  }
  return '#000000';
}

function onColorChange(key: string, hex: string): void {
  document.documentElement.style.setProperty(key, hex);
  hexValues[key] = hex;
  resolvedValues[key] = hex;
  overridden[key] = true;
}

function onTextChange(key: string, value: string): void {
  document.documentElement.style.setProperty(key, value);
  resolvedValues[key] = value;
  overridden[key] = true;
}

function resetTokens(): void {
  for (const g of tokenGroups) {
    for (const t of g.items) {
      document.documentElement.style.removeProperty(t.key);
    }
  }
  readTokens();
}

const themeName = computed(() => (Dark.isActive ? 'тёмная' : 'светлая'));
const overriddenCount = computed(() => Object.values(overridden).filter(Boolean).length);

let themeWatcher: (() => void) | null = null;
onMounted(() => {
  readTokens();
  themeWatcher = watch(() => Dark.isActive, () => readTokens());
});
onUnmounted(() => {
  themeWatcher?.();
});

const inputText = ref('chairman.voskhod@gmail.com');
const inputMono = ref('ant');
const inputAmount = ref('1 000');
const inputError = ref('');

const paymentOptions = [
  { value: 'card', label: 'Банковская карта (СБП)' },
  { value: 'account', label: 'По реквизитам счёта' },
  { value: 'wallet', label: 'Списать с кошелька' },
];
const selectMethod = ref<string | number>('');

const periodOptions = [
  { value: 'last-7', label: 'Последние 7 дней' },
  { value: 'this-month', label: 'Текущий месяц' },
  { value: 'apr-2026', label: 'Апрель 2026' },
  { value: 'mar-2026', label: 'Март 2026' },
];
const selectPeriod = ref<string | number>('apr-2026');

const dialogOpen = ref(false);
const dialogAmount = ref('1 000');

const formEmail = ref('');
const formPass = ref('');
const formLoading = ref(false);
const formError = ref('');
function onFormSubmit(): void {
  formError.value = '';
  formLoading.value = true;
  setTimeout(() => {
    formLoading.value = false;
    formError.value = 'Неверный e-mail или пароль (демо-валидация).';
  }, 800);
}

interface TableRow {
  id: string;
  doc: string;
  date: string;
  amount: string;
  status: 'pos' | 'warn' | 'neg';
}
const tableColumns = [
  { key: 'doc', label: 'Документ' },
  { key: 'date', label: 'Дата' },
  { key: 'amount', label: 'Сумма', numeric: true },
  { key: 'status', label: 'Статус' },
] as const;
const tableRows: TableRow[] = [
  { id: '1', doc: 'Заявление на возврат паевого взноса', date: '12.04.2026', amount: '1 200,00', status: 'pos' },
  { id: '2', doc: 'Решение совета №14', date: '08.04.2026', amount: '— — —', status: 'warn' },
  { id: '3', doc: 'Договор участия в ЦПП «Благорост»', date: '02.04.2026', amount: '750,00', status: 'neg' },
];
function statusLabel(s: string): string {
  return { pos: 'Завершён', warn: 'Ожидает подписи', neg: 'Отклонён' }[s] ?? s;
}

const railItems: Array<RailItem | RailSection> = [
  {
    section: 'Раздел',
    items: [
      { key: 'wallet', label: 'Кошелёк', icon: 'account_balance_wallet' },
      { key: 'id', label: 'Удостоверение', icon: 'badge' },
      { key: 'requisites', label: 'Реквизиты', icon: 'link' },
      { key: 'docs', label: 'Документы', icon: 'description', badge: 12 },
      { key: 'pay', label: 'Платежи', icon: 'payments' },
      { key: 'meetings', label: 'Собрания', icon: 'groups' },
      { key: 'contacts', label: 'Контакты', icon: 'contacts' },
      { key: 'support', label: 'Поддержка', icon: 'support_agent' },
    ],
  },
];
const railActive = ref('wallet');

const walletTabs: PageTab[] = [
  { key: 'wallets', label: 'Кошельки', count: 3 },
  { key: 'payments', label: 'Платежи', count: 28 },
  { key: 'methods', label: 'Способы получения' },
  { key: 'plan', label: 'План платежей' },
];
const walletTab = ref('wallets');

const projectTabs: PageTab[] = [
  { key: 'desc', label: 'Описание' },
  { key: 'shares', label: 'Взносы', count: 14 },
  { key: 'members', label: 'Члены', count: 42 },
  { key: 'docs', label: 'Документы', count: 12 },
  { key: 'meetings', label: 'Собрания' },
  { key: 'decisions', label: 'Решения' },
  { key: 'history', label: 'История' },
  { key: 'settings', label: 'Настройки' },
];
const projectTab = ref('shares');

const frameItems: Array<RailItem | RailSection> = [
  {
    section: 'Раздел',
    items: [
      { key: 'wallet', label: 'Кошелёк', icon: 'account_balance_wallet' },
      { key: 'id', label: 'Удостоверение', icon: 'badge' },
      { key: 'docs', label: 'Документы', icon: 'description', badge: 12 },
      { key: 'pay', label: 'Платежи', icon: 'payments' },
    ],
  },
];
const frameActive = ref('wallet');

const railUserCollapsed = ref(false);
const frameUserCollapsed = ref(false);

function onMenuToggle(): void {
  // dev-витрина — реальный toggle живёт на странице приложения
}
function onTopUp(): void {
  // dev-витрина — открытие диалога пополнения уходит на страницу-коннектор
}
function onSignout(): void {
  // dev-витрина — реальный signout (router.push + auth.logout) на странице
}
function onBalanceClick(): void {
  // dev-витрина — на проде это router.push на страницу кошелька
}

/* ============ ResetKey flow (E7) ============ */
// На проде ключ генерируется при заходе по email-ссылке внутри ResetKey
// widget. В витрине просто разово генерируем для демонстрации.
const rkLoading = ref(false);
const rkMockAccount = ref<IGeneratedAccount | null>(useCreateUser().generateAccount());

async function onRkMockSubmit(): Promise<void> {
  rkLoading.value = true;
  await new Promise((r) => setTimeout(r, 600));
  rkLoading.value = false;
  // На проде — router.push({ name: 'signin' }); тут просто регенерируем мок.
  rkMockAccount.value = useCreateUser().generateAccount();
}

/* ============ IdentityPanel demo (E8.1) ============ */
const identityFullDemo: Identity = {
  fullName: 'Иванов Иван Иванович',
  email: 'ivanov@example.ru',
  accountName: 'ivanov12345',
  status: 'active',
  role: 'Председатель',
};
const identityPendingDemo: Identity = {
  fullName: 'Сидорова Анна Петровна',
  email: 'sidorova@example.ru',
  accountName: 'sidorovaaaa',
  status: 'pending',
  role: 'Пайщик',
};
const identityBlockedDemo: Identity = {
  fullName: 'Петров Пётр',
  accountName: 'petrov54321',
  status: 'blocked',
};
const identityCompactDemo: Identity = {
  fullName: 'Соколов Алексей',
  accountName: 'sokolov11111',
  status: 'active',
};

/* ============ E9 demo data ============ */
const docDraftDemo: DocumentRowDoc = {
  type: 'docx',
  title: 'Заявление о вступлении в кооператив',
  status: 'draft',
  date: '15 мая 2026',
  author: 'Иванов И. И.',
};
const docSignedDemo: DocumentRowDoc = {
  type: 'pdf',
  title: 'Устав кооператива (редакция 3)',
  status: 'signed',
  date: '12 марта 2026',
  description: 'Подписан 12 членами совета',
};
const docPendingDemo: DocumentRowDoc = {
  type: 'html',
  title: 'Решение об утверждении программы «Благорост»',
  status: 'pending',
  date: '20 мая 2026',
};
const docRejectedDemo: DocumentRowDoc = {
  type: 'docx',
  title: 'Заявление о выходе из кооператива',
  status: 'rejected',
  date: '18 мая 2026',
  author: 'Петров П.',
};

const signatureSignedDemo: Signature = {
  status: 'signed',
  signer: { fullName: 'Иванов Иван Иванович', accountName: 'ivanov12345' },
  signedAt: '21 мая 2026, 14:32',
  hash: 'SIG_K1_KdNm8YzfxgkLRgZSdt9xZB6FBVvJ7tQXrqzPDS6m1HtR2WJaXLs9xUgEcLuJqW5Ts9hfXjcWf7Q4kVUj8Q4kvVPbm3TmgN',
};
const signaturePendingDemo: Signature = {
  status: 'pending',
  signer: { fullName: 'Сидорова Анна Петровна', accountName: 'sidorovaaaa' },
};
const signatureRejectedDemo: Signature = {
  status: 'rejected',
  signer: { fullName: 'Петров Пётр', accountName: 'petrov54321' },
  signedAt: '20 мая 2026, 09:14',
  rejectionReason: 'Сумма паевого взноса не соответствует положениям программы.',
};

const timelineDemo: ActivityEvent[] = [
  {
    id: '1',
    type: 'create',
    title: 'Проект создан',
    description: 'Инициирована программа «Благорост — Восход 2026»',
    actor: 'Иванов И. И.',
    date: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'sign',
    title: 'Подписано председателем',
    description: 'Устав программы утверждён общим собранием',
    actor: 'Иванов И. И.',
    date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    type: 'comment',
    title: 'Комментарий пайщика',
    description: '«Нужно уточнить пункт 4.2 о порядке возврата взносов»',
    actor: 'Сидорова А. П.',
    date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    type: 'update',
    title: 'Внесены правки',
    description: 'Пункт 4.2 переработан',
    actor: 'Иванов И. И.',
    date: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    type: 'transfer',
    title: 'Зачислен паевой взнос',
    description: '15 000 ₽ · ivanov12345 → программа «Благорост»',
    date: new Date('2026-05-12T11:20:00').toISOString(),
  },
];

const previewHtmlDemo: DocumentPreviewDoc = {
  type: 'html',
  html: `
    <h2 style="text-align:center">Устав кооператива «Восход»</h2>
    <p><strong>1. Общие положения.</strong> Потребительский кооператив «Восход» — добровольное объединение пайщиков на основе совместного хозяйствования.</p>
    <p><strong>2. Цели.</strong> Удовлетворение материальных и иных потребностей пайщиков.</p>
    <table>
      <tr><th>Параметр</th><th>Значение</th></tr>
      <tr><td>Минимальный пай</td><td>1 000 ₽</td></tr>
      <tr><td>Возврат</td><td>По положениям Программы</td></tr>
    </table>
  `,
};

const docSignaturesDemo = {
  docHash: '116929C059A3A6E2F44AEA38B4B64F72E9525EA54E49D4444D69DC7EE60706ED',
  regeneratedHash: '116929C059A3A6E2F44AEA38B4B64F72E9525EA54E49D4444D69DC7EE60706ED',
  signatures: [
    {
      signerName: 'Иванов Иван Иванович',
      publicKey: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
      signature: 'SIG_K1_KgjUKhXYXarx9aQMrN54umSWyeWBqw82h59a8AYgHiqRCS1p9N9SkB2b6bBME61PaRWsc7HDMNCf4TE2voTM9DNA2cPznG',
      isValid: true,
    },
  ],
};
const docSignaturesInvalidDemo = {
  docHash: '116929C059A3A6E2F44AEA38B4B64F72E9525EA54E49D4444D69DC7EE60706ED',
  regeneratedHash: '000000000000000000000000000000000000000000000000000000000000DEAD',
  signatures: [
    {
      signerName: 'Иванов Иван Иванович',
      publicKey: 'PUB_K1_6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5BoDq63',
      signature: 'SIG_K1_KgjUKhXYXarx9aQMrN54umSWyeWBqw82h59a8AYgHiqRCS1p9N9SkB2b6bBME61PaRWsc7HDMNCf4TE2voTM9DNA2cPznG',
      isValid: true,
    },
    {
      signerName: 'Петров Пётр',
      publicKey: 'PUB_K1_aXyZ123456789aXyZ123456789aXyZ123456789aXyZ123456789aaaa',
      signature: 'SIG_K1_brokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      isValid: false,
    },
  ],
};

/* ============ PersonCard demo (E8.4) ============ */
const personFullDemo: Person = {
  fullName: 'Иванов Иван Иванович',
  role: 'Председатель совета',
  accountName: 'ivanov12345',
  contacts: [
    { type: 'email', value: 'ivanov@example.ru', verified: true },
    { type: 'phone', value: '+7 (903) 123-45-67' },
    { type: 'tg', value: '@ivanov' },
  ],
};
const personShortDemo: Person = {
  fullName: 'Сидорова Анна Петровна',
  role: 'Пайщик',
  accountName: 'sidorovaaaa',
  contacts: [
    { type: 'email', value: 'sidorova@example.ru' },
  ],
};
const personMinDemo: Person = {
  fullName: 'Соколов А.',
};

/* ============ ContactSheet demo (E8.2) ============ */
const contactsDemo: ContactItem[] = [
  { type: 'email', value: 'ivanov@example.ru', verified: true },
  { type: 'phone', value: '+7 (903) 123-45-67' },
  { type: 'tg', value: '@ivanov' },
  { type: 'address', value: 'г. Москва, ул. Ленина, д. 1, кв. 23' },
  { type: 'web', value: 'coopenomics.world', label: 'Сайт кооператива' },
];

/* ============ AmountInput demo (E10.1) ============ */
const amountDemo = ref<number | null>(null);
const amountMaxDemo = ref<number | null>(null);

/* ============ OtpInput demo (E10.2) ============ */
const otpDemo = ref<string>('');
const otpErrorDemo = ref<string>('1234');

/* ============ FilterBar demo (E10.3) ============ */
const filterSearchDemo = ref<string>('');
const filterValuesDemo = ref<FilterValues>({ status: 'active', type: 'individual' });
const filterDefsDemo: FilterDefinition[] = [
  {
    key: 'status',
    label: 'Статус',
    type: 'select',
    options: [
      { label: 'Активные', value: 'active' },
      { label: 'Заблокированные', value: 'blocked' },
      { label: 'Ожидают подтверждения', value: 'pending' },
    ],
  },
  {
    key: 'type',
    label: 'Тип субъекта',
    type: 'select',
    options: [
      { label: 'Физическое лицо', value: 'individual' },
      { label: 'Организация', value: 'organization' },
      { label: 'ИП', value: 'entrepreneur' },
    ],
  },
  {
    key: 'region',
    label: 'Регион',
    type: 'select',
    options: [
      { label: 'Москва', value: 'msk' },
      { label: 'Санкт-Петербург', value: 'spb' },
      { label: 'Новосибирск', value: 'nsk' },
    ],
  },
];

/* ============ FileUploader demo (E10.4) ============ */
const singleFileDemo = ref<File | null>(null);
const multiFilesDemo = ref<File[]>([]);
const uploadErrorDemo = ref<string>('');

/* ============ VerticalStepper demo (E10.5) ============ */
const stepperStepsDemo: StepperStep[] = [
  { key: 'phone', label: 'Подтверждение телефона', description: 'Получите код по SMS и введите его' },
  { key: 'identity', label: 'Личные данные', description: 'ФИО, паспортные данные' },
  { key: 'keys', label: 'Создание ключей', description: 'Сохраните мастер-ключ в безопасном месте' },
  { key: 'review', label: 'Проверка и подача заявления', description: 'Финальный шаг' },
];
const stepperActiveDemo = ref<string>('keys');
const stepperCompletedDemo = ref<string[]>(['phone', 'identity']);

const stepperWithErrorSteps: StepperStep[] = [
  { key: 'main', label: 'Основное' },
  { key: 'participants', label: 'Участники', optional: true },
  { key: 'payment', label: 'Оплата паевого взноса', description: 'Не удалось провести транзакцию — попробуйте ещё раз' },
  { key: 'confirm', label: 'Подтверждение', disabled: true },
];

/* ============ NotificationCenter demo (E11.1) ============ */
const now = Date.now();
const notificationsDemo = ref<NotificationItem[]>([
  { id: 'n1', category: 'system', title: 'Обновление ключей', description: 'Ваш мастер-ключ был обновлён 10 минут назад', date: new Date(now - 10 * 60_000), read: false },
  { id: 'n2', category: 'system', title: 'Новый IP-адрес входа', description: 'Авторизация с устройства MacBook (Москва)', date: new Date(now - 3 * 3600_000), read: true },
  { id: 'n3', category: 'financial', title: 'Поступление паевого взноса', description: '50 000 RUB зачислено на ваш кошелёк', date: new Date(now - 30 * 60_000), read: false },
  { id: 'n4', category: 'voting', title: 'Голосование по проекту «Электрозарядка»', description: 'Открыто голосование, осталось 2 дня', date: new Date(now - 86400_000), read: false },
  { id: 'n5', category: 'message', title: 'Сообщение от Председателя', description: 'Прошу ознакомиться с повесткой ОАП', date: new Date(now - 2 * 86400_000), read: true },
]);
const notificationLog = ref<string>('');
function onMarkAllRead(): void {
  notificationsDemo.value = notificationsDemo.value.map((n) => ({ ...n, read: true }));
  notificationLog.value = 'Все уведомления помечены прочитанными';
}
function onNotificationOpen(id: string): void {
  notificationLog.value = `Открыто уведомление ${id}`;
}
function onNotificationViewAll(): void {
  notificationLog.value = 'Переход на /notifications';
}

/* ============ CommandPalette demo (E11.2) ============ */
const commandPaletteOpen = ref<boolean>(false);
const commandLog = ref<string>('');
const commandWorkspacesDemo: CommandPaletteWorkspace[] = [
  {
    name: 'chairman',
    title: 'Стол Председателя',
    icon: 'person',
    isActive: true,
    pages: [
      { name: 'chairman-onboarding', title: 'Онбординг', icon: 'rocket_launch' },
      { name: 'chairman-approvals', title: 'Запросы одобрений', icon: 'check_circle' },
      { name: 'chairman-marketplace', title: 'Магазин приложений', icon: 'extension' },
      { name: 'chairman-startpages', title: 'Стартовые страницы', icon: 'home' },
      { name: 'chairman-council', title: 'Члены совета', icon: 'groups' },
      { name: 'chairman-areas', title: 'Кооперативные участки', icon: 'layers' },
      { name: 'chairman-fees', title: 'Регистрационные взносы', icon: 'payments' },
      { name: 'chairman-key', title: 'Ключ кооператива', icon: 'vpn_key' },
    ],
  },
  {
    name: 'member',
    title: 'Стол пайщика',
    icon: 'account_circle',
    pages: [
      { name: 'member-dashboard', title: 'Главная', icon: 'home' },
      { name: 'member-wallet', title: 'Кошелёк', icon: 'account_balance_wallet', shortcut: '⌘W' },
      { name: 'member-projects', title: 'Проекты Благорост', icon: 'rocket_launch' },
      { name: 'member-voting', title: 'Голосования', icon: 'how_to_vote' },
      { name: 'member-documents', title: 'Мои документы', icon: 'description' },
    ],
  },
  {
    name: 'reports',
    title: 'Стол отчётности',
    icon: 'analytics',
    pages: [
      { name: 'reports-kpi', title: 'KPI кооператива', icon: 'insights' },
      { name: 'reports-export', title: 'Выгрузка реестров', icon: 'download' },
    ],
  },
];
function onSelectWorkspace(name: string): void {
  commandLog.value = `Переход на рабочий стол: ${name}`;
}
function onSelectPage(workspaceName: string, pageName: string): void {
  commandLog.value = `Открыта страница ${pageName} (стол ${workspaceName})`;
}

/* ============ DetailsDrawer demo (E11.3) ============ */
const drawerOpen = ref<boolean>(false);
const drawerWideOpen = ref<boolean>(false);

// ---- Toasts (E11.x) ----
function showSuccessToast(): void {
  SuccessAlert('Паевой взнос зарегистрирован');
}
function showSuccessWithActionToast(): void {
  SuccessAlert('Документ 3498EA4A05 добавлен в реестр', {
    text: 'Открыть',
    handler: () => {
      /* no-op demo */
    },
  });
}
function showFailToast(): void {
  FailAlert(
    new Error('Подпись отклонена нодой'),
    'Не удалось проверить подпись',
  );
}
function showNotifyToast(): void {
  NotifyAlert('Заявление отправлено в совет', 'Ожидается 2 из 5 подписей');
}
function showNotifyWithAvatarToast(): void {
  NotifyAlert(
    'Новое сообщение',
    'Председатель подписал ваш документ',
    'https://api.dicebear.com/9.x/initials/svg?seed=PR',
  );
}
</script>

<style scoped>
.dev-ui {
  min-height: 100vh;
  background: var(--p-canvas);
  color: var(--p-ink-1);
  padding: 48px 32px 96px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: var(--p-sans, 'Inter', system-ui);
  display: flex;
  flex-direction: column;
  gap: 48px;
}

.dev-ui__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--p-line);
}
.dev-ui__title {
  font-size: var(--p-fs-display);
  line-height: var(--p-lh-display);
  letter-spacing: var(--p-ls-display);
  font-weight: 600;
  margin: 4px 0 8px;
}

.dev-ui__sect {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.dev-ui__sect-head {
  display: grid;
  grid-template-columns: 36px 1fr;
  grid-template-rows: auto auto;
  column-gap: 12px;
  align-items: baseline;
}
.dev-ui__sect-num {
  grid-row: 1 / span 2;
  font-family: var(--p-mono);
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
  letter-spacing: 0.08em;
  padding-top: 4px;
}
.dev-ui__sect-title {
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  margin: 0;
}
.dev-ui__sect-sub {
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
  margin: 0;
  max-width: 720px;
}

.dev-ui__stage {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  padding: 24px;
}

.dev-ui__data-stack {
  display: flex;
  flex-direction: column;
  max-width: 560px;
}

.dev-ui__person-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--p-4, 16px);
  max-width: 880px;
}

.dev-ui__person-compact-list {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}

.dev-ui__preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--p-4, 16px);
}

.dev-ui__doc-sig-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--p-4, 16px);
}

.dev-ui__form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--p-4, 16px);
  align-items: start;
}

.dev-ui__otp-stack {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}

.dev-ui__stepper-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--p-6, 24px);
  align-items: start;
}

.dev-ui__notification-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, max-content));
  gap: var(--p-6, 24px);
  align-items: start;
}

.dev-ui__drawer-controls {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-bottom: var(--p-4, 16px);
}

.dev-ui__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: 0 var(--p-4, 16px);
  height: 36px;
  border: 1px solid var(--p-primary);
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-primary);
  color: var(--p-ink-on-primary, #fff);
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.dev-ui__btn:hover {
  background: var(--p-primary-hover, var(--p-primary));
}
.dev-ui__btn--ghost {
  background: transparent;
  color: var(--p-primary);
}
.dev-ui__btn--ghost:hover {
  background: var(--p-primary-soft);
}

.dev-ui__meta-line {
  margin-top: var(--p-3, 12px);
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}
.dev-ui__meta-line--neg {
  color: var(--p-neg);
}

code {
  font-family: var(--p-mono);
  font-size: 0.92em;
  background: var(--p-surface-2);
  padding: 1px 6px;
  border-radius: var(--p-r-xs);
  color: var(--p-ink);
}

/* ===== Layout demos ===== */
.dev-ui__rail-demo {
  display: grid;
  grid-template-columns: var(--p-rail-w, 248px) 1fr;
  min-height: 460px;
  border-radius: var(--p-r-md);
  overflow: hidden;
}
.dev-ui__rail-stub {
  background: var(--p-canvas);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dev-ui__notifs {
  position: relative;
}
.dev-ui__notifs-dot {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-neg);
}

.dev-ui__appframe {
  display: grid;
  grid-template-columns: var(--p-rail-w, 248px) 1fr;
  min-height: 520px;
  border-radius: var(--p-r-md);
  overflow: hidden;
}
.dev-ui__appframe-content {
  background: var(--p-canvas);
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.dev-ui__appframe-body {
  padding: 24px 28px;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== Token palette ===== */
.dev-ui__token-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--p-line);
}
.dev-ui__token-group-title {
  font-size: var(--p-fs-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  color: var(--p-ink-3);
  font-weight: 500;
  margin: 16px 0 8px;
}
.dev-ui__token-group-title:first-child {
  margin-top: 0;
}
.dev-ui__tokens {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.dev-ui__token {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  background: var(--p-surface);
  cursor: pointer;
  transition: border-color var(--p-dur-fast) ease;
}
.dev-ui__token:hover {
  border-color: var(--p-line-2);
}
.dev-ui__token--overridden {
  border-color: var(--p-primary-line);
  background: var(--p-primary-soft);
}
.dev-ui__token-swatch {
  width: 32px;
  height: 32px;
  border-radius: var(--p-r-xs);
  border: 1px solid var(--p-line-1);
  flex-shrink: 0;
}
.dev-ui__token-meta {
  min-width: 0;
  line-height: 1.2;
}
.dev-ui__token-name {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dev-ui__token-key {
  font-size: 11px;
  color: var(--p-ink-3);
  font-family: var(--p-mono);
}
.dev-ui__token-picker {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-xs);
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
.dev-ui__token-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}
.dev-ui__token-picker::-webkit-color-swatch {
  border: 0;
  border-radius: 4px;
}
.dev-ui__token-text {
  width: 140px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-xs);
  background: var(--p-surface);
  color: var(--p-ink);
  font: 11px/1.4 var(--p-mono);
  outline: none;
}
.dev-ui__token-text:focus {
  border-color: var(--p-primary);
}

.dev-ui__h3 {
  font-size: var(--p-fs-h3, 14px);
  line-height: 1.3;
  letter-spacing: 0.02em;
  font-weight: 600;
  color: var(--p-ink-2);
  margin: 0 0 12px;
  text-transform: uppercase;
}
.dev-ui__grid {
  display: grid;
  gap: 12px;
}
.dev-ui__grid--2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.dev-ui__grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
@media (max-width: 900px) {
  .dev-ui__grid--2,
  .dev-ui__grid--3 {
    grid-template-columns: 1fr;
  }
}

/* ResetKey flow — три кадра подряд, каждый с подписью-шага */
.rk-dev__stage {
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.rk-dev__frame {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rk-dev__caption {
  font-size: var(--p-fs-meta, 12px);
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--p-ink-3);
}
</style>
