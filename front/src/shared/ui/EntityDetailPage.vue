<template>
  <q-page>
    <div class="entity-detail-page">
      <div v-if="!loading" class="sticky-header">

        <!-- Новый стиль: кнопки слева, затем тайтл -->
        <template v-if="listPath !== undefined">
          <div class="page-header page-header--actions-first">
            <div class="header-actions">
              <q-btn
                v-if="!hideSave"
                flat round icon="save" color="grey"
                :loading="saving"
                class="btn-hover-positive"
                @click="emit('save')"
              >
                <q-tooltip>Сохранить</q-tooltip>
              </q-btn>
              <q-btn
                v-if="!hideInfo && infoData"
                flat round icon="info" color="grey"
                class="btn-hover-info"
                @click="showInfoDialog = true"
              >
                <q-tooltip>Информация</q-tooltip>
              </q-btn>
              <q-btn
                flat round icon="format_list_bulleted" color="grey"
                class="btn-hover-amber"
                @click="router.push(listPath)"
              >
                <q-tooltip>К списку</q-tooltip>
              </q-btn>
              <q-btn
                v-if="!hideDelete"
                flat
                round
                icon="more_vert"
                color="grey"
                class="btn-hover-amber"
              >
                <q-tooltip>Ещё</q-tooltip>
                <q-menu anchor="bottom end" self="top end">
                  <q-list style="min-width: 160px">
                    <q-item clickable v-close-popup @click="emit('delete')" class="text-negative">
                      <q-item-section avatar>
                        <q-icon name="delete" />
                      </q-item-section>
                      <q-item-section>Удалить</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
              <slot name="toolbar-extra" />
            </div>
            <div class="page-title">{{ title }}</div>
          </div>
        </template>

        <!-- Старый стиль: стрелка назад + тайтл в строку (обратная совместимость) -->
        <template v-else>
          <div class="page-header">
            <div class="flex items-center gap-sm">
              <q-btn flat round icon="arrow_back" @click="emit('back')">
                <q-tooltip>Вернуться к списку</q-tooltip>
              </q-btn>
              <div class="page-title q-ml-sm">{{ title }}</div>
            </div>
            <div class="header-actions">
              <slot name="header-actions" />
            </div>
          </div>
          <div v-if="$slots['toolbar-actions']" class="toolbar-bar">
            <slot name="toolbar-actions" />
          </div>
        </template>

        <!-- Таб-бар (оба стиля) -->
        <div v-if="tabs?.length" class="tab-bar">
          <q-tabs
            :model-value="activeTab"
            @update:model-value="(val: string) => emit('update:activeTab', val)"
            dense
            no-caps
            active-color="primary"
            indicator-color="primary"
            align="left"
            narrow-indicator
          >
            <q-tab v-for="tab in tabs" :key="tab.value" :name="tab.value" :label="tab.label" />
          </q-tabs>
        </div>
      </div>

      <!-- Ошибка -->
      <q-banner v-if="error" class="text-white bg-red q-mb-md" rounded>
        <template #avatar><q-icon name="error" /></template>
        {{ error }}
        <template #action>
          <q-btn flat label="Повторить" @click="emit('retry')" />
        </template>
      </q-banner>

      <!-- Загрузка -->
      <div v-if="loading" class="text-center q-pa-xl">
        <q-spinner size="50px" color="primary" />
        <div class="text-grey-7 q-mt-md">Загрузка данных...</div>
      </div>

      <!-- Контент -->
      <div v-else :class="['detail-content', { 'detail-content--animated': initialLoad }]">
        <slot />

        <q-banner v-if="deletedAt" class="text-white bg-warning q-mt-md" rounded>
          <template #avatar><q-icon name="warning" /></template>
          Эта запись была удалена {{ formatDate(deletedAt) }}
        </q-banner>
      </div>
    </div>

    <!-- Диалог «Информация» -->
    <q-dialog v-if="infoData" v-model="showInfoDialog">
      <q-card class="info-dialog">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Информация</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator class="q-mt-sm" />
        <q-card-section>
          <div class="info-row">
            <span class="info-label">Идентификатор</span>
            <span class="info-value">{{ infoData.id ?? '—' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Создан</span>
            <span class="info-value">{{ formatDate(infoData.created_at) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Обновлён</span>
            <span class="info-value">{{ formatDate(infoData.updated_at) }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Удалён</span>
            <span class="info-value">{{ formatDate(infoData.deleted_at) }}</span>
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export interface TabItem {
  label: string
  value: string
}

export interface EntityInfoData {
  id?: number
  created_at?: string | null
  updated_at?: string | null
  deleted_at?: string | null
}

const props = withDefaults(defineProps<{
  title: string
  loading?: boolean
  error?: string | null
  deletedAt?: string | null | undefined
  tabs?: TabItem[]
  activeTab?: string
  listPath?: string
  saving?: boolean
  hideSave?: boolean
  hideInfo?: boolean
  hideDelete?: boolean
  infoData?: EntityInfoData | null
}>(), {
  loading: false,
  error: null,
  deletedAt: null,
  tabs: () => [],
  activeTab: '',
  saving: false,
  hideSave: false,
  hideInfo: false,
  hideDelete: false,
  infoData: null,
})

const emit = defineEmits<{
  back: []
  retry: []
  save: []
  delete: []
  'update:activeTab': [value: string]
}>()

const router = useRouter()
const showInfoDialog = ref(false)

// Анимация только при первой загрузке, не при сохранении
const initialLoad = ref(true)
let loadedOnce = false
watch(() => props.loading, (isLoading) => {
  if (!isLoading) {
    if (!loadedOnce) {
      loadedOnce = true
      initialLoad.value = true
    } else {
      initialLoad.value = false
    }
  }
})

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    if (!props.hideSave && !props.saving) {
      emit('save')
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '—'
  return new Date(date).toLocaleString('ru-RU', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}
</script>

<style scoped lang="scss">
.entity-detail-page {
  width: 100%;

  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    background: var(--q-bg-card, white);
    margin: -16px -16px 0;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--q-border-subtle, #e5e7eb);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .body--dark & {
      background: var(--q-bg-card, #262d38);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
    }
  }

  // Общий стиль шапки
  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 0 0.75rem;

    .page-title {
      font-size: 1.75rem;
      font-weight: 300;
    }

    &.page-header--actions-first {
      justify-content: flex-start;
      gap: 0.75rem;
    }

    .header-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
  }

  .toolbar-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .btn-hover-positive:hover,
  :deep(.btn-hover-positive:hover) { color: var(--q-positive) !important; }
  .btn-hover-info:hover,
  :deep(.btn-hover-info:hover)     { color: var(--q-info) !important; }
  .btn-hover-amber:hover,
  :deep(.btn-hover-amber:hover)   { color: #ffb74d !important; }
  .btn-hover-negative:hover,
  :deep(.btn-hover-negative:hover) { color: var(--q-negative) !important; }

  .tab-bar {
    /* без отрицательного margin — табы начинаются так же, как заголовок */
    :deep(.q-tabs__content) {
      padding-left: 0;
    }
    :deep(.q-tabs__content .q-tab) {
      flex: 0 1 auto;
      min-width: 0;
      padding-left: 12px;
      padding-right: 12px;
      min-height: 40px;
      overflow: hidden;
      border-radius: 4px;
    }
    :deep(.q-tab .q-focus-helper),
    :deep(.q-tab .q-ripple-container) {
      border-radius: 4px;
    }
  }

  .detail-content {
    padding-top: 1rem;

    &--animated {
      animation: fadeIn 0.25s ease-in;
    }
  }

}


.info-dialog {
  min-width: 320px;

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    &:last-child {
      border-bottom: none;
    }

    .body--dark & {
      border-bottom-color: rgba(255, 255, 255, 0.08);
    }
  }

  .info-label {
    color: var(--q-grey-7, #757575);
    font-size: 0.875rem;
    white-space: nowrap;
  }

  .info-value {
    font-weight: 500;
    text-align: right;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (max-width: 600px) {
  .entity-detail-page {
    .sticky-header {
      padding: 0 1rem;
    }

    .page-title {
      font-size: 1.4rem;
    }

    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;

      .header-actions {
        width: 100%;
        flex-wrap: wrap;
      }
    }

    .toolbar-bar {
      flex-wrap: wrap;
    }
  }
}
</style>

<style lang="scss">
/* Стили для кнопок в toolbar-extra (slot) */
.entity-detail-page .btn-hover-amber:hover {
  color: #ffb74d !important;
}
.entity-detail-page .btn-hover-negative:hover {
  color: var(--q-negative) !important;
}

/* Переиспользуемый класс карточки для страниц деталей */
.page-detail-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  margin-bottom: 1rem;

  > .q-card__section {
    padding: 1.25rem 1.5rem 1.5rem;
  }

  &--narrow {
    max-width: 480px;
  }
}
</style>
