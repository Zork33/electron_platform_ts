<template>
  <q-page>
    <div class="entity-list-page">
      <!-- Фиксированная шапка -->
      <div class="page-header">
        <div class="page-title">{{ title }}</div>
        <div class="header-actions">
          <!-- Кастомный контент слева от кнопок (поиск и т.п.) -->
          <slot name="header-prepend" />

          <!-- Кастомные дополнительные кнопки -->
          <slot name="toolbar-extra" />

          <!-- Legacy-слот для обратной совместимости -->
          <slot name="header-actions" />

          <!-- Добавить -->
          <q-btn
            v-if="addPath && !hideAdd"
            flat
            round
            icon="add"
            class="header-btn btn-hover-positive"
            @click="router.push(addPath)"
          >
            <q-tooltip>Добавить</q-tooltip>
          </q-btn>

          <!-- Информация -->
          <q-btn
            v-if="!hideInfo"
            flat
            round
            icon="info_outline"
            class="header-btn btn-hover-info"
            @click="infoDialogOpen = true"
          >
            <q-tooltip>Информация</q-tooltip>
          </q-btn>

          <!-- Фильтр -->
          <q-btn
            v-if="!hideFilter"
            flat
            round
            icon="filter_alt"
            class="header-btn btn-hover-amber"
            @click="filterDialogOpen = true"
          >
            <q-tooltip>Фильтры</q-tooltip>
          </q-btn>

          <!-- Показ удалённых -->
          <q-btn
            v-if="!hideDeleted"
            flat
            round
            :icon="showDeleted ? 'visibility_off' : 'visibility'"
            :class="['header-btn', showDeleted ? 'header-btn--active' : '']"
            @click="emit('toggle-show-deleted')"
          >
            <q-tooltip>{{ showDeleted ? 'Скрыть удалённых' : 'Показать удалённых' }}</q-tooltip>
          </q-btn>
        </div>
      </div>

      <!-- Ошибка -->
      <q-banner v-if="error" class="text-white bg-red q-mb-md" rounded>
        <template #avatar>
          <q-icon name="error" />
        </template>
        {{ error }}
        <template #action>
          <q-btn flat label="Повторить" @click="emit('retry')" />
        </template>
      </q-banner>

      <!-- Таблица -->
      <q-table
        v-if="!loading"
        class="entity-table"
        :rows="rows"
        :columns="columns"
        :row-key="rowKey"
        flat
        :rows-per-page-options="[20, 50, 100]"
        :rows-per-page-label="'Строк на странице'"
        no-data-label=""
        @row-click="(_, row) => emit('row-click', row)"
      >
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>

        <template #body="props">
          <q-tr
            :props="props"
            :class="{ 'row--deleted': props.row.deleted_at }"
            :style="!props.row.deleted_at ? 'cursor: pointer' : ''"
            @click="!props.row.deleted_at && emit('row-click', props.row)"
          >
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <slot :name="`body-cell-${col.name}`" :row="props.row" :col="col">
                {{ col.value }}
              </slot>
            </q-td>
          </q-tr>
        </template>

        <template #no-data>
          <div class="full-width">
            <EmptyState :title="emptyTitle" :message="emptyMessage" />
          </div>
        </template>
      </q-table>

      <!-- Загрузка -->
      <div v-else class="text-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
        <div class="q-mt-md text-grey-7">Загрузка...</div>
      </div>
    </div>

    <!-- Диалог информации -->
    <q-dialog v-model="infoDialogOpen">
      <q-card style="min-width: 320px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Информация</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          Вывод информации ещё не настроен
        </q-card-section>
      </q-card>
    </q-dialog>

    <!-- Диалог фильтров -->
    <q-dialog v-model="filterDialogOpen">
      <q-card style="min-width: 320px">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Фильтры</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-card-section>
          Фильтры ещё не настроены
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts" generic="T extends { id: number; deleted_at?: string | null }">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import type { QTableColumn } from 'quasar'
import EmptyState from 'widget/EmptyState.vue'

withDefaults(defineProps<{
  title: string
  columns: QTableColumn[]
  rows: T[]
  loading: boolean
  error: string | null
  showDeleted: boolean
  rowKey?: string
  emptyTitle?: string
  emptyMessage?: string
  addPath?: string
  hideAdd?: boolean
  hideInfo?: boolean
  hideFilter?: boolean
  hideDeleted?: boolean
}>(), {
  rowKey: 'id',
  emptyTitle: 'Нет данных',
  emptyMessage: 'Список пуст',
  hideAdd: false,
  hideInfo: false,
  hideFilter: false,
  hideDeleted: false,
})

const router = useRouter()

const emit = defineEmits<{
  'toggle-show-deleted': []
  'row-click': [row: T]
  'retry': []
}>()

const infoDialogOpen = ref(false)
const filterDialogOpen = ref(false)
</script>

<style lang="scss" scoped>
.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  margin: -16px -16px 16px;
  padding: 16px 16px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--q-border-subtle, rgba(128, 128, 128, 0.15));
  background-color: var(--q-bg-page, #f5f5f5);

  .body--dark & {
    background-color: var(--q-bg-page, #1a1f27);
  }
}

.page-title {
  font-size: 1.75rem;
  font-weight: 300;
}

.header-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

.entity-list-page {
  padding-top: 0;
}
</style>

<style lang="scss">
.btn-hover-positive:hover { color: var(--q-positive) !important; }
.btn-hover-info:hover     { color: var(--q-info) !important; }
.btn-hover-amber:hover    { color: #ffb74d !important; }
.btn-hover-negative:hover { color: var(--q-negative) !important; }

.entity-table {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  thead tr th {
    background-color: rgba(128, 128, 128, 0.1) !important;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid rgba(128, 128, 128, 0.2) !important;
    padding: 12px 16px;
  }

  tbody tr {
    td {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      font-size: 0.9rem;
      transition: background-color 0.2s ease, box-shadow 0.2s ease;
    }

    &:last-child td {
      border-bottom: none;
    }

    &:hover td {
      background-color: rgba(25, 118, 210, 0.06);
    }

    &:hover td:first-child {
      box-shadow: inset 3px 0 0 $primary;
    }
  }

  .q-table__bottom {
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 0.85rem;
  }
}

.body--dark .entity-table {
  background: var(--q-bg-card, #262d38);
  color: var(--q-text-primary, #e7eaef);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);

  thead tr th {
    background-color: rgba(255, 255, 255, 0.06) !important;
    border-bottom-color: rgba(231, 234, 242, 0.14) !important;
  }

  tbody tr td {
    border-bottom-color: rgba(231, 234, 242, 0.08);
  }

  tbody tr:hover td {
    background-color: rgba(25, 118, 210, 0.14);
  }

  .q-table__bottom {
    border-top-color: rgba(231, 234, 242, 0.1);
    color: var(--q-text-secondary, #97a3b5);
  }

  .q-table__middle {
    background: var(--q-bg-card, #262d38);
  }
}

.row--deleted {
  td {
    opacity: 0.5;
  }

  td:first-child {
    border-left: 3px solid var(--q-negative);
  }

  &:hover td {
    background-color: transparent !important;
    cursor: default;
  }
}
</style>
