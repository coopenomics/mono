<template lang="pug">
q-dialog(
  v-model='isDialogVisible',
  no-esc-dismiss,
  no-backdrop-dismiss,
  transition-show='fade',
  transition-hide='fade'
)
  q-card.notification-permission-dialog
    q-card-section.text-center.dialog-content
      .dialog-icon.q-mb-md
        q-icon(name='notifications', size='3rem', color='primary')

      .dialog-title.text-h5.q-mb-md
        | {{ $t('notificationPermissionDialog.notificationPermissionDialog.title') }}

      .dialog-description.text-body2.q-mb-lg
        p {{ $t('notificationPermissionDialog.notificationPermissionDialog.intro') }}
        ul.q-pl-md.q-mt-sm
          li {{ $t('notificationPermissionDialog.notificationPermissionDialog.statusUpdatesItem') }}
          li {{ $t('notificationPermissionDialog.notificationPermissionDialog.announcementsItem') }}
          li {{ $t('notificationPermissionDialog.notificationPermissionDialog.meetingsItem') }}
          li {{ $t('notificationPermissionDialog.notificationPermissionDialog.etcItem') }}

        p.q-mt-md.disclaimer
          | {{ $t('notificationPermissionDialog.notificationPermissionDialog.settingsHint') }}

    q-card-actions.justify-center.dialog-actions-container
      .dialog-actions
        q-btn.deny-btn(
          @click='handleDeny',
          flat,
          color='grey-7',
          :disable='isProcessing'
        ) {{ $t('notificationPermissionDialog.notificationPermissionDialog.dismiss') }}

        q-btn.allow-btn(
          @click='handleAllow',
          color='primary',
          :loading='isProcessing',
          :disable='isProcessing'
        ) {{ $t('notificationPermissionDialog.notificationPermissionDialog.allow') }}
</template>

<script setup lang="ts">
import { useNotificationPermissionDialog } from '../model';

const { isDialogVisible, isProcessing, handleAllow, handleDeny } =
  useNotificationPermissionDialog();
</script>

<style lang="scss" scoped>
.notification-permission-dialog {
  max-width: 500px;
  margin: 0 auto;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);

  .dialog-content {
    padding: 32px 24px 24px 24px;
  }

  .dialog-icon {
    .q-icon {
      background: rgba(var(--q-primary-rgb), 0.1);
      border-radius: 50%;
      padding: 16px;
    }
  }

  .dialog-title {
    font-weight: 600;

    line-height: 1.3;
  }

  .dialog-description {
    line-height: 1.5;
    max-width: 400px;
    margin: 0 auto;

    ul {
      text-align: left;
      margin: 0;

      li {
        margin-bottom: 4px;
        font-size: 14px;
      }
    }

    .disclaimer {
      font-size: 13px;
      opacity: 0.8;
    }
  }

  .dialog-actions-container {
    padding: 16px 24px 24px 24px;
  }

  .dialog-actions {
    display: flex;
    gap: 12px;
    width: 100%;
    max-width: 320px;

    .deny-btn {
      flex: 1;
      min-height: 44px;
      font-size: 14px;
      font-weight: 500;
    }

    .allow-btn {
      flex: 1.5;
      min-height: 44px;
      font-size: 14px;
      font-weight: 500;
    }
  }
}

// Для планшетов и небольших экранов
@media (max-width: 768px) {
  .notification-permission-dialog {
    max-width: 90vw;
    margin: 16px;

    .dialog-content {
      padding: 24px 20px 20px 20px;
    }

    .dialog-icon .q-icon {
      padding: 14px;
    }

    .dialog-title {
      font-size: 1.25rem;
    }

    .dialog-description {
      font-size: 14px;

      ul li {
        font-size: 13px;
      }

      .disclaimer {
        font-size: 12px;
      }
    }

    .dialog-actions-container {
      padding: 12px 20px 20px 20px;
    }
  }
}

// Для мобильных устройств
@media (max-width: 480px) {
  .notification-permission-dialog {
    max-width: 95vw;
    margin: 12px;

    .dialog-content {
      padding: 20px 16px 16px 16px;
    }

    .dialog-icon .q-icon {
      font-size: 2.5rem;
      padding: 12px;
    }

    .dialog-title {
      font-size: 1.1rem;
      margin-bottom: 12px;
    }

    .dialog-description {
      font-size: 13px;
      margin-bottom: 16px;

      ul {
        margin-top: 8px;

        li {
          font-size: 12px;
          margin-bottom: 3px;
        }
      }

      .disclaimer {
        font-size: 11px;
        margin-top: 12px;
      }
    }

    .dialog-actions-container {
      padding: 8px 16px 16px 16px;
    }

    .dialog-actions {
      gap: 8px;

      .deny-btn,
      .allow-btn {
        min-height: 42px;
        font-size: 13px;
      }
    }
  }
}

// Для очень маленьких экранов
@media (max-width: 360px) {
  .notification-permission-dialog {
    .dialog-actions {
      flex-direction: column;
      gap: 8px;

      .deny-btn,
      .allow-btn {
        flex: none;
        width: 100%;
        min-height: 44px;
      }
    }
  }
}
</style>
