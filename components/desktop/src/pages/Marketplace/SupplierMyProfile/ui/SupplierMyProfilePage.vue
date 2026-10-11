<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseButton } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useSessionStore } from 'src/entities/Session';
import {
  loadSupplierProfile,
  updateMySupplierProfile,
  type MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { SupplierProfileForm } from 'src/widgets/Marketplace/SupplierProfileForm';
import { SupplierProfileHead } from 'src/widgets/Marketplace/SupplierProfileHead';

/**
 * «Мой профиль» на столе поставщика. Сверху — шапка в том виде, в каком её
 * видит заказчик: обложка, имя, оценка и числа; под ней форма правки.
 */
const route = useRoute();
const router = useRouter();
const session = useSessionStore();

const coopname = computed(() => String(route.params.coopname ?? ''));
const profile = ref<MarketplaceSupplierProfileView | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

async function load(): Promise<void> {
  loading.value = true;
  try {
    profile.value = await loadSupplierProfile(session.username);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

function onSaved(saved: MarketplaceSupplierProfileView): void {
  profile.value = saved;
}

/** Страница поставщика такой, какой её видит заказчик. */
function openAsOrderer(): void {
  void router.push({
    name: 'marketplace-supplier-profile',
    params: { coopname: coopname.value, account: session.username },
  });
}

// Оценка и число предложений меняются без участия поставщика: отзывы пишут
// заказчики, предложения публикует модератор.
const reloadLive = debounce(() => {
  if (loading.value) return;
  void load();
}, 400);
useLiveReload(marketLiveTables('review', 'offer'), () => reloadLive());

onMounted(load);
</script>

<template lang="pug">
q-page.my-profile(role="region", :aria-label="$t('marketplace.supplierMyProfilePage.ariaLabel')")
  PageHint(storage-key="mp:supplier-my-profile:banner-dismissed")
    | {{ $t('marketplace.supplierMyProfilePage.hint') }}

  .my-profile__skeleton(v-if="firstLoad")
    q-skeleton(type="rect", height="260px")
    q-skeleton(type="rect", height="320px")

  template(v-else)
    SupplierProfileHead(v-if="profile", :profile="profile")
      template(#actions)
        BaseButton(variant="secondary", size="sm", @click="openAsOrderer")
          template(#icon-left)
            q-icon(name="visibility", size="16px")
          | {{ $t('marketplace.supplierMyProfilePage.openAsOrdererAction') }}

    SupplierProfileForm(:profile="profile", :save="updateMySupplierProfile", @saved="onSaved")
</template>

<style scoped lang="scss">
.my-profile {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--p-4);
  }
}

@media (max-width: 768px) {
  .my-profile {
    padding: var(--p-4);
  }
}
</style>
