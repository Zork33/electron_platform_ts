import type { RouteRecordRaw } from 'vue-router';

// Расширяем типы meta для роутов
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    isPublic?: boolean;
    isAuthPage?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [{ path: '', component: () => import('page/IndexPage.vue') }],
  },

  // Аутентификация (публичные страницы)
  {
    path: '/auth',
    component: () => import('layout/AuthLayout.vue'),
    meta: { isPublic: true, isAuthPage: true },
    children: [
      {
        path: '',
        name: 'auth-select',
        component: () => import('page/auth/AuthSelectPage.vue'),
        meta: { isPublic: true, isAuthPage: true }
      },
      {
        path: 'login',
        name: 'login',
        component: () => import('page/auth/LoginPage.vue'),
        meta: { isPublic: true, isAuthPage: true }
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('page/auth/RegisterPage.vue'),
        meta: { isPublic: true, isAuthPage: true }
      }
    ]
  },

  // Бизнес-логика (требует авторизации)
  {
    path: '/person',
    name: 'persons',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/person/PersonListPage.vue') },
      { path: ':id', component: () => import('page/person/PersonDetailPage.vue') }
    ]
  },

  {
    path: '/user',
    name: 'users',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/user/UserListPage.vue') },
      { path: ':id', component: () => import('page/user/UserDetailPage.vue') }
    ]
  },

  // Система (требует авторизации)
  {
    path: '/system/file-manager',
    name: 'file-manager',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/file-manager/FileManagerPage.vue') }
    ]
  },
  {
    path: '/system/file-storage',
    name: 'file-storage',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/file-storage/FileStoragePage.vue') }
    ]
  },
  {
    path: '/system/object-container',
    name: 'object-container',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/object-container/ObjectContainerPage.vue') }
    ]
  },
  {
    path: '/system/ws-pool',
    name: 'ws-pool',
    component: () => import('layout/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('page/ws-pool/WsPoolPage.vue') }
    ]
  },

  {
    path: '/:catchAll(.*)*',
    component: () => import('page/ErrorNotFound.vue'),
    meta: { isPublic: true }
  }
];

export default routes;
