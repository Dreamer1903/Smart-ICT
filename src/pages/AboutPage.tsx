import React from 'react';
import { 
  Code, 
  Terminal, 
  ShieldCheck, 
  Sparkles, 
  BookOpen, 
  Award, 
  Cpu, 
  CheckCircle, 
  ArrowRight,
  Database,
  GraduationCap
} from 'lucide-react';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Link } from '../router/RouterContext';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-12">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'О платформе' }]} />

      {/* Hero Section */}
      <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-br from-blue-900/40 via-indigo-900/30 to-purple-900/20 border border-blue-500/20 shadow-xl backdrop-blur-md">
        <div className="max-w-3xl space-y-4 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Цифровая школа будущего</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-tight">
            Smart ICT — современная образовательная среда для изучения IT
          </h1>

          <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Платформа кабинета информатики и ИКТ преподавателя Абдугафорова М.Р. 
            Объединяет строгую академическую базу, живую практику на Python в интерактивной песочнице, 
            мотивирующую геймификацию и интеллектуального AI-тьютора.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-4">
            <Link
              to="/lessons"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>Каталог уроков</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/database"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-neutral-200 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-all"
            >
              <Database className="w-4 h-4" />
              <span>Схема БД и архитектура</span>
            </Link>

            <Link
              to="/faq"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
            >
              <span>Частые вопросы (FAQ)</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Ключевые принципы методики
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Обучение выстроено по международным стандартам CS и адаптировано для российских олимпиад и экзаменов
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Практика с первых минут
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Каждый теоретический тезис немедленно закрепляется в браузере: встроенный редактор кода, запуск тестов и мгновенный результат.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              9 форматов в каждом уроке
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Конспекты, интерактивные слайды, видеолекции, методички PDF, автопроверяемые тесты и лабораторные практикумы.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              RAG AI-помощник учителя
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Обучен строго по учебным материалам курса. Помогает ученику найти ошибку, не подсказывая готовое решение задачи.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-neutral-900 dark:text-white">
              Геймификация и ранги
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Опыт (XP), уровни мастерства, серии непрерывных занятий и коллекционные бейджи делают обучение увлекательным.
            </p>
          </div>
        </div>
      </div>

      {/* Curriculum by Grades */}
      <div className="p-8 rounded-3xl bg-neutral-100/70 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 space-y-6">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">
            Учебные параллели и курсы
          </h2>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
            Каждый класс имеет персональную изолированную траекторию обучения
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                7–9 классы
              </span>
              <Cpu className="w-4 h-4 text-neutral-400" />
            </div>
            <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
              Основы программирования и крафтинг
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Переменные, логические ветвления, циклы for/while, списки, базовые алгоритмы и знакомство с микроконтроллерами.
            </p>
            <ul className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Интерактивные задачи с автопроверкой</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Основы алгоритмического мышления</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-blue-500/30 dark:border-blue-500/30 shadow-sm space-y-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-3 py-0.5 rounded-bl-xl text-[10px] font-bold bg-blue-600 text-white">
              ПРОФИЛЬ
            </div>
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                10-C класс
              </span>
              <Terminal className="w-4 h-4 text-blue-500" />
            </div>
            <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
              Олимпиадное программирование
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Асимптотическая сложность Big-O, структуры данных (стеки, очереди, деки), бинарный поиск, рекурсия, графы и динамическое программирование.
            </p>
            <ul className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>Регулярные олимпиадные контесты</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-blue-500" />
                <span>Оптимизация кода по времени и памяти</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                11-B класс
              </span>
              <Code className="w-4 h-4 text-neutral-400" />
            </div>
            <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
              Подготовка к экзаменам и проекты
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Компьютерный ЕГЭ по информатике на Python, реляционные базы данных SQL, web-технологии и выпускные исследовательские проекты.
            </p>
            <ul className="text-[11px] text-neutral-600 dark:text-neutral-400 space-y-1">
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Разбор заданий повышенной сложности</span>
              </li>
              <li className="flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span>Работа с реальными базами данных</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Security & Tech Stack */}
      <div className="p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
              Технологический стек и безопасность персональных данных
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Построено на современных веб-стандартах с защитой на уровне ядра СУБД
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
            <div className="font-bold text-neutral-900 dark:text-white mb-1">Frontend</div>
            <div className="text-neutral-500 dark:text-neutral-400">React 19, TypeScript, Vite, Tailwind CSS, Motion</div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
            <div className="font-bold text-neutral-900 dark:text-white mb-1">Backend & API</div>
            <div className="text-neutral-500 dark:text-neutral-400">Node.js, Express, Sandboxed Python Runner</div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
            <div className="font-bold text-neutral-900 dark:text-white mb-1">База данных & RLS</div>
            <div className="text-neutral-500 dark:text-neutral-400">PostgreSQL 16, Supabase, Row-Level Security</div>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
            <div className="font-bold text-neutral-900 dark:text-white mb-1">Искусственный интеллект</div>
            <div className="text-neutral-500 dark:text-neutral-400">Google Gemini 3.8 Flash RAG ассистент</div>
          </div>
        </div>
      </div>

    </div>
  );
};
