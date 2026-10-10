<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { debounce } from 'quasar';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert } from 'src/shared/api';
import { useFirstLoad } from 'src/shared/lib/composables';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { useLiveReload } from 'src/shared/lib/realtime';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import { useSessionStore } from 'src/entities/Session';
import {
  loadSupplierProfile,
  updateMySupplierProfile,
  type MarketplaceSupplierProfileView,
} from 'src/entities/MarketplaceSupplierProfile';
import { ReviewStars } from 'src/widgets/Marketplace/ReviewStars';
import { SupplierProfileForm } from 'src/widgets/Marketplace/SupplierProfileForm';

/**
 * «Мой профиль» на столе поставщика: что заказчик увидит на странице
 * поставщика — обложка, название, рассказ о себе — и как поставщика оценивают.
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
    q-skeleton(type="rect", height="96px")
    q-skeleton(type="rect", height="320px")

  template(v-else)
    //- Сводка: как поставщика видят заказчики — оценка и число предложений.
    BaseCard.my-profile__summary(v-if="profile")
      .my-profile__stats
        .my-profile__stat
          .my-profile__stat-label {{ $t('marketplace.supplierMyProfilePage.ratingLabel') }}
          ReviewStars(
            :rating="profile.rating_avg",
            :count="profile.reviews_count",
            :empty-text="$t('marketplace.supplierMyProfilePage.noReviews')"
          )
        .my-profile__stat
          .my-profile__stat-label {{ $t('marketplace.supplierMyProfilePage.offersLabel') }}
          .my-profile__stat-value {{ profile.offers_count }}

    SupplierProfileForm(:profile="profile", :save="updateMySupplierProfile", @saved="onSaved")
      template(#actions)
        BaseButton(variant="secondary", @click="openAsOrderer")
          template(#icon-left)
            q-icon(name="visibility", size="16px")
          | {{ $t('marketplace.supplierMyProfilePage.openAsOrdererAction') }}
</template>

<style scoped lang="scss">
.my-profile {
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 880px;

  &__skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--p-4);
  }

  &__stats {
    display: flex;
    gap: var(--p-7);
    flex-wrap: wrap;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    gap: var(--p-1);
  }

  &__stat-label {
    font-size: var(--p-fs-eyebrow);
    letter-spacing: var(--p-ls-eyebrow);
    text-transform: uppercase;
    color: var(--p-ink-3);
  }

  &__stat-value {
    font-size: var(--p-fs-h2);
    font-weight: 700;
    color: var(--p-ink);
  }
}

@media (max-width: 768px) {
  .my-profile {
    padding: var(--p-4);
  }
}
</style>
