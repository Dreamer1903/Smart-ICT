import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Clock,
  CheckCircle2,
  Lock,
  Sparkles,
  Terminal,
  Cpu
} from 'lucide-react';
import { Lesson, SchoolClass, Subject, User } from '../../types';
import { Breadcrumbs } from '../layout/Breadcrumbs';

interface LessonListProps {
  lessons: Lesson[];
  classes: SchoolClass[];
  subjects: Subject[];
  currentUser: User;
  onSelectLesson: (lesson: Lesson) => void;
  onCreateLesson: () => void;
}

export const LessonList: React.FC<LessonListProps> = ({
  lessons = [],
  classes = [],
  subjects = [],
  currentUser,
  onSelectLesson,
  onCreateLesson
}) => {
  const isStudent = currentUser?.role === 'student';
  const safeClasses = classes || [];
  const safeLessons = lessons || [];
  const safeSubjects = subjects || [];

  const studentClass = safeClasses.find(c => c.id === currentUser?.classId);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    isStudent && currentUser?.classId ? currentUser.classId : 'all'
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Strict filtering for students per prompt requirements:
  // "После регистрации получают доступ только к своему классу. Например 7A или 10C или 11B. После входа ученик видит только свои уроки."
  const filteredLessons = useMemo(() => {
    return safeLessons.filter((les) => {
      const lessonClassIds = les.classIds || [];
      // 1. Student class lock
      if (isStudent && currentUser?.classId) {
        if (!lessonClassIds.includes(currentUser.classId)) {
          return false;
        }
      } else if (selectedClassId !== 'all') {
        if (!lessonClassIds.includes(selectedClassId)) {
          return false;
        }
      }

      // 2. Subject filter
      if (selectedSubjectId !== 'all' && les.subjectId !== selectedSubjectId) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = les.title.toLowerCase().includes(q);
        const matchTopic = les.topic.toLowerCase().includes(q);
        const matchDesc = les.description.toLowerCase().includes(q);
        if (!matchTitle && !matchTopic && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [lessons, isStudent, currentUser.classId, selectedClassId, selectedSubjectId, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Каталог уроков' }]} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              Учебная программа
            </span>
            {isStudent && studentClass && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                🔒 Защищенный доступ: Класс {studentClass.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white mt-1">
            {isStudent ? `Уроки для ${studentClass?.name || 'вашего'} класса` : 'Каталог уроков и материалов'}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {isStudent
              ? 'Материалы подобраны строго в соответствии с календарно-тематическим планом вашего класса.'
              : 'Управление уроками по информатике и крафтингу для всех классов школы.'}
          </p>
        </div>

        {currentUser.role !== 'student' && (
          <button
            onClick={onCreateLesson}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Создать новый урок</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-center gap-3">
        
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Поиск по темам, алгоритмам или ключевым словам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Class Filter (only for Teachers/Admins) */}
        {!isStudent && (
          <div className="w-full md:w-48">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            >
              <option value="all">Все классы</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>Класс {c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Subject Filter */}
        <div className="w-full md:w-56">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          >
            <option value="all">Все предметы</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Lessons Grid */}
      {filteredLessons.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
          <BookOpen className="w-10 h-10 text-neutral-400 mx-auto" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            Уроки не найдены
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            По заданным фильтрам уроки отсутствуют. Попробуйте сбросить параметры поиска.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLessons.map((lesson) => {
            const isCompleted = currentUser.completedLessons.includes(lesson.id);
            const lessonSubject = subjects.find(s => s.id === lesson.subjectId);

            return (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson)}
                className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Tags Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        {lesson.grade} класс · #{lesson.orderNumber}
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {lesson.date}
                      </span>
                    </div>

                    {isCompleted ? (
                      <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Изучено</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-neutral-400 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{lesson.durationMinutes}м</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Topic */}
                  <div>
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                      {lesson.topic}
                    </span>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors mt-0.5">
                      {lesson.title}
                    </h3>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                    {lesson.description}
                  </p>

                  {/* 9-Card Indicator Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      📖 Конспект
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      🧪 Python
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      📝 Тест
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      🏠 ДЗ
                    </span>
                  </div>
                </div>

                {/* Footer action */}
                <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  <span className="flex items-center space-x-1 text-neutral-400 text-[11px]">
                    {lesson.subjectId === 'sub-crafting' ? <Cpu className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                    <span>{lessonSubject?.name || 'Информатика'}</span>
                  </span>

                  <span className="text-blue-600 dark:text-blue-400 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
                    <span>Открыть материалы</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
