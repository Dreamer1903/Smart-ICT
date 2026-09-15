import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Lesson, SchoolClass, User } from '../../types';

interface CalendarViewProps {
  lessons: Lesson[];
  currentUser: User;
  classes: SchoolClass[];
  onSelectLesson: (lesson: Lesson) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  lessons = [],
  currentUser,
  classes = [],
  onSelectLesson
}) => {
  const [filterType, setFilterType] = useState<'all' | 'lesson' | 'homework' | 'test'>('all');
  const safeClasses = classes || [];

  // Build timeline items
  const timelineEvents = [
    {
      id: 'ev-1',
      date: '10 октября 2026',
      time: '09:00 - 09:45',
      type: 'lesson',
      title: 'Урок №1: Структуры данных и асимптотика Big-O',
      class: '10-C',
      lessonId: 'les-1',
      badge: 'Лекция & Практика'
    },
    {
      id: 'ev-2',
      date: '12 октября 2026',
      time: '11:00 - 11:45',
      type: 'lesson',
      title: 'Урок №2: Стек (LIFO) и Очередь (FIFO) на Python',
      class: '10-C',
      lessonId: 'les-2',
      badge: 'Практическая лаба'
    },
    {
      id: 'ev-3',
      date: '15 октября 2026',
      time: '23:59',
      type: 'homework',
      title: 'Дедлайн сдачи ДЗ: Проверка сбалансированности скобок',
      class: '10-C',
      lessonId: 'les-1',
      badge: 'Крайний срок (100 баллов)'
    },
    {
      id: 'ev-4',
      date: '16 октября 2026',
      time: '10:00 - 10:30',
      type: 'test',
      title: 'Тест: Временная сложность базовых структур данных',
      class: '10-C',
      lessonId: 'les-1',
      badge: 'Ограничение 15 мин'
    },
    {
      id: 'ev-5',
      date: '18 октября 2026',
      time: '12:00 - 12:45',
      type: 'lesson',
      title: 'Урок №1: Основы синтаксиса и переменные Python',
      class: '7-A',
      lessonId: 'les-3',
      badge: 'Вводный урок'
    }
  ];

  const filteredEvents = timelineEvents.filter(ev => {
    if (filterType !== 'all' && ev.type !== filterType) return false;
    if (currentUser?.role === 'student' && currentUser?.classId) {
      const clsName = safeClasses.find(c => c.id === currentUser.classId)?.name;
      if (clsName && ev.class !== clsName) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Расписание и события
            </span>
            <span className="text-xs text-neutral-400">1 четверть 2026/2027</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white mt-1">
            Календарь занятий и дедлайнов 📅
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Следите за датами онлайн-уроков, контрольными точками и сроками сдачи домашних работ
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'all'
                ? 'bg-white dark:bg-neutral-900 shadow-sm text-neutral-900 dark:text-white'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Все события
          </button>
          <button
            onClick={() => setFilterType('lesson')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'lesson'
                ? 'bg-white dark:bg-neutral-900 shadow-sm text-blue-600 dark:text-blue-400'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Уроки
          </button>
          <button
            onClick={() => setFilterType('homework')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'homework'
                ? 'bg-white dark:bg-neutral-900 shadow-sm text-amber-600 dark:text-amber-400'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Дедлайны ДЗ
          </button>
          <button
            onClick={() => setFilterType('test')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'test'
                ? 'bg-white dark:bg-neutral-900 shadow-sm text-emerald-600 dark:text-emerald-400'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Тесты
          </button>
        </div>
      </div>

      {/* Timeline List */}
      <div className="space-y-4">
        {filteredEvents.map((ev) => {
          const matchingLesson = lessons.find(l => l.id === ev.lessonId);
          return (
            <div
              key={ev.id}
              onClick={() => matchingLesson && onSelectLesson(matchingLesson)}
              className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 transition-all shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  ev.type === 'homework'
                    ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600'
                    : ev.type === 'test'
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600'
                    : 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'
                }`}>
                  {ev.type === 'homework' ? (
                    <FileCheck className="w-5 h-5" />
                  ) : ev.type === 'test' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <BookOpen className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      {ev.date}
                    </span>
                    <span className="text-xs text-neutral-400">· {ev.time}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      Класс {ev.class}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                    {ev.title}
                  </h3>

                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-2">
                    <span>{ev.badge}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                  Перейти к уроку →
                </span>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
