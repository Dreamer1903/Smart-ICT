import React from 'react';
import { AlertTriangle, Home, BookOpen, Search, ArrowLeft } from 'lucide-react';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Link } from '../router/RouterContext';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: '404 — Страница не найдена' }]} />

      <div className="text-center py-16 px-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
          <AlertTriangle className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Ошибка 404
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 dark:text-white">
            Страница не найдена
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
            К сожалению, запрошенный раздел платформы не существует, был перемещен или ссылка устарела.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Вернуться на главную</span>
          </Link>

          <Link
            to="/lessons"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Каталог уроков</span>
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
          >
            <span>В личный кабинет</span>
          </Link>
        </div>
      </div>

    </div>
  );
};
