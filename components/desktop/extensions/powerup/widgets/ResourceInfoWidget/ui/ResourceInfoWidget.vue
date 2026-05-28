<template lang="pug">
.resource-info-card
  .resource-info-card__head
    .resource-info-card__icon
      q-icon(name="help_outline", size="20px")
    .resource-info-card__title Как это работает

  .resource-info-card__body
    p.resource-info-card__lead
      | Вычислительные ресурсы арендуются на 24 часа у делегатов блокчейн-платформы. Минимальная квота — 5 AXON в сутки.
    p.resource-info-card__text
      | Когда использование любого ресурса превышает 70% от доступной квоты, система автоматически арендует
      | дополнительную квоту за 5 AXON из вашего баланса.

  BaseButton.resource-info-card__action(variant="secondary", size="sm", @click="showHowItWorksDialog = true")
    template(#icon-left)
      q-icon(name="menu_book", size="16px")
    | Подробнее о системе ресурсов

  //- Диалог "Как это работает"
  q-dialog(v-model="showHowItWorksDialog")
    ModalBase(title="Как работает система ресурсов", :style="dialogStyle")
      .q-pa-md
        .how-it-works-content
          .intro-section.q-mb-lg
            .text-h6.q-mb-md Что такое вычислительные ресурсы
            p.text-body1
              | Для работы вашего кооператива в системе COOPOS требуются вычислительные ресурсы реальных серверов. Каждая операция —
              | регистрация пайщика, обработка заявления, проведение собрания совета — использует три типа ресурсов:
            ul.q-mt-sm
              li <b>RAM (оперативная память)</b> — для хранения анонимизированных данных пайщиков и документов в смарт-контрактах
              li <b>CPU (время работы процессора)</b> — для выполнения вычислений при обработке документов
              li <b>NET (трафик передаваемый по сети)</b> — для передачи данных между узлами блокчейна

          .resources-section.q-mb-lg
            .text-h6.q-mb-md Система квот: аренда ресурсов
            .resource-explanation
              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 📦 Что такое квота
                p
                  | <b>1 квота = 5 AXON</b> — это пакет вычислительных ресурсов на 24 часа. Квота включает:
                  br
                  | • 2.5 AXON на RAM (~25 000 байт или ~24.4 КБ) — для хранения данных
                  br
                  | • 1.25 AXON на CPU — для вычислений
                  br
                  | • 1.25 AXON на NET — для передачи данных

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 📄 Пакеты документов
                p
                  | Все операции в системе оформляются пакетами документов (заявление, протокол совета, решение и т.д.).
                  | Один пакет документов в среднем занимает ~10 КБ оперативной памяти. Значит, одна квота (24.4 КБ RAM)
                  | позволяет одновременно хранить 2 полных пакета документов с небольшим запасом.

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 🔄 Многократное использование
                p
                  | Одну квоту можно использовать многократно в течение 24 часов. После завершения обработки
                  | документа оперативная память освобождается, и вы можете обработать новый пакет документов, используя
                  | ту же квоту. Квота ограничивает <b>одновременное</b> использование ресурсов, а не общее количество
                  | операций за сутки.

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm ⏰ Возврат и продление аренды
                p
                  | Через 24 часа квота возвращается в тот час, когда была арендована. Если на момент возврата
                  | в оперативной памяти всё ещё хранятся активные данные (например, не принятые решения),
                  | система автоматически продлевает аренду этого объема на следующие сутки при наличии достаточного количества AXON на балансе.

          .delegates-section.q-mb-lg
            .text-h6.q-mb-md Кто предоставляет ресурсы
            .resource-explanation
              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 🖥️ Делегаты блокчейн-сети
                p
                  | Делегаты — это операторы серверов, которые поддерживают работу блокчейн-платформы COOPOS.
                  | Они инвестируют в оборудование (серверы, процессоры, память, интернет-каналы) и получают оплату
                  | в AXON за предоставление вычислительных мощностей в кооперативную экономику.

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 💱 Монетизация AXON
                p
                  | Делегаты могут обменять полученные AXON на рубли через паевой взнос у кооператива-оператора платформы.
                  | Курс обмена: <b>1 AXON = 10 RUB</b>. Это обеспечивает справедливую компенсацию за поддержку инфраструктуры.

          .accounts-section.q-mb-lg
            .text-h6.q-mb-md Регистрация аккаунтов пайщиков
            .resource-explanation
              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 👤 Стоимость регистрации
                p
                  | Регистрация одного аккаунта пайщика стоит <b>1 AXON</b> (10 RUB). Эта оплата единоразовая и покрывает
                  | стоимость постоянного хранения базовой информации об аккаунте в блокчейне. Для регистрации аккаунта также
                  | потребуется достаточная квота ресурсов для формирования и обработки пакета регистрационных документов (заявление - протокол решения совета).

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 📊 Пример расчета на месяц
                p
                  | При бюджете 1500 RUB (150 AXON) в месяц:
                  br
                  | • Минимум 1 квота в день: 30 дней × 5 AXON = 150 AXON (всё уходит на квоты)
                  br
                  | • Если нужно зарегистрировать пайщиков: потребуется дополнительно по 1 AXON на каждого
                  br
                  | • При регистрации 3 пайщиков одновременно нужна 1 дополнительная квота (для одновременной обработки ~3 пакетов документов)

          .automation-section.q-mb-lg
            .text-h6.q-mb-md Автоматическое управление
            .automation-explanation
              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm ⚙️ Пополнение при достижении порога
                p
                  | Система непрерывно отслеживает использование ресурсов. Когда любой ресурс (CPU, NET или RAM)
                  | достигает 70% использования, автоматически арендуется дополнительная квота за 5 AXON.
                  | Это настраивается в настройках рабочего стола монитора ресурсов (сейчас значения заданы в абсолютных величинах:
                  | CPU < 5000 ms, NET < 1024 bytes, RAM < 10240 bytes).

              .explanation-item.q-mb-md
                .text-subtitle1.q-mb-sm 🔁 Ежедневное пополнение
                p
                  | Каждый день в 00:00 система автоматически арендует минимальную квоту на 5 AXON. Это обеспечивает
                  | постоянную доступность базовых ресурсов для работы кооператива.

              .important-note.q-mt-md
                .text-subtitle2.text-weight-bold.q-mb-sm ⚠️ Важно знать:
                ul
                  li Поддерживайте баланс AXON не менее 50-100 токенов для бесперебойной работы
                  li Не допускайте полного исчерпания ресурсов — это заблокирует все блокчейн-операции
                  li Регулярно проверяйте баланс и состояние ресурсов в мониторе ресурсов
                  li При массовой регистрации пайщиков планируйте бюджет: 1 AXON за аккаунт + квоты для обработки

          .faq-section.q-mb-lg
            .text-h6.q-mb-md Часто задаваемые вопросы
            q-expansion-item(
              icon="help_outline"
              label="Из чего складывается стоимость пакета документов?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Стоимость пакета документов — это динамическая величина, которая зависит от:
                  ul
                    li <b>Объема данных</b> — сколько информации нужно сохранить в RAM (анонимизированные данные пайщиков, данные об условиях работы смарт-контрактов, и т.д., которые хранятся в RAM)
                    li <b>Сложности вычислений</b> — сколько проверок и расчетов нужно выполнить (например, проверка подписей на документе требует выполнения вычислений на CPU)
                    li <b>Передаваемых данных</b> — сколько информации передается между узлами сети (например, передача данных между узлами сети требует использования NET)
                    li <b>Времени хранения</b> — как долго данные остаются в оперативной памяти
                  p.q-mt-sm
                    | В среднем один пакет документов занимает ~10 КБ RAM и требует около половины ежедневной квоты (2.5 AXON),
                    | если данные хранятся весь день. Но если пакет обрабатывается быстро и память освобождается,
                    | ту же ежедневную квоту можно использовать для следующих документов.

            q-expansion-item(
              icon="help_outline"
              label="Сколько пакетов документов я могу обработать за день на одной квоте?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Это зависит от того, как быстро освобождается память:
                  ul
                    li <b>Одновременно</b> — на одной квоте (24.4 КБ) можно держать 2 полных пакета документов (~10 КБ каждый)
                    li <b>Последовательно</b> — если документы обрабатываются быстро (в течение часа), то за сутки можно
                      | обработать 24-48 пакетов на одной квоте, используя её многократно
                    li <b>При массовых операциях</b> — если нужно обработать много документов одновременно (например,
                      | регистрация 10 пайщиков за раз), потребуются дополнительные квоты

            q-expansion-item(
              icon="help_outline"
              label="Почему мне списали больше, чем минимальные 5 AXON в день?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Дополнительные списания происходят в двух случаях:
                  ol
                    li <b>Автоматическое пополнение</b> — когда использование любого ресурса превышает 70% от квоты,
                      | система арендует ещё одну квоту за 5 AXON
                    li <b>Регистрация аккаунтов</b> — каждый новый аккаунт пайщика стоит 1 AXON единоразово
                  p.q-mt-sm
                    | Проверьте логи расширения powerup, чтобы увидеть точные причины и время всех операций пополнения.

            q-expansion-item(
              icon="help_outline"
              label="Что будет, если у меня закончатся AXON?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Если баланс AXON недостаточен:
                  ul
                    li Система <b>не сможет</b> автоматически пополнить квоты
                    li Когда текущая квота исчерпается, все операции <b>будут заблокированы</b>
                    li Пайщики не смогут подавать заявления, совет не сможет принимать решения
                    li Новых пайщиков невозможно будет зарегистрировать
                  p.q-mt-sm.text-negative
                    | <b>Критично:</b> следите за балансом! Рекомендуем поддерживать запас минимум 50-100 AXON.

            q-expansion-item(
              icon="help_outline"
              label="Как узнать, сколько AXON мне нужно в месяц?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Базовый расчет:
                  ul
                    li <b>Минимум</b>: 30 дней × 5 AXON = 150 AXON (1500 RUB)
                    li <b>+ Регистрация пайщиков</b>: количество пайщиков × 1 AXON
                    li <b>+ Активные операции</b>: если проводите много собраний или обрабатываете много документов
                      | одновременно, закладывайте +20-30% на дополнительные квоты
                  p.q-mt-sm
                    | <b>Пример:</b> кооператив на 50 пайщиков с умеренной активностью — около 200 AXON в месяц (2000 RUB).

            q-expansion-item(
              icon="help_outline"
              label="Могу ли я вернуть неиспользованные AXON?"
              dense
            )
              q-card
                q-card-section.text-body2
                  p
                    | Нет. AXON, потраченные на аренду квот, идут делегатам сети в качестве оплаты за предоставленные ими
                    | вычислительные мощности.
                  p.q-mt-sm
                    | Планируйте расходы заранее и отслеживайте фактическое потребление, чтобы оптимизировать затраты.

      template(#actions)
        BaseButton(variant="ghost", v-close-popup) Закрыть
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ModalBase } from 'src/shared/ui'
import { BaseButton } from 'src/shared/ui/base/BaseButton'

// Диалог "Как это работает"
const showHowItWorksDialog = ref(false)

// Стиль диалога - адаптивная ширина
const dialogStyle = ref({
  maxWidth: 'min(800px, 95vw)',
  maxHeight: '90vh',
  overflow: 'auto'
})
</script>

<style lang="scss" scoped>
/* Канон-карточка «Как это работает»: плоская surface, без градиента. */
.resource-info-card {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  padding: var(--p-5, 20px);
  height: 100%;
}

.resource-info-card__head {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
}

.resource-info-card__icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  border-radius: var(--p-r-md, 12px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
}

.resource-info-card__title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

.resource-info-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}

.resource-info-card__lead {
  margin: 0;
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  color: var(--p-ink);
  line-height: 1.55;
}

.resource-info-card__text {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
  line-height: 1.55;
}

.resource-info-card__action {
  align-self: flex-start;
  margin-top: auto;
}

/* — Содержимое диалога — канон-токены вместо хардкод-цветов — */
.how-it-works-content {
  color: var(--p-ink-1);

  .text-h6 {
    font-weight: 600;
    margin-bottom: var(--p-4, 16px);
    color: var(--p-ink);
  }

  p {
    line-height: 1.6;
  }

  .resource-explanation,
  .automation-explanation {
    .explanation-item {
      .text-subtitle1 {
        font-weight: 600;
        margin-bottom: var(--p-2, 8px);
        color: var(--p-ink);
      }

      p {
        margin-left: var(--p-6, 24px);
        border-left: 3px solid var(--p-primary-line);
        background: var(--p-primary-soft);
        border-radius: 0 var(--p-r-sm, 8px) var(--p-r-sm, 8px) 0;
        padding: var(--p-2, 8px) 0 var(--p-2, 8px) var(--p-4, 16px);
        line-height: 1.6;
      }
    }
  }

  .important-note {
    background: var(--p-warn-soft);
    border: 1px solid var(--p-warn);
    border-radius: var(--p-r-md, 12px);
    padding: var(--p-4, 16px);

    ul {
      margin-top: var(--p-2, 8px);
      padding-left: var(--p-6, 24px);

      li {
        margin-bottom: var(--p-1, 4px);
      }
    }
  }

  .faq-section {
    :deep(.q-expansion-item) {
      margin-bottom: var(--p-3, 12px);
      border: 1px solid var(--p-line-1);
      border-radius: var(--p-r-md, 12px);
      overflow: hidden;

      .q-item {
        background: var(--p-surface-2);
        font-weight: 500;
        color: var(--p-ink);

        &:hover {
          background: var(--p-surface-3);
        }
      }

      .q-card {
        background: var(--p-surface);
        box-shadow: none;

        .q-card__section {
          line-height: 1.6;
          color: var(--p-ink-1);

          p {
            margin-bottom: var(--p-3, 12px);

            &:last-child {
              margin-bottom: 0;
            }
          }

          ul, ol {
            margin-top: var(--p-2, 8px);
            margin-bottom: var(--p-2, 8px);
            padding-left: var(--p-6, 24px);

            li {
              margin-bottom: var(--p-2, 8px);
              line-height: 1.5;
            }
          }

          b {
            color: var(--p-primary);
            font-weight: 600;
          }

          .text-negative {
            color: var(--p-neg);
            font-weight: 500;
          }
        }
      }
    }
  }
}
</style>
