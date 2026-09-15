import React from 'react';
import {
  BookOpen,
  FileCheck,
  Flame,
  Award,
  Clock,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle2,
  Calendar as CalendarIcon,
  Bot
} from 'lucide-react';
import { User, SchoolClass, Lesson, HomeworkSubmission, GamificationBadge } from '../../types';

interface StudentDashboardProps {
  currentUser: User;
  currentClass?: SchoolClass;
  classLessons: Lesson[];
  submissions: HomeworkSubmission[];
  badges: GamificationBadge[];
  onSelectLesson: (lesson: Lesson) => void;
  onOpenAiAssistant: (lesson?: Lesson) => void;
  onSelectTab: (tab: string) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  currentClass,
  classLessons = [],
  submissions = [],
  badges = [],
  onSelectLesson,
  onOpenAiAssistant,
  onSelectTab
}) => {
  const safeClassLessons = classLessons || [];
  const safeSubmissions = submissions || [];
  const safeBadges = badges || [];

  const completedLessonsCount = (currentUser?.completedLessons || []).length;
  const totalLessonsCount = safeClassLessons.length;
  const progressPercent = totalLessonsCount > 0 
    ? Math.round((completedLessonsCount / totalLessonsCount) * 100) 
    : 0;

  const mySubmissions = safeSubmissions.filter(s => s.studentId === currentUser?.id);
  const gradedSubmissions = mySubmissions.filter(s => s.status === 'graded');
  const avgScore = gradedSubmissions.length > 0
    ? Math.round(gradedSubmissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / gradedSubmissions.length)
    : 95;

  const unlockedBadges = safeBadges.filter(b => b.unlocked);

  // Next upcoming lesson
  const activeLesson = safeClassLessons[0] || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Personalized Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white p-6 sm:p-8 shadow-xl shadow-blue-500/15">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Класс {currentClass?.name || '10-C'} · Информатика & Алгоритмы</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Добро пожаловать, {currentUser.name}! 👋
            </h1>
            
            <p className="text-sm text-blue-100 max-w-xl leading-relaxed">
              Сегодня в расписании: <strong>2 урока</strong>, <strong>1 домашнее задание</strong> с дедлайном и <strong>1 онлайн-тест</strong>. Отличный день для изучения структур данных!
            </p>
          </div>

          {/* Quick Metrics Capsule */}
          <div className="flex items-center space-x-4 bg-black/20 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/10">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-1 text-orange-400 font-extrabold text-xl">
                <Flame className="w-5 h-5 fill-orange-400" />
                <span>{currentUser.streakDays}</span>
              </div>
              <div className="text-[10px] text-blue-200 uppercase font-semibold">Серия дней</div>
            </div>

            <div className="h-8 w-px bg-white/20" />

            <div className="text-center">
              <div className="text-xl font-extrabold text-amber-300">
                {currentUser.xp} <span className="text-xs font-normal">XP</span>
              </div>
              <div className="text-[10px] text-blue-200 uppercase font-semibold">Уровень {currentUser.level}</div>
            </div>

            <div className="h-8 w-px bg-white/20" />

            <div className="text-center">
              <div className="text-xl font-extrabold text-emerald-300">
                {avgScore}%
              </div>
              <div className="text-[10px] text-blue-200 uppercase font-semibold">Ср. балл</div>
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-6 pt-4 border-t border-white/15">
          <div className="flex justify-between text-xs text-blue-100 mb-1.5 font-medium">
            <span>Прогресс до {currentUser.level + 1} уровня</span>
            <span>{currentUser.xp % 500} / 500 XP</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-1000"
              style={{ width: `${((currentUser.xp % 500) / 500) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Today's Agenda & Quick Launch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Lessons & Homework */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Current Lesson Hero Card */}
          {activeLesson && (
            <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                    Текущий урок #{activeLesson.orderNumber}
                  </span>
                  <span className="text-xs text-neutral-400 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{activeLesson.durationMinutes} мин</span>
                  </span>
                </div>
                <button
                  onClick={() => onOpenAiAssistant(activeLesson)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                >
                  <Bot className="w-4 h-4" />
                  <span>Спросить AI по уроку</span>
                </button>
              </div>

              <div>
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {activeLesson.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                  {activeLesson.description}
                </p>
              </div>

              {/* 9 Cards Quick Chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  📖 Конспект
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  🖥 Презентация
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  🧪 Python Лаба
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  📝 Тест с таймером
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  🏠 ДЗ на проверку
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-neutral-800">
                <div className="text-xs text-neutral-500">
                  Статус: {currentUser.completedLessons.includes(activeLesson.id) ? (
                    <span className="text-emerald-600 font-semibold flex items-center space-x-1 inline-flex">
                      <CheckCircle2 className="w-3.5 h-3.5" /> <span>Изучено</span>
                    </span>
                  ) : (
                    <span className="text-amber-500 font-semibold">В процессе изучения</span>
                  )}
                </div>

                <button
                  id="btn-open-lesson-active"
                  onClick={() => onSelectLesson(activeLesson)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Открыть все материалы</span>
                </button>
              </div>
            </div>
          )}

          {/* Lessons for Class */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Все уроки для класса {currentClass?.name}</span>
              </h3>
              <button
                onClick={() => onSelectTab('lessons')}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Открыть каталог
              </button>
            </div>

            <div className="space-y-2">
              {classLessons.map((les) => {
                const isCompleted = currentUser.completedLessons.includes(les.id);
                return (
                  <div
                    key={les.id}
                    onClick={() => onSelectLesson(les)}
                    className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          Урок #{les.orderNumber}
                        </span>
                        <span className="text-xs text-neutral-400">{les.topic}</span>
                      </div>
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {les.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-3">
                      {isCompleted && (
                        <span className="p-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                      <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Col: Student Stats & Homework Status */}
        <div className="space-y-6">
          
          {/* Progress Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-500" />
              <span>Успеваемость и прогресс</span>
            </h3>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-black text-neutral-900 dark:text-white">
                  {progressPercent}%
                </div>
                <div className="text-xs text-neutral-500">Курса пройдено</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {completedLessonsCount} / {totalLessonsCount}
                </div>
                <div className="text-xs text-neutral-500">Уроков завершено</div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Сданных домашних заданий:</span>
                <strong className="text-neutral-900 dark:text-neutral-100">{mySubmissions.length}</strong>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Средняя оценка за работы:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{avgScore} из 100</strong>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Получено достижений:</span>
                <strong className="text-amber-500">{unlockedBadges.length} значков</strong>
              </div>
            </div>
          </div>

          {/* Unlocked Badges Showcase */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Достижения ученика
              </h3>
              <button
                onClick={() => onSelectTab('gamification')}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Все
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {badges.slice(0, 3).map((badge) => (
                <div
                  key={badge.id}
                  className={`p-2.5 rounded-2xl border text-center transition-all ${
                    badge.unlocked
                      ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
                      : 'opacity-40 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="text-xl mb-1">
                    {badge.category === 'streak' ? '🔥' : badge.category === 'python' ? '🐍' : '🏆'}
                  </div>
                  <div className="text-[10px] font-bold line-clamp-1">{badge.title}</div>
                  <div className="text-[9px] text-neutral-500">+{badge.xpReward} XP</div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Helper Quick Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-neutral-900 border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                  AI Помощник учителя
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Знает материалы уроков и синтаксис Python
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              Не понимаете ошибку в коде или хотите разобрать алгоритм проще? Спросите виртуального тьютора!
            </p>

            <button
              id="btn-quick-ai-ask"
              onClick={() => onOpenAiAssistant(activeLesson || undefined)}
              className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-white dark:bg-neutral-800 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-50 transition-colors flex items-center justify-center space-x-1.5"
            >
              <span>Задать вопрос по теме урока</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};
