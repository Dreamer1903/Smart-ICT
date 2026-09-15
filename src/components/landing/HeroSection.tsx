import React from 'react';
import {
  Sparkles,
  ArrowRight,
  BookOpen,
  Terminal,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Flame,
  Award,
  FileCode,
  Users
} from 'lucide-react';
import { SchoolClass, Subject, Lesson, Announcement, User } from '../../types';

interface HeroSectionProps {
  onOpenAuth: () => void;
  onExploreLessons: () => void;
  classes: SchoolClass[];
  subjects: Subject[];
  lessons: Lesson[];
  announcements: Announcement[];
  currentUser: User;
  onSelectLesson: (lesson: Lesson) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenAuth,
  onExploreLessons,
  classes,
  subjects,
  lessons,
  announcements,
  currentUser,
  onSelectLesson
}) => {
  return (
    <div className="space-y-16 pb-16">
      
      {/* Hero Header */}
      <section className="relative overflow-hidden pt-12 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
        
        {/* Background glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/15 blur-3xl rounded-full pointer-events-none" />
        
        {/* Badge */}
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Образовательная платформа нового поколения</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-white leading-[1.1] mb-6">
          Персональная LMS <br />
          <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
            преподавателя информатики
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-300 max-w-2xl mx-auto leading-relaxed mb-8">
          Уровень Google Classroom + Notion + Canvas. Интерактивные конспекты, автопроверка кода Python, структурированные уроки с 9 карточками материалов, AI-помощник и геймификация.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <button
            id="hero-cta-start"
            onClick={onExploreLessons}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all flex items-center space-x-2"
          >
            <span>Перейти к урокам</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            id="hero-cta-auth"
            onClick={onOpenAuth}
            className="px-6 py-3 rounded-xl font-semibold text-sm border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 shadow-sm transition-all flex items-center space-x-2"
          >
            <Users className="w-4 h-4 text-blue-500" />
            <span>Сменить роль / Регистрация</span>
          </button>
        </div>

        {/* Live Features Strip */}
        <div className="mt-12 pt-8 border-t border-neutral-200/60 dark:border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 backdrop-blur-sm">
            <div className="text-xl font-black text-blue-600 dark:text-blue-400">7 Классов</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Строгая RLS изоляция (7A, 10C, 11B...)</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 backdrop-blur-sm">
            <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">9 Карточек</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">В каждом уроке (Конспект, Лаба, AI, ДЗ)</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 backdrop-blur-sm">
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">100% Онлайн</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Песочница Python и тесты с таймером</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 backdrop-blur-sm">
            <div className="text-xl font-black text-amber-500">RAG AI</div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Ассистент знает методику учителя</div>
          </div>
        </div>
      </section>

      {/* 9-Card Architecture Showcase */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Анатомия каждого урока: 9 интерактивных карточек
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl mx-auto">
            Никаких скучных ссылок — ученик получает законченную образовательную экосистему внутри одного экрана.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
          {[
            { icon: '📖', label: 'Конспект', desc: 'Синтаксис и теория' },
            { icon: '🖥', label: 'Слайды', desc: 'Презентация в браузере' },
            { icon: '🎥', label: 'Видео', desc: 'Таймкоды и разбор' },
            { icon: '📄', label: 'PDF', desc: 'Методичка урока' },
            { icon: '🧪', label: 'Практика', desc: 'Python песочница' },
            { icon: '🏠', label: 'Домашка', desc: 'Drag & Drop загрузка' },
            { icon: '📚', label: 'Доп. материалы', desc: 'Книги и статьи' },
            { icon: '📝', label: 'Тест', desc: 'Автопроверка и таймер' },
            { icon: '🤖', label: 'AI Тьютор', desc: 'Ответы без галлюцинаций' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center hover:border-blue-500/60 transition-all hover:shadow-md"
            >
              <div className="text-2xl mb-1.5">{item.icon}</div>
              <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{item.label}</div>
              <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Subjects Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Учебные направления
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Программы с 5 по 11 класс с возможностью масштабирования
            </p>
          </div>
          <button
            onClick={onExploreLessons}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
          >
            <span>Все уроки</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subjects.map((sub) => (
            <div
              key={sub.id}
              onClick={onExploreLessons}
              className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 transition-all shadow-sm cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: sub.color }}
                  >
                    {sub.slug === 'cs' ? <Terminal className="w-6 h-6" /> : <Cpu className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {sub.name}
                    </h3>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {sub.lessonCount} тематических модулей
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                  5 — 11 класс
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-4 leading-relaxed">
                {sub.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent Lessons & Announcements */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Lessons List Preview */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Последние опубликованные уроки</span>
              </h2>
            </div>

            <div className="space-y-3">
              {lessons.slice(0, 3).map((les) => (
                <div
                  key={les.id}
                  onClick={() => onSelectLesson(les)}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 transition-all cursor-pointer flex items-center justify-between group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded-md bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {les.grade} класс · Урок #{les.orderNumber}
                      </span>
                      <span className="text-xs text-neutral-400">{les.date}</span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {les.title}
                    </h4>
                    <p className="text-xs text-neutral-500 line-clamp-1">{les.description}</p>
                  </div>
                  <div className="p-2 rounded-xl text-neutral-400 group-hover:text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements / Board */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              <span>Объявления и события</span>
            </h2>

            <div className="space-y-3">
              {announcements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      {ann.pinned ? '📌 Важное объявление' : 'Событие'}
                    </span>
                    <span className="text-[10px] text-neutral-400">{ann.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {ann.title}
                  </h4>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="text-[10px] text-neutral-400 pt-1">
                    Автор: {ann.authorName}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
};
