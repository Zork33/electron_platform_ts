<template>
  <q-card flat bordered class="json-schema-config-widget">
    <q-card-section>
      <div class="row items-center justify-between q-mb-sm no-wrap gap-sm">
        <div class="text-subtitle2 text-grey-7">{{ title }}</div>
        <q-btn-toggle
          v-model="viewMode"
          no-caps
          dense
          unelevated
          toggle-color="primary"
          color="grey-8"
          :options="viewOptions"
        />
      </div>

      <template v-if="viewMode === 'table'">
        <div v-if="!hasSchemaPayload" class="text-grey-7">Нет схемы</div>
        <div v-else-if="schemaRows.length === 0" class="text-grey-7">
          В схеме нет списка свойств (properties)
        </div>
        <q-markup-table v-else flat bordered dense wrap-cells class="json-schema-config-widget__table">
          <thead>
            <tr>
              <th class="text-left">Название</th>
              <th class="text-left">Поле</th>
              <th class="text-left">Тип данных</th>
              <th class="text-left" style="width: 110px">Обязательное</th>
              <th class="text-left">Описание</th>
              <th class="text-left">Ограничения</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in schemaRows" :key="row.key">
              <td>{{ row.title }}</td>
              <td class="text-mono">{{ row.key }}</td>
              <td class="text-mono text-body2">{{ row.dataType }}</td>
              <td>{{ row.required ? 'Да' : 'Нет' }}</td>
              <td class="text-body2">{{ row.description || '—' }}</td>
              <td class="text-body2 text-grey-7">{{ row.extra }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </template>

      <q-input
        v-else
        :model-value="configJson"
        type="textarea"
        readonly
        filled
        borderless
        autogrow
        hide-bottom-space
        input-class="text-mono text-body2"
        label="JSON Schema"
      />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** JSON Schema (например, от Pydantic model_json_schema) */
    schema: unknown
    /** Заголовок блока над переключателем режимов */
    title?: string
  }>(),
  {
    title: 'Конфигурация',
  },
)

type ViewMode = 'table' | 'raw'

const viewMode = ref<ViewMode>('table')

const viewOptions = [
  { label: 'Таблица', value: 'table' as const },
  { label: 'JSON', value: 'raw' as const },
]

const hasSchemaPayload = computed(() => {
  const s = props.schema
  if (s === null || s === undefined) return false
  if (typeof s === 'object' && !Array.isArray(s)) return true
  if (Array.isArray(s) && s.length > 0) return true
  return typeof s === 'string' || typeof s === 'number' || typeof s === 'boolean'
})

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    return '[не удалось сериализовать]'
  }
}

const configJson = computed(() => {
  const s = props.schema
  if (s === null || s === undefined) return '—'
  return safeStringify(s)
})

interface SchemaPropertyRow {
  key: string
  title: string
  dataType: string
  required: boolean
  description: string
  extra: string
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatSchemaType(p: Record<string, unknown>): string {
  if (typeof p.type === 'string') {
    let s = p.type
    if (p.format !== undefined && p.format !== null) {
      const fmt =
        typeof p.format === 'string' ||
        typeof p.format === 'number' ||
        typeof p.format === 'boolean'
          ? String(p.format)
          : JSON.stringify(p.format)
      s += ` (${fmt})`
    }
    return s
  }
  if (Array.isArray(p.type)) {
    return p.type
      .map((t) =>
        typeof t === 'string' || typeof t === 'number' || typeof t === 'boolean'
          ? String(t)
          : JSON.stringify(t),
      )
      .join(' | ')
  }
  if (Array.isArray(p.anyOf)) {
    const parts = p.anyOf
      .filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x))
      .map((x) => {
        if (typeof x.type === 'string') return x.type
        if (x.const !== undefined) return JSON.stringify(x.const)
        return '?'
      })
    return parts.length ? parts.join(' | ') : 'union'
  }
  if (typeof p.$ref === 'string') {
    return p.$ref
  }
  if (p.properties && typeof p.properties === 'object') {
    return 'object'
  }
  if (p.items && typeof p.items === 'object' && !Array.isArray(p.items)) {
    const it = p.items as Record<string, unknown>
    return `array<${formatSchemaType(it)}>`
  }
  return '—'
}

function formatConstraints(p: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof p.minLength === 'number') parts.push(`minLength: ${p.minLength}`)
  if (typeof p.maxLength === 'number') parts.push(`maxLength: ${p.maxLength}`)
  if (typeof p.minimum === 'number') parts.push(`minimum: ${p.minimum}`)
  if (typeof p.maximum === 'number') parts.push(`maximum: ${p.maximum}`)
  if (typeof p.exclusiveMinimum === 'number') parts.push(`> ${p.exclusiveMinimum}`)
  if (typeof p.exclusiveMaximum === 'number') parts.push(`< ${p.exclusiveMaximum}`)
  if (typeof p.minItems === 'number') parts.push(`minItems: ${p.minItems}`)
  if (typeof p.maxItems === 'number') parts.push(`maxItems: ${p.maxItems}`)
  if (typeof p.pattern === 'string') parts.push(`pattern: ${p.pattern}`)
  if (Array.isArray(p.enum)) {
    parts.push(`enum: ${p.enum.map((x) => JSON.stringify(x)).join(', ')}`)
  }
  if (p.default !== undefined && p.default !== null) {
    parts.push(`default: ${JSON.stringify(p.default)}`)
  }
  return parts.length ? parts.join('; ') : '—'
}

function parseJsonSchemaProperties(schema: unknown): SchemaPropertyRow[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return []
  }
  const root = schema as Record<string, unknown>
  const props = root.properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) {
    return []
  }
  const required = Array.isArray(root.required)
    ? new Set(root.required.filter((x): x is string => typeof x === 'string'))
    : new Set<string>()

  const rows: SchemaPropertyRow[] = []
  for (const [key, def] of Object.entries(props as Record<string, unknown>)) {
    if (!def || typeof def !== 'object' || Array.isArray(def)) continue
    const p = def as Record<string, unknown>
    rows.push({
      key,
      title: typeof p.title === 'string' ? p.title : humanizeKey(key),
      dataType: formatSchemaType(p),
      required: required.has(key),
      description: typeof p.description === 'string' ? p.description : '',
      extra: formatConstraints(p),
    })
  }
  rows.sort((a, b) => {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
    if (byTitle !== 0) return byTitle
    return a.key.localeCompare(b.key)
  })
  return rows
}

const schemaRows = computed(() => parseJsonSchemaProperties(props.schema))
</script>

<style lang="scss" scoped>
.json-schema-config-widget {
  max-width: 720px;
}

.json-schema-config-widget__table {
  background: transparent;
}

.text-mono {
  font-family: ui-monospace, monospace;
}
</style>
