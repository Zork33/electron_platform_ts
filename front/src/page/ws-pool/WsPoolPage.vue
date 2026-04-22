<template>
  <q-page padding>
    <div class="q-pa-md">

      <!-- Header -->
      <div class="row items-center justify-between q-mb-md">
        <div class="row items-center q-gutter-sm">
          <h4 class="q-mt-none q-mb-none">WebSocket пул</h4>
          <q-badge
            :color="autoRefresh ? 'positive' : 'grey'"
            :label="autoRefresh ? 'live' : 'pause'"
          />
        </div>
        <div class="row q-gutter-sm">
          <q-btn
            flat round dense
            :icon="autoRefresh ? 'pause' : 'play_arrow'"
            :color="autoRefresh ? 'positive' : 'grey'"
            :title="autoRefresh ? 'Приостановить' : 'Возобновить'"
            @click="toggleAutoRefresh"
          />
          <q-btn color="primary" icon="refresh" label="Обновить" :loading="loading" @click="load" />
        </div>
      </div>

      <q-banner v-if="error" class="q-mb-md bg-negative text-white" rounded>{{ error }}</q-banner>

      <!-- Stats -->
      <div class="row q-gutter-md q-mb-md">
        <q-card flat bordered class="stat-card">
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h4 text-primary">{{ poolInfo?.total_users ?? '—' }}</div>
            <div class="text-caption text-grey-6">Пользователей</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h4 text-secondary">{{ poolInfo?.total_connections ?? '—' }}</div>
            <div class="text-caption text-grey-6">Соединений</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h4 text-grey-7">{{ poolInfo?.ping_interval ?? '—' }}с</div>
            <div class="text-caption text-grey-6">Интервал ping</div>
          </q-card-section>
        </q-card>
        <q-card flat bordered class="stat-card">
          <q-card-section class="text-center q-pa-sm">
            <div class="text-h4 text-grey-7">{{ poolInfo?.ping_timeout ?? '—' }}с</div>
            <div class="text-caption text-grey-6">Таймаут ping</div>
          </q-card-section>
        </q-card>
      </div>

      <!-- Debug send panel -->
      <q-card flat bordered class="q-mb-md">
        <q-card-section class="q-pb-xs">
          <div class="text-subtitle2 text-grey-7">Отправить debug-сообщение</div>
        </q-card-section>
        <q-card-section class="q-pt-xs">
          <div class="row q-gutter-sm items-center">
            <q-input
              v-model="debugMessage"
              dense
              outlined
              placeholder="Текст сообщения"
              class="col"
              @keyup.enter="sendAll"
            />
            <q-btn
              color="primary"
              icon="wifi_tethering"
              label="Всем"
              :loading="sending === 'all'"
              :disable="!poolInfo || poolInfo.total_connections === 0"
              @click="sendAll"
            />
          </div>
        </q-card-section>
      </q-card>

      <!-- Connections table -->
      <q-card flat bordered>
        <q-card-section class="q-pb-none">
          <div class="text-subtitle2 text-grey-7">Активные соединения</div>
        </q-card-section>
        <q-card-section>
          <div v-if="!poolInfo || poolInfo.connections.length === 0" class="text-grey-6 text-center q-pa-lg">
            Нет активных соединений
          </div>
          <q-table
            v-else
            :rows="poolInfo.connections"
            :columns="columns"
            row-key="conn_id"
            flat
            dense
            :rows-per-page-options="[0]"
            hide-pagination
            class="connections-table"
          >
            <template #body-cell-conn_id="props">
              <q-td :props="props">
                <q-badge color="grey-6" :label="`#${props.row.conn_id}`" />
              </q-td>
            </template>

            <template #body-cell-user_id="props">
              <q-td :props="props">
                <q-badge color="primary" :label="`user ${props.row.user_id}`" />
              </q-td>
            </template>

            <template #body-cell-connected_at="props">
              <q-td :props="props">{{ fmtTime(props.row.connected_at) }}</q-td>
            </template>

            <template #body-cell-last_ping_at="props">
              <q-td :props="props">
                <span :class="props.row.last_ping_at ? '' : 'text-grey-5'">
                  {{ fmtTime(props.row.last_ping_at) }}
                </span>
              </q-td>
            </template>

            <template #body-cell-last_pong_at="props">
              <q-td :props="props">
                <span :class="props.row.last_pong_at ? 'text-positive' : 'text-grey-5'">
                  {{ fmtTime(props.row.last_pong_at) }}
                </span>
              </q-td>
            </template>

            <template #body-cell-client_ip="props">
              <q-td :props="props">
                <span class="mono text-grey-8">{{ props.row.client_ip ?? '—' }}</span>
              </q-td>
            </template>

            <template #body-cell-user_agent="props">
              <q-td :props="props">
                <q-tooltip v-if="props.row.user_agent" :delay="300">
                  {{ props.row.user_agent }}
                </q-tooltip>
                <span class="ua-cell">{{ parseUserAgent(props.row.user_agent) }}</span>
              </q-td>
            </template>

            <template #body-cell-actions="props">
              <q-td :props="props" auto-width>
                <div class="row no-wrap q-gutter-xs">
                  <q-btn
                    flat round dense size="sm" icon="person_pin"
                    color="secondary"
                    title="Отправить пользователю"
                    :loading="sending === `user-${props.row.user_id}`"
                    @click="sendToUser(props.row.user_id)"
                  />
                  <q-btn
                    flat round dense size="sm" icon="send"
                    color="primary"
                    title="Отправить в это соединение"
                    :loading="sending === `conn-${props.row.conn_id}`"
                    @click="sendToConnection(props.row.conn_id)"
                  />
                </div>
              </q-td>
            </template>
          </q-table>
        </q-card-section>
      </q-card>

      <div v-if="lastUpdatedDate" class="text-caption text-grey-5 q-mt-sm">
        Обновлено: {{ lastUpdated }}
      </div>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useQuasar, type QTableColumn } from 'quasar'
import { wsPoolApi } from '@/shared/api/web-socket-pool'
import type { WsPoolInfo } from '@/shared/api/web-socket-pool'

const $q = useQuasar()

const poolInfo = ref<WsPoolInfo | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const autoRefresh = ref(true)
const lastUpdatedDate = ref<Date | null>(null)
const debugMessage = ref('')
const sending = ref<string | null>(null)

let timer: ReturnType<typeof setInterval> | null = null

const lastUpdated = computed(() =>
  lastUpdatedDate.value?.toLocaleTimeString('ru-RU') ?? '—'
)

const columns: QTableColumn[] = [
  { name: 'conn_id', label: '#', field: 'conn_id', align: 'left', style: 'width: 56px' },
  { name: 'user_id', label: 'Пользователь', field: 'user_id', align: 'left', style: 'width: 120px' },
  { name: 'connected_at', label: 'Подключён', field: 'connected_at', align: 'left' },
  { name: 'last_ping_at', label: 'Ping', field: 'last_ping_at', align: 'left' },
  { name: 'last_pong_at', label: 'Pong', field: 'last_pong_at', align: 'left' },
  { name: 'client_ip', label: 'IP', field: 'client_ip', align: 'left' },
  { name: 'user_agent', label: 'Браузер', field: 'user_agent', align: 'left' },
  { name: 'actions', label: '', field: 'conn_id', align: 'right' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return '—'
  const browsers: [RegExp, string][] = [
    [/Edg\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/YaBrowser\//, 'Яндекс'],
    [/Chrome\//, 'Chrome'],
    [/Firefox\//, 'Firefox'],
    [/Safari\//, 'Safari'],
  ]
  for (const [re, name] of browsers) {
    if (re.test(ua)) return name
  }
  return ua.slice(0, 30)
}

async function load() {
  loading.value = true
  error.value = null
  try {
    poolInfo.value = await wsPoolApi.getPoolInfo()
    lastUpdatedDate.value = new Date()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startTimer() {
  timer = setInterval(() => void load(), 3000)
}

function stopTimer() {
  if (timer !== null) { clearInterval(timer); timer = null }
}

function toggleAutoRefresh() {
  autoRefresh.value = !autoRefresh.value
  if (autoRefresh.value) { startTimer() } else { stopTimer() }
}

async function sendAll() {
  if (!debugMessage.value.trim()) {
    $q.notify({ type: 'warning', message: 'Введите сообщение', position: 'top-right' })
    return
  }
  sending.value = 'all'
  try {
    await wsPoolApi.sendAll(debugMessage.value)
    $q.notify({ type: 'positive', message: 'Отправлено всем', position: 'top-right' })
  } catch (e) {
    $q.notify({ type: 'negative', message: String(e), position: 'top-right' })
  } finally {
    sending.value = null
  }
}

async function sendToUser(userId: number) {
  if (!debugMessage.value.trim()) {
    $q.notify({ type: 'warning', message: 'Введите сообщение', position: 'top-right' })
    return
  }
  sending.value = `user-${userId}`
  try {
    await wsPoolApi.sendToUser(userId, debugMessage.value)
    $q.notify({ type: 'positive', message: `Отправлено user ${userId}`, position: 'top-right' })
  } catch (e) {
    $q.notify({ type: 'negative', message: String(e), position: 'top-right' })
  } finally {
    sending.value = null
  }
}

async function sendToConnection(connId: number) {
  if (!debugMessage.value.trim()) {
    $q.notify({ type: 'warning', message: 'Введите сообщение', position: 'top-right' })
    return
  }
  sending.value = `conn-${connId}`
  try {
    await wsPoolApi.sendToConnection(connId, debugMessage.value)
    $q.notify({ type: 'positive', message: `Отправлено в соединение #${connId}`, position: 'top-right' })
  } catch (e) {
    $q.notify({ type: 'negative', message: String(e), position: 'top-right' })
  } finally {
    sending.value = null
  }
}

onMounted(() => { void load(); startTimer() })
onUnmounted(() => stopTimer())
</script>

<style lang="scss" scoped>
.stat-card {
  min-width: 110px;
}
.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.82rem;
}
.ua-cell {
  font-size: 0.85rem;
}
.connections-table {
  :deep(th) { font-size: 0.78rem; }
}
</style>
