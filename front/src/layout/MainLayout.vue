<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar class="toolbar-custom">
        <q-btn flat dense round icon="menu" @click="leftDrawerOpen = !leftDrawerOpen" />
        <q-toolbar-title>
          <router-link to="/" class="toolbar-brand-link">
            Electron Platform
          </router-link>
        </q-toolbar-title>
        <DarkModeToggle />
        <q-btn
          flat
          round
          icon="logout"
          color="primary"
        >
          <q-menu
            anchor="bottom end"
            self="top end"
          >
            <q-list style="min-width: 200px">
              <q-item clickable v-close-popup @click="logoutFromDevice">
                <q-item-section avatar>
                  <q-icon name="logout" />
                </q-item-section>
                <q-item-section>
                  <q-item-label>Выйти</q-item-label>
                  <q-item-label caption>Выйти с этого устройства</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-menu>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- Левый выдвижной Drawer -->
    <q-drawer show-if-above v-model="leftDrawerOpen" side="left" bordered :width="240" :style="{ color: menuTextColor }">
      <q-scroll-area style="height: 100%">
      <q-list padding class="menu-list">
        <router-link to="/person" style="text-decoration: none; color: inherit">
          <q-item clickable v-ripple class="menu-item">
            <q-item-section avatar>
              <q-icon name="people" size="24px" />
            </q-item-section>
            <q-item-section>Персоны</q-item-section>
          </q-item>
        </router-link>

        <q-expansion-item icon="settings" label="Система" expand-icon-class="expansion-icon" class="menu-expansion">
          <q-list class="menu-sublist">
            <router-link to="/user" style="text-decoration: none; color: inherit">
              <q-item clickable v-ripple dense class="menu-subitem">
                <q-item-section avatar>
                  <q-icon name="person" size="24px" />
                </q-item-section>
                <q-item-section>Пользователи</q-item-section>
              </q-item>
            </router-link>
            <router-link to="/system/file-manager" style="text-decoration: none; color: inherit">
              <q-item clickable v-ripple dense class="menu-subitem">
                <q-item-section avatar>
                  <q-icon name="folder_open" size="20px" />
                </q-item-section>
                <q-item-section>Файловый менеджер</q-item-section>
              </q-item>
            </router-link>
            <router-link to="/system/file-storage" style="text-decoration: none; color: inherit">
              <q-item clickable v-ripple dense class="menu-subitem">
                <q-item-section avatar>
                  <q-icon name="storage" size="20px" />
                </q-item-section>
                <q-item-section>Файловое хранилище</q-item-section>
              </q-item>
            </router-link>
            <router-link to="/system/object-container" style="text-decoration: none; color: inherit">
              <q-item clickable v-ripple dense class="menu-subitem">
                <q-item-section avatar>
                  <q-icon name="inventory_2" size="20px" />
                </q-item-section>
                <q-item-section>Контейнер объектов</q-item-section>
              </q-item>
            </router-link>
            <router-link to="/system/ws-pool" style="text-decoration: none; color: inherit">
              <q-item clickable v-ripple dense class="menu-subitem">
                <q-item-section avatar>
                  <q-icon name="cable" size="20px" />
                </q-item-section>
                <q-item-section>
                  WebSocket пул
                </q-item-section>
              </q-item>
            </router-link>
          </q-list>
        </q-expansion-item>

      </q-list>
      </q-scroll-area>
    </q-drawer>
    <!-- Основная часть приложения (router-view) -->
    <q-page-container class="main-container">
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAuth } from '../shared/composable/useAuth'
import { useWebSocket } from '../shared/composable/useWebSocket'
import DarkModeToggle from '../shared/ui/DarkModeToggle.vue'

const leftDrawerOpen = ref(false)
const { logoutFromDevice } = useAuth()
const { connect: wsConnect, disconnect: wsDisconnect } = useWebSocket()

onMounted(() => wsConnect())
onUnmounted(() => wsDisconnect())

const menuTextColor = 'var(--q-text-menu)'
</script>

<style lang="scss" scoped>
.toolbar-custom {
  background-color: var(--q-bg-card, white) !important;
  color: black !important;

  .body--dark & {
    background-color: var(--q-bg-card, #262d38) !important;
    color: var(--q-text-primary, #e7eaef) !important;
  }
}

.main-container {
  :deep(.q-page) {
    padding: 16px;
  }
}

.menu-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
}

.menu-item {
  justify-content: flex-start;
  padding-left: 12px;
  color: var(--q-text-secondary) !important;

  :deep(.q-item__section--avatar) {
    min-width: 40px;
  }
}

.menu-expansion {
  :deep(.q-item) {
    justify-content: flex-start;
    padding-left: 12px;
    color: var(--q-text-secondary) !important;
  }

  :deep(.q-item__section--avatar) {
    min-width: 40px;
  }
}

.menu-sublist {
  padding-left: 0;
}

.menu-subitem {
  padding-left: 28px !important;
  min-height: 40px;
  color: var(--q-text-secondary) !important;

  :deep(.q-item__section--avatar) {
    min-width: 36px;
    padding-left: 8px;
  }
}


</style>

<style lang="scss">
.q-layout {
  height: 100vh !important;
  overflow: hidden !important;
}

.main-container.q-page-container {
  height: 100vh;
  box-sizing: border-box;
  overflow-y: auto;
}

.main-container .q-page {
  min-height: unset !important;
}
</style>
