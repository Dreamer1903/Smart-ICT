import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  ArrowRight, 
  Upload, 
  MessageSquare, 
  Calendar,
  ExternalLink,
  Award
} from 'lucide-react';
import { Lesson, User, HomeworkSubmission, SchoolClass } from '../types';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Link } from '../router/RouterContext';

interface HomeworkPageProps {
  currentUser: User;
  lessons: Lesson[];
  submissions: HomeworkSubmission[];
  classes: SchoolClass[];
  onReviewSubmission?: (sub: HomeworkSubmission) => void;
  onOpenLesson: (lesson: Lesson) => void;
}

export const HomeworkPage: React.FC<HomeworkPageProps> = ({
  currentUser,
  lessons = [],
  submissions = [],
  classes = [],
  onReviewSubmission,
  onOpenLesson
}) => {
  const isTeacher = currentUser?.role === 'teacher' || currentUser?.role === 'admin';
  const isStudent = currentUser?.role === 'student';

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'graded' | 'needs_revision'>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const safeClasses = classes || [];
  const safeLessons = lessons || [];
  const safeSubmissions = submissions || [];

  // Get current student's class
  const studentClass = safeClasses.find(c => c.id === currentUser?.classId);

  // Available lessons for current student or all for teacher
  const relevantLessons = useMemo(() => {
    if (isStudent && currentUser?.classId) {
      return safeLessons.filter(l => (l.classIds || []).includes(currentUser.classId!));
    }
    return safeLessons;
  }, [safeLessons, currentUser, isStudent]);

  // Combined student homework items (lesson + submission status)
  const studentHomeworkItems = useMemo(() => {
    return relevantLessons.map(lesson => {
      const sub = safeSubmissions.find(s => s.lessonId === lesson.id && s.studentId === currentUser?.id);
      return {
        lesson,
        submission: sub,
        status: sub ? sub.status : 'pending'
      };
    });
  }, [relevantLessons, safeSubmissions, currentUser]);

  // Filtered student items
  const filteredStudentItems = useMemo(() => {
    return studentHomeworkItems.filter(item => {
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.lesson.title.toLowerCase().includes(q);
        const inHw = item.lesson.homework.title.toLowerCase().includes(q);
        return inTitle || inHw;
      }
      return true;
    });
  }, [studentHomeworkItems, statusFilter, searchQuery]);

  // Filtered teacher submissions
  const filteredTeacherSubmissions = useMemo(() => {
    return submissions.filter(sub => {
      if (classFilter !== 'all' && sub.classId !== classFilter) {
        return false;
      }
      if (statusFilter !== 'all' && sub.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inStudent = sub.studentName.toLowerCase().includes(q);
        const inLesson = sub.lessonTitle.toLowerCase().includes(q);
        return inStudent || inLesson;
      }
      return true;
    });
  }, [submissions, classFilter, statusFilter, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Домашние задания' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
              Центр домашних заданий
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {isStudent ? (studentClass ? `Класс ${studentClass.name}` : 'Ученик') : 'Преподаватель'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            {isStudent 
              ? 'Отслеживайте дедлайны, проверяйте рецензии учителя и сдавайте практические работы' 
              : 'Проверяйте сданные работы учащихся, выставляйте баллы и отправляйте рекомендации'}
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center space-x-2 text-xs">
          {isStudent ? (
            <>
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-neutral-500">К сдаче:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {studentHomeworkItems.filter(i => i.status === 'pending').length}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-neutral-500">Оценено:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {studentHomeworkItems.filter(i => i.status === 'graded').length}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-neutral-500">На проверке:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {submissions.filter(s => s.status === 'submitted').length}
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-neutral-500">Проверено:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {submissions.filter(s => s.status === 'graded').length}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
        
        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Все работы
          </button>

          {isStudent && (
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === 'pending'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Ожидают сдачи
            </button>
          )}

          <button
            onClick={() => setStatusFilter('submitted')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === 'submitted'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            На проверке
          </button>

          <button
            onClick={() => setStatusFilter('graded')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === 'graded'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Проверено
          </button>

          <button
            onClick={() => setStatusFilter('needs_revision')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === 'needs_revision'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
          >
            Доработка
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* Class Filter (For Teacher) */}
          {isTeacher && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800 border-0 text-neutral-800 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Все классы</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>Класс {c.name}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по уроку или ученику..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-neutral-100 dark:bg-neutral-800 border-0 focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content List */}
      {isStudent ? (
        /* Student View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStudentItems.length === 0 ? (
            <div className="col-span-2 p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <FileText className="w-8 h-8 text-neutral-400 mx-auto" />
              <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                Нет заданий по выбранным фильтрам
              </div>
              <p className="text-xs text-neutral-500">
                Переключите вкладку фильтра или сбросьте поиск
              </p>
            </div>
          ) : (
            filteredStudentItems.map(({ lesson, submission, status }) => {
              return (
                <div
                  key={lesson.id}
                  className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        {lesson.topic}
                      </span>

                      {/* Status Badge */}
                      {status === 'graded' && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Оценка: {submission?.score} / {submission?.maxScore}</span>
                        </span>
                      )}

                      {status === 'submitted' && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          <Clock className="w-3 h-3" />
                          <span>На проверке у учителя</span>
                        </span>
                      )}

                      {status === 'needs_revision' && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="w-3 h-3" />
                          <span>Требует доработки</span>
                        </span>
                      )}

                      {status === 'pending' && (
                        <span className="inline-flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                          <Upload className="w-3 h-3" />
                          <span>Не сдано</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                      {lesson.homework.title || lesson.title}
                    </h3>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                      {lesson.homework.description}
                    </p>

                    <div className="flex items-center space-x-3 text-xs text-neutral-400 pt-1">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Дедлайн: {lesson.homework.deadline}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Award className="w-3.5 h-3.5 text-amber-500" />
                        <span>Макс. балл: {lesson.homework.maxScore}</span>
                      </div>
                    </div>

                    {/* Teacher feedback if present */}
                    {submission?.teacherFeedback && (
                      <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-1">
                        <div className="flex items-center space-x-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                          <MessageSquare className="w-3 h-3" />
                          <span>Отзыв преподавателя:</span>
                        </div>
                        <p className="text-xs text-neutral-700 dark:text-neutral-300 italic">
                          «{submission.teacherFeedback}»
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                    <span className="text-[11px] text-neutral-400">
                      {submission ? `Сдано: ${submission.submittedAt}` : 'Работа не отправлена'}
                    </span>

                    <Link
                      to={`/lessons/${lesson.id}`}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-all"
                    >
                      <span>{submission ? 'Перейти к уроку' : 'Сдать работу'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Teacher Review Queue View */
        <div className="space-y-3">
          {filteredTeacherSubmissions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="font-semibold text-neutral-900 dark:text-white text-sm">
                Все работы проверены!
              </div>
              <p className="text-xs text-neutral-500">
                Нет домашних заданий, ожидающих вашего внимания
              </p>
            </div>
          ) : (
            filteredTeacherSubmissions.map(sub => {
              const subClass = classes.find(c => c.id === sub.classId);
              return (
                <div
                  key={sub.id}
                  className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-500/40 transition-all"
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={sub.studentAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                          {sub.studentName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          Класс {subClass?.name || sub.classId}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        Урок: <span className="font-medium text-neutral-700 dark:text-neutral-300">{sub.lessonTitle}</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 mt-0.5">
                        Сдано: {sub.submittedAt} · Файлы: {sub.files.map(f => f.name).join(', ') || 'Код онлайн'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    {sub.status === 'graded' ? (
                      <div className="text-right">
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {sub.score} / {sub.maxScore} баллов
                        </div>
                        <div className="text-[10px] text-neutral-400">Проверено</div>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-1 rounded-lg">
                        Ожидает проверки
                      </span>
                    )}

                    {onReviewSubmission && (
                      <button
                        onClick={() => onReviewSubmission(sub)}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-sm transition-all"
                      >
                        {sub.status === 'graded' ? 'Редактировать оценку' : 'Проверить работу'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
