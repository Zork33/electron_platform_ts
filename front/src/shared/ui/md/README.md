# MarkdownEditor Component

Переиспользуемый компонент-обертка над `md-editor-v3` для работы с Markdown в проекте.

## Импорт

```typescript
import { MarkdownEditor } from '@/shared/ui'
// или
import MarkdownEditor from '@/shared/ui/markdown-editor/MarkdownEditor.vue'
```

## Базовое использование

```vue
<template>
  <MarkdownEditor v-model="content" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const content = ref('# Hello World\n\nThis is **markdown**!')
</script>
```

## Props

### modelValue (required)
- **Тип:** `string`
- **По умолчанию:** `''`
- **Описание:** Содержимое markdown (v-model)

```vue
<MarkdownEditor v-model="content" />
```

### language
- **Тип:** `'en-US' | 'ru-RU' | 'zh-CN'`
- **По умолчанию:** `'en-US'`
- **Описание:** Язык интерфейса редактора

```vue
<MarkdownEditor v-model="content" language="ru-RU" />
```

### theme
- **Тип:** `'light' | 'dark' | 'auto'`
- **По умолчанию:** `'auto'`
- **Описание:** Тема редактора. `'auto'` автоматически синхронизируется с темой Quasar

```vue
<MarkdownEditor v-model="content" theme="dark" />
```

### preview
- **Тип:** `boolean`
- **По умолчанию:** `true`
- **Описание:** Показывать ли preview панель (split-view)

```vue
<MarkdownEditor v-model="content" :preview="true" />
```

### previewOnly
- **Тип:** `boolean`
- **По умолчанию:** `false`
- **Описание:** Режим только для чтения (только preview, без редактирования)

```vue
<MarkdownEditor v-model="content" :preview-only="true" />
```

### placeholder
- **Тип:** `string`
- **По умолчанию:** `'Введите текст в формате Markdown...'`
- **Описание:** Placeholder текст

```vue
<MarkdownEditor 
  v-model="content" 
  placeholder="Начните писать статью..." 
/>
```

### height
- **Тип:** `string | number`
- **По умолчанию:** `'500px'`
- **Описание:** Высота редактора

```vue
<MarkdownEditor v-model="content" height="600px" />
<MarkdownEditor v-model="content" :height="600" />
```

### minHeight
- **Тип:** `string | number`
- **По умолчанию:** `undefined`
- **Описание:** Минимальная высота редактора

```vue
<MarkdownEditor v-model="content" min-height="300px" />
```

### maxHeight
- **Тип:** `string | number`
- **По умолчанию:** `undefined`
- **Описание:** Максимальная высота редактора

```vue
<MarkdownEditor v-model="content" max-height="800px" />
```

## Events

### update:modelValue
Вызывается при изменении содержимого

```vue
<MarkdownEditor 
  v-model="content" 
  @update:modelValue="handleUpdate"
/>
```

### change
Вызывается при изменении содержимого (дублирует update:modelValue)

```vue
<MarkdownEditor 
  v-model="content" 
  @change="handleChange"
/>
```

## Примеры использования

### Простой редактор

```vue
<template>
  <q-page padding>
    <MarkdownEditor v-model="article.content" />
    <q-btn label="Сохранить" @click="save" />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const article = ref({
  content: '# Новая статья\n\nНачните писать...'
})

const save = () => {
  console.log('Saving:', article.value.content)
}
</script>
```

### Режим просмотра (preview-only)

```vue
<template>
  <q-page padding>
    <MarkdownEditor 
      v-model="article.content" 
      :preview-only="true"
      height="auto"
      min-height="200px"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const article = ref({
  content: '# Статья\n\nЭто **готовая** статья для просмотра.'
})
</script>
```

### С кастомной высотой и placeholder

```vue
<template>
  <q-card>
    <q-card-section>
      <div class="text-h6">Описание продукта</div>
    </q-card-section>
    <q-card-section>
      <MarkdownEditor 
        v-model="product.description" 
        height="400px"
        placeholder="Опишите продукт в формате Markdown..."
        :preview="true"
      />
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const product = ref({
  description: ''
})
</script>
```

### Переключение между режимами редактирования и просмотра

```vue
<template>
  <q-page padding>
    <div class="q-mb-md">
      <q-btn 
        :label="isEditing ? 'Просмотр' : 'Редактировать'" 
        @click="isEditing = !isEditing"
      />
    </div>
    
    <MarkdownEditor 
      v-model="content" 
      :preview-only="!isEditing"
      :height="isEditing ? '600px' : 'auto'"
    />
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const isEditing = ref(false)
const content = ref('# Заголовок\n\nСодержимое...')
</script>
```

### С обработкой изменений

```vue
<template>
  <q-page padding>
    <MarkdownEditor 
      v-model="content" 
      @change="handleChange"
    />
    <div class="q-mt-md text-caption">
      Символов: {{ content.length }}
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const content = ref('')

const handleChange = (value: string) => {
  console.log('Content changed:', value.length, 'characters')
}
</script>
```

### Интеграция с формой

```vue
<template>
  <q-page padding>
    <q-form @submit="handleSubmit">
      <q-input 
        v-model="form.title" 
        label="Заголовок *"
        outlined
        class="q-mb-md"
      />
      
      <div class="q-mb-md">
        <div class="text-subtitle2 q-mb-sm">Содержание *</div>
        <MarkdownEditor 
          v-model="form.content" 
          height="500px"
        />
      </div>
      
      <q-btn 
        type="submit" 
        label="Создать" 
        color="primary"
      />
    </q-form>
  </q-page>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MarkdownEditor } from '@/shared'

const form = ref({
  title: '',
  content: ''
})

const handleSubmit = () => {
  console.log('Submitting:', form.value)
}
</script>
```

## Особенности

### Автоматическая синхронизация темы

Компонент автоматически переключается между светлой и темной темой при изменении темы Quasar (если `theme="auto"`).

### Toolbar по умолчанию

Компонент использует стандартный toolbar md-editor-v3, который включает:
- Форматирование текста (bold, italic, underline, strikethrough)
- Заголовки (H1-H6)
- Списки (маркированные, нумерованные, задачи)
- Код (inline и блоки)
- Ссылки и изображения
- Таблицы
- Fullscreen режим
- Preview toggle
- Catalog (оглавление)

### Адаптивность

Компонент адаптируется под размер контейнера и корректно работает на мобильных устройствах.

## TypeScript

Компонент полностью типизирован и предоставляет типы для всех props и events.

```typescript
import type { Component } from 'vue'
import MarkdownEditor from '@/shared/ui/markdown-editor/MarkdownEditor.vue'

// Типы props
interface MarkdownEditorProps {
  modelValue: string
  language?: 'en-US' | 'ru-RU' | 'zh-CN'
  theme?: 'light' | 'dark' | 'auto'
  preview?: boolean
  previewOnly?: boolean
  placeholder?: string
  height?: string | number
  minHeight?: string | number
  maxHeight?: string | number
}
```

## Стилизация

Компонент использует стили md-editor-v3 и адаптирует их под Quasar:
- Скругленные углы (border-radius: 4px)
- Адаптация цветов границ под темную тему
- Интеграция с цветовой схемой Quasar

## Зависимости

- `md-editor-v3` - основной редактор
- `quasar` - для определения темы
- `vue` - для реактивности

## Лицензия

Компонент является частью проекта и использует лицензию проекта.
