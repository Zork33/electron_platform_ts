<template>
  <q-page padding>
    <div class="q-pa-md">
      <div class="row items-center justify-between q-mb-md">
        <h4 class="q-mt-none q-mb-none">Object Container</h4>
        <q-btn
          color="primary"
          icon="refresh"
          label="Обновить"
          :loading="loading"
          @click="loadStorageInfo"
        />
      </div>

      <q-banner v-if="error" class="q-mb-md bg-negative text-white" rounded>
        {{ error }}
      </q-banner>

      <template v-if="storageInfo">
        <q-card>
          <q-card-section>
            <q-table
              :rows="flatRows"
              :columns="columns"
              row-key="rowKey"
              flat
              dense
              :rows-per-page-options="[0]"
              hide-pagination
              class="object-table"
            >
              <template #body-cell-category="props">
                <q-td :props="props">
                  <span class="category-cell">{{ props.row.category }}</span>
                </q-td>
              </template>

              <template #body-cell-id="props">
                <q-td :props="props">
                  <q-badge color="primary" :label="props.row.id" />
                </q-td>
              </template>

              <template #body-cell-created_at="props">
                <q-td :props="props">
                  {{ formatDateTime(props.row.created_at) }}
                </q-td>
              </template>

              <template #body-cell-last_accessed="props">
                <q-td :props="props">
                  {{ formatDateTime(props.row.last_accessed) }}
                </q-td>
              </template>

              <template #body-cell-ttl_seconds="props">
                <q-td :props="props">
                  <q-badge
                    :color="props.row.ttl_seconds === -1 ? 'grey' : 'teal'"
                    :label="props.row.ttl_seconds === -1 ? '∞' : `${props.row.ttl_seconds} с`"
                  />
                </q-td>
              </template>

              <template #body-cell-expires_at="props">
                <q-td :props="props">
                  {{ props.row.expires_at ? formatDateTime(props.row.expires_at) : '—' }}
                </q-td>
              </template>
            </q-table>

            <div v-if="flatRows.length === 0" class="text-grey-7 text-center q-pa-lg">
              Нет объектов в контейнере
            </div>
          </q-card-section>
        </q-card>
      </template>

      <div v-else-if="!loading && !error" class="text-grey-7 text-center q-pa-xl">
        Нажмите «Обновить» для загрузки данных
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useQuasar, type QTableColumn } from 'quasar'
import { objectContainerApi } from '@/shared/api'
import type { StorageInfoResponse } from '@/shared/api/object-container'

const $q = useQuasar()

const storageInfo = ref<StorageInfoResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

interface FlatRow {
  rowKey: string
  category: string
  id: string
  created_at: string
  last_accessed: string
  ttl_seconds: number
  expires_at: string | null
}

const truncateCategory = (category: string): string => {
  const lastDot = category.lastIndexOf('.')
  return lastDot > 0 ? category.slice(0, lastDot) : category
}

const flatRows = computed<FlatRow[]>(() => {
  if (!storageInfo.value) return []
  const rows: FlatRow[] = []
  for (const cat of storageInfo.value.object_list) {
    const categoryShort = truncateCategory(cat.category)
    for (const obj of cat.objects) {
      rows.push({
        rowKey: `${cat.category}:${obj.id}`,
        category: categoryShort,
        id: obj.id,
        created_at: obj.created_at,
        last_accessed: obj.last_accessed,
        ttl_seconds: obj.ttl_seconds,
        expires_at: obj.expires_at,
      })
    }
  }
  rows.sort((a, b) => {
    const catCmp = a.category.localeCompare(b.category)
    if (catCmp !== 0) return catCmp
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
  return rows
})

const columns: QTableColumn[] = [
  { name: 'category', label: 'Категория', field: 'category', align: 'left' },
  { name: 'id', label: 'ID', field: 'id', align: 'left', style: 'width: 100px' },
  { name: 'created_at', label: 'Создан', field: 'created_at', align: 'left' },
  { name: 'last_accessed', label: 'Последний доступ', field: 'last_accessed', align: 'left' },
  { name: 'ttl_seconds', label: 'TTL', field: 'ttl_seconds', align: 'left', style: 'width: 80px' },
  { name: 'expires_at', label: 'Истекает', field: 'expires_at', align: 'left' },
]

const formatDateTime = (iso: string): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const loadStorageInfo = async () => {
  loading.value = true
  error.value = null
  try {
    storageInfo.value = await objectContainerApi.getStorageInfo()
    $q.notify({
      type: 'positive',
      message: 'Данные обновлены',
      position: 'top-right',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    error.value = msg
    $q.notify({
      type: 'negative',
      message: 'Ошибка загрузки',
      position: 'top-right',
    })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadStorageInfo()
})
</script>

<style lang="scss" scoped>
.category-cell {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
}
</style>
