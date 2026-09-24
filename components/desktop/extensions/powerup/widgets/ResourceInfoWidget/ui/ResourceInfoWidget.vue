<template lang="pug">
.resource-info-card
  .resource-info-card__head
    .resource-info-card__icon
      q-icon(name="help_outline", size="20px")
    .resource-info-card__title {{ $t('powerup.resourceInfoWidget.cardTitle') }}

  .resource-info-card__body
    p.resource-info-card__lead
      | {{ $t('powerup.resourceInfoWidget.leadLine1') }}
    p.resource-info-card__text
      | {{ $t('powerup.resourceInfoWidget.leadLine2') }}
      | {{ $t('powerup.resourceInfoWidget.leadLine3') }}

  BaseButton.resource-info-card__action(variant="secondary", size="sm", @click="showHowItWorksDialog = true")
    template(#icon-left)
      q-icon(name="menu_book", size="16px")
    | {{ $t('powerup.resourceInfoWidget.detailsButton') }}

  //- Диалог "Как это работает"
  BaseDialog(
    v-model="showHowItWorksDialog",
    :title="$t('powerup.resourceInfoWidget.dialogTitle')",
    size="lg"
  )
    .q-pa-md
      .how-it-works-content
        .intro-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.whatIsResourcesHeading') }}
          p.text-body1
            | {{ $t('powerup.resourceInfoWidget.whatIsResourcesLine1') }}
            | {{ $t('powerup.resourceInfoWidget.whatIsResourcesLine2') }}
          ul.q-mt-sm
            li {{ $t('powerup.resourceInfoWidget.ramBullet') }}
            li {{ $t('powerup.resourceInfoWidget.cpuBullet') }}
            li {{ $t('powerup.resourceInfoWidget.netBullet') }}

        .resources-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.quotaSystemHeading') }}
          .resource-explanation
            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.quotaWhatIsHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.quotaWhatIsLine1') }}
                br
                | {{ $t('powerup.resourceInfoWidget.quotaRamShareBullet') }}
                br
                | {{ $t('powerup.resourceInfoWidget.quotaCpuShareBullet') }}
                br
                | {{ $t('powerup.resourceInfoWidget.quotaNetShareBullet') }}

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.documentPackagesHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.documentPackagesLine1') }}
                | {{ $t('powerup.resourceInfoWidget.documentPackagesLine2') }}
                | {{ $t('powerup.resourceInfoWidget.documentPackagesLine3') }}

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.reuseHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.reuseLine1') }}
                | {{ $t('powerup.resourceInfoWidget.reuseLine2') }}
                | {{ $t('powerup.resourceInfoWidget.reuseLine3') }}
                | {{ $t('powerup.resourceInfoWidget.reuseLine4') }}

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.renewalHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.renewalLine1') }}
                | {{ $t('powerup.resourceInfoWidget.renewalLine2') }}
                | {{ $t('powerup.resourceInfoWidget.renewalLine3') }}

        .delegates-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.delegatesHeading') }}
          .resource-explanation
            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.delegatesWhoHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.delegatesWhoLine1') }}
                | {{ $t('powerup.resourceInfoWidget.delegatesWhoLine2') }}
                | {{ $t('powerup.resourceInfoWidget.delegatesWhoLine3') }}

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.monetizationHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.monetizationLine1') }}
                | {{ $t('powerup.resourceInfoWidget.monetizationLine2') }}

        .accounts-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.registrationHeading') }}
          .resource-explanation
            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.registrationCostHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.registrationCostLine1') }}
                | {{ $t('powerup.resourceInfoWidget.registrationCostLine2') }}
                | {{ $t('powerup.resourceInfoWidget.registrationCostLine3') }}

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.registrationExampleHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.registrationExampleIntro') }}
                br
                | {{ $t('powerup.resourceInfoWidget.registrationExampleBullet1') }}
                br
                | {{ $t('powerup.resourceInfoWidget.registrationExampleBullet2') }}
                br
                | {{ $t('powerup.resourceInfoWidget.registrationExampleBullet3') }}

        .automation-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.automationHeading') }}
          .automation-explanation
            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.automationThresholdHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.automationThresholdLine1') }}
                | {{ $t('powerup.resourceInfoWidget.automationThresholdLine2') }}
                | {{ $t('powerup.resourceInfoWidget.automationThresholdLine3') }}
                | CPU < 5000 ms, NET < 1024 bytes, RAM < 10240 bytes).

            .explanation-item.q-mb-md
              .text-subtitle1.q-mb-sm {{ $t('powerup.resourceInfoWidget.automationDailyHeading') }}
              p
                | {{ $t('powerup.resourceInfoWidget.automationDailyLine1') }}
                | {{ $t('powerup.resourceInfoWidget.automationDailyLine2') }}

            .important-note.q-mt-md
              .text-subtitle2.text-weight-bold.q-mb-sm {{ $t('powerup.resourceInfoWidget.automationImportantHeading') }}
              ul
                li {{ $t('powerup.resourceInfoWidget.automationImportantBullet1') }}
                li {{ $t('powerup.resourceInfoWidget.automationImportantBullet2') }}
                li {{ $t('powerup.resourceInfoWidget.automationImportantBullet3') }}
                li {{ $t('powerup.resourceInfoWidget.automationImportantBullet4') }}

        .faq-section.q-mb-lg
          .text-h6.q-mb-md {{ $t('powerup.resourceInfoWidget.faqHeading') }}
          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqPackageCostQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerLine1') }}
                ul
                  li {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerBullet1') }}
                  li {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerBullet2') }}
                  li {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerBullet3') }}
                  li {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerBullet4') }}
                p.q-mt-sm
                  | {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerLine2') }}
                  | {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerLine3') }}
                  | {{ $t('powerup.resourceInfoWidget.faqPackageCostAnswerLine4') }}

          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqDailyPackagesQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerLine1') }}
                ul
                  li {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerBullet1') }}
                  li {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerBullet2a') }}
                    | {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerBullet2b') }}
                  li {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerBullet3a') }}
                    | {{ $t('powerup.resourceInfoWidget.faqDailyPackagesAnswerBullet3b') }}

          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqExtraChargeQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqExtraChargeAnswerLine1') }}
                ol
                  li {{ $t('powerup.resourceInfoWidget.faqExtraChargeAnswerBullet1a') }}
                    | {{ $t('powerup.resourceInfoWidget.faqExtraChargeAnswerBullet1b') }}
                  li {{ $t('powerup.resourceInfoWidget.faqExtraChargeAnswerBullet2') }}
                p.q-mt-sm
                  | {{ $t('powerup.resourceInfoWidget.faqExtraChargeAnswerLine2') }}

          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqOutOfAxonQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerLine1') }}
                ul
                  li {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerBullet1') }}
                  li {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerBullet2') }}
                  li {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerBullet3') }}
                  li {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerBullet4') }}
                p.q-mt-sm.text-negative
                  | {{ $t('powerup.resourceInfoWidget.faqOutOfAxonAnswerLine2') }}

          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqMonthlyBudgetQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerLine1') }}
                ul
                  li {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerBullet1') }}
                  li {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerBullet2') }}
                  li {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerBullet3a') }}
                    | {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerBullet3b') }}
                p.q-mt-sm
                  | {{ $t('powerup.resourceInfoWidget.faqMonthlyBudgetAnswerLine2') }}

          q-expansion-item(
            icon="help_outline"
            :label="$t('powerup.resourceInfoWidget.faqRefundQuestion')"
            dense
          )
            q-card
              q-card-section.text-body2
                p
                  | {{ $t('powerup.resourceInfoWidget.faqRefundAnswerLine1a') }}
                  | {{ $t('powerup.resourceInfoWidget.faqRefundAnswerLine1b') }}
                p.q-mt-sm
                  | {{ $t('powerup.resourceInfoWidget.faqRefundAnswerLine2') }}

      .q-pt-md.text-right
        BaseButton(variant="ghost", @click="showHowItWorksDialog = false") {{ $t('common.action.close') }}
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BaseDialog } from 'src/shared/ui/base/BaseDialog'
import { BaseButton } from 'src/shared/ui/base/BaseButton'

// Диалог "Как это работает"
const showHowItWorksDialog = ref(false)
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
