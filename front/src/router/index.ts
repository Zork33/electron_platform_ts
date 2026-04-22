import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { getAccessToken, isTokenExpired } from '../shared/lib/cookies';

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

// Проверка валидности токена (есть токен и не истёк)
const isTokenValid = (): boolean => {
  const token = getAccessToken();
  if (!token) return false;
  return !isTokenExpired();
};

export default defineRouter(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory);

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Navigation guard for authentication
  Router.beforeEach((to) => {
    const isAuthenticated = isTokenValid();
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
    const isAuthPage = to.matched.some(record => record.meta.isAuthPage);

    // Если пользователь авторизован и пытается зайти на страницу авторизации
    // Редиректим на главную
    if (isAuthenticated && isAuthPage) {
      return '/';
    }

    // Если страница требует авторизации и пользователь не авторизован
    if (requiresAuth && !isAuthenticated) {
      // Сохраняем URL для редиректа после авторизации
      const redirectPath = to.fullPath !== '/' ? to.fullPath : null;
      if (redirectPath) {
        return { path: '/auth', query: { redirect: redirectPath } };
      }
      return '/auth';
    }

    // Пропускаем навигацию
    return true;
  });

  return Router;
});
