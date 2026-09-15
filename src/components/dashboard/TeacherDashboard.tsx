import React, { useState } from 'react';
import {
  Users,
  BookOpen,
  FileCheck,
  CheckCircle,
  Clock,
  Plus,
  Send,
  AlertCircle,
  Eye,
  BarChart3,
  Sparkles,
  FileCode,
  FileText,
  Key,
  RefreshCw,
  Copy,
  Printer,
  Check,
  Monitor,
  ShieldCheck,
  EyeOff,
  Search,
  ExternalLink,
  Laptop,
  CheckCheck,
  FileSpreadsheet
} from 'lucide-react';
import { User, SchoolClass, Lesson, HomeworkSubmission, Announcement, AttendanceRecord, LessonGradeRecord } from '../../types';
import {
  generatePassword,
  generateClassCredentials,
  formatCredentialsForClipboard,
  PasswordFormat,
  GeneratedCredential
} from '../../utils/passwordGenerator';
import { TeacherReportsTab } from './TeacherReportsTab';
import { INITIAL_ATTENDANCE_RECORDS, INITIAL_GRADE_RECORDS, exportStudentPerformanceToCSV } from '../../data/attendanceData';

interface TeacherDashboardProps {
  currentUser: User;
  classes: SchoolClass[];
  lessons: Lesson[];
  submissions: HomeworkSubmission[];
  announcements: Announcement[];
  users: User[];
  attendanceRecords?: AttendanceRecord[];
  gradeRecords?: LessonGradeRecord[];
  onReviewSubmission: (submission: HomeworkSubmission) => void;
  onCreateLesson: () => void;
  onPostAnnouncement: (ann: Omit<Announcement, 'id' | 'date'>) => void;
  onSelectLesson: (lesson: Lesson) => void;
  onUpdateUserPassword: (userId: string, newPassword: string) => void;
  onBulkUpdatePasswords?: (updates: { userId: string; newPassword: string }[]) => void;
  onNavigate?: (path: string) => void;
  onSwitchUser?: (user: User) => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  currentUser,
  classes = [],
  lessons = [],
  submissions = [],
  announcements = [],
  users = [],
  attendanceRecords = [],
  gradeRecords = [],
  onReviewSubmission,
  onCreateLesson,
  onPostAnnouncement,
  onSelectLesson,
  onUpdateUserPassword,
  onBulkUpdatePasswords,
  onNavigate,
  onSwitchUser
}) => {
  // Navigation tabs in Teacher Cabinet
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'passwords' | 'materials' | 'students'>('overview');

  // Attendance & Grades State
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_attendance');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return attendanceRecords && attendanceRecords.length > 0 ? attendanceRecords : INITIAL_ATTENDANCE_RECORDS;
  });

  const [grades, setGrades] = useState<LessonGradeRecord[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_grades');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return gradeRecords && gradeRecords.length > 0 ? gradeRecords : INITIAL_GRADE_RECORDS;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('smart_ict_attendance', JSON.stringify(attendance));
    } catch (e) {}
  }, [attendance]);

  React.useEffect(() => {
    try {
      localStorage.setItem('smart_ict_grades', JSON.stringify(grades));
    } catch (e) {}
  }, [grades]);

  const handleUpdateAttendance = (record: AttendanceRecord) => {
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.studentId === record.studentId && a.lessonId === record.lessonId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [...prev, record];
    });
  };

  const handleUpdateGrade = (record: LessonGradeRecord) => {
    setGrades(prev => {
      const idx = prev.findIndex(g => g.studentId === record.studentId && g.lessonId === record.lessonId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = record;
        return next;
      }
      return [...prev, record];
    });
  };

  // Announcement modal / form
  const [showAnnouncementForm, setShowAnnouncementForm] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [targetClass, setTargetClass] = useState<string>('');

  // Password Generator State
  const [selectedClassForPasswords, setSelectedClassForPasswords] = useState<string>('all');
  const [passwordFormat, setPasswordFormat] = useState<PasswordFormat>('school');
  const [stagedCredentials, setStagedCredentials] = useState<GeneratedCredential[]>([]);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [showPrintCards, setShowPrintCards] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Student list search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('all');

  const safeUsers = users || [];
  const safeSubmissions = submissions || [];
  const safeClasses = classes || [];

  const pendingSubmissions = safeSubmissions.filter(s => s.status === 'submitted');
  const gradedSubmissions = safeSubmissions.filter(s => s.status === 'graded');
  const totalStudents = safeUsers.filter(u => u.role === 'student').length;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) return;

    onPostAnnouncement({
      title: annTitle.trim(),
      content: annContent.trim(),
      authorName: currentUser.name || 'Абдугафоров Мухаммадрахим Равшанович (Учитель ИКТ)',
      targetClassIds: targetClass ? [targetClass] : [],
      pinned: true
    });

    setAnnTitle('');
    setAnnContent('');
    setShowAnnouncementForm(false);
    showToast('Объявление успешно опубликовано для учеников!');
  };

  // -------------------------------------------------------------------
  // PASSWORD GENERATOR HANDLERS
  // -------------------------------------------------------------------
  // Filter students for password generator
  const eligibleStudents = safeUsers.filter(u => {
    if (u.role !== 'student') return false;
    if (selectedClassForPasswords === 'all') return true;
    return u.classId === selectedClassForPasswords;
  });

  const handleGenerateClassPasswords = () => {
    const creds = generateClassCredentials(
      eligibleStudents.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        classId: s.classId
      })),
      passwordFormat
    );
    setStagedCredentials(creds);
    showToast(`Сгенерированы новые пароли для ${creds.length} учеников. Нажмите «Применить», чтобы сохранить.`);
  };

  const handleApplyStagedPasswords = () => {
    if (stagedCredentials.length === 0) return;

    if (onBulkUpdatePasswords) {
      onBulkUpdatePasswords(stagedCredentials.map(c => ({ userId: c.userId, newPassword: c.password })));
    } else {
      stagedCredentials.forEach(c => onUpdateUserPassword(c.userId, c.password));
    }

    showToast(`Успешно обновлены пароли для ${stagedCredentials.length} учеников!`);
  };

  const handleGenerateSinglePassword = (studentId: string, studentName: string) => {
    const newPass = generatePassword(passwordFormat);
    onUpdateUserPassword(studentId, newPass);
    showToast(`Сгенерирован новый пароль для ${studentName}: ${newPass}`);
  };

  const handleCopyClipboard = () => {
    if (stagedCredentials.length === 0) return;
    const className = selectedClassForPasswords === 'all' ? 'Все классы' : classes.find(c => c.id === selectedClassForPasswords)?.name;
    const text = formatCredentialsForClipboard(stagedCredentials, className);
    navigator.clipboard.writeText(text);
    setCopiedNotification('Скопировано в буфер обмена!');
    setTimeout(() => setCopiedNotification(null), 3000);
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Filter students in the Student Journal
  const filteredStudents = safeUsers.filter(u => {
    if (u.role !== 'student') return false;
    if (studentClassFilter !== 'all' && u.classId !== studentClassFilter) return false;
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  // Export students performance and grades to CSV file for record keeping
  const handleExportStudentsCsv = () => {
    const targetClass = classes.find(c => c.id === studentClassFilter);
    const targetStudents = filteredStudents;
    const targetLessons = lessons.filter(l => !studentClassFilter || studentClassFilter === 'all' || l.targetClassIds?.includes(studentClassFilter));
    exportStudentPerformanceToCSV({
      schoolClass: targetClass,
      students: targetStudents,
      lessons: targetLessons.length > 0 ? targetLessons : lessons,
      attendance,
      grades,
      teacherName: currentUser.name || 'Абдугафоров Мухаммадрахим Равшанович',
      quarter: studentClassFilter === 'all' ? 'Сводная ведомость всех классов' : `Класс ${targetClass?.name || studentClassFilter}`
    });
    showToast('Успеваемость и оценки учащихся экспортированы в CSV файл');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-bold shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom-5 border border-neutral-700">
          <CheckCircle className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TEACHER ICT HERO CARD */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-900 to-neutral-950 text-white shadow-xl relative overflow-hidden border border-blue-800/60">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 hidden md:block">
          <Laptop className="w-44 h-44" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="relative">
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt=""
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-blue-500/30 shadow-lg"
              />
              <div className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 rounded-full text-white" title="В сети">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-200 border border-blue-400/30 flex items-center space-x-1">
                  <Monitor className="w-3 h-3" />
                  <span>Кабинет ИКТ (№304)</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                  Высшая категория
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/20 text-purple-200 border border-purple-400/30">
                  Python & Web
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white mt-1.5">
                Абдугафоров Мухаммадрахим Равшанович
              </h1>
              <p className="text-xs sm:text-sm text-blue-200/80 font-medium mt-0.5">
                Учитель информатики и информационно-коммуникационных технологий (ИКТ)
              </p>
            </div>
          </div>

          {/* Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('reports')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 transition-all flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Отчеты и ведомости</span>
            </button>

            <button
              onClick={() => setActiveTab('passwords')}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/20 transition-all flex items-center space-x-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Генератор паролей</span>
            </button>

            <button
              onClick={() => setShowAnnouncementForm(!showAnnouncementForm)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/20 transition-all flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5 text-blue-300" />
              <span>Объявление</span>
            </button>

            <button
              onClick={onCreateLesson}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Создать урок</span>
            </button>
          </div>
        </div>
      </div>

      {/* CABINET TABS NAVIGATION */}
      <div className="flex items-center space-x-2 border-b border-neutral-200 dark:border-neutral-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Обзор и проверка ДЗ ({pendingSubmissions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'reports'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Отчеты: Оценки и посещаемость</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-400 text-purple-950 font-black">
            AI
          </span>
        </button>

        <button
          onClick={() => setActiveTab('passwords')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'passwords'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Генератор паролей ученикам</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-amber-950 font-black">
            ИКТ
          </span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'materials'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Учебные материалы ИКТ ({lessons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
            activeTab === 'students'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Журнал учащихся ({totalStudents})</span>
        </button>
      </div>

      {/* ANNOUNCEMENT COLLAPSIBLE FORM */}
      {showAnnouncementForm && (
        <form
          onSubmit={handleCreateAnnouncement}
          className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-blue-300 dark:border-blue-900 shadow-xl space-y-4 animate-in slide-in-from-top-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Опубликовать объявление от имени учителя ИКТ</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAnnouncementForm(false)}
              className="text-xs text-neutral-400 hover:text-neutral-600"
            >
              Отмена
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder="Тема объявления (например: Лабораторная по сетям в кабинете 304)..."
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <select
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              >
                <option value="">Все классы школы</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Класс {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            placeholder="Текст объявления для учащихся..."
            value={annContent}
            onChange={(e) => setAnnContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
            >
              Опубликовать сейчас
            </button>
          </div>
        </form>
      )}

      {/* =================================================================== */}
      {/* TAB 1: OVERVIEW & HOMEWORK REVIEW */}
      {/* =================================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Учащиеся ИКТ</span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
                {totalStudents}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                В {classes.length} классах школы
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Уроки и Модули</span>
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-neutral-900 dark:text-white mt-2">
                {lessons.length}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Конспекты, тесты, Python
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Ждут проверки</span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-amber-500 mt-2">
                {pendingSubmissions.length}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                Новых домашних работ
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">Проверено</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
                {gradedSubmissions.length}
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                С оценкой и рецензией
              </div>
            </div>

          </div>

          {/* Submissions List & Classes Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Submissions Inbox (2 Cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-blue-600" />
                  <span>Поступившие работы по информатике и ИКТ</span>
                </h3>
                <span className="text-xs text-neutral-500">
                  {pendingSubmissions.length > 0 ? `${pendingSubmissions.length} на проверке` : 'Все работы проверены'}
                </span>
              </div>

              <div className="space-y-3">
                {submissions.map((sub) => {
                  const isPending = sub.status === 'submitted';
                  return (
                    <div
                      key={sub.id}
                      className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400/80 transition-all shadow-sm space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <img
                            src={sub.studentAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                            alt=""
                            className="w-10 h-10 rounded-2xl object-cover ring-2 ring-neutral-200 dark:ring-neutral-700"
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                                {sub.studentName}
                              </h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                Класс {sub.classId}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {sub.lessonTitle} · сдал {sub.submittedAt}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isPending ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>На проверке</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center space-x-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Оценка: {sub.score} / {sub.maxScore}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Attached Files List */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {sub.files.map((f, i) => (
                          <div
                            key={i}
                            className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs flex items-center space-x-1.5"
                          >
                            {f.name.endsWith('.py') ? (
                              <FileCode className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-rose-500" />
                            )}
                            <span className="font-mono text-[11px]">{f.name}</span>
                            <span className="text-neutral-400 text-[10px]">({f.size})</span>
                          </div>
                        ))}
                      </div>

                      {sub.studentComment && (
                        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 text-xs text-neutral-600 dark:text-neutral-300 italic border-l-2 border-blue-500">
                          «{sub.studentComment}»
                        </div>
                      )}

                      {sub.teacherFeedback && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                          <strong>Ваша рецензия:</strong> {sub.teacherFeedback}
                        </div>
                      )}

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => onReviewSubmission(sub)}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-sm flex items-center space-x-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isPending ? 'Проверить и выставить балл' : 'Редактировать рецензию'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Classes Performance (1 Col) */}
            <div className="space-y-6">
              
              <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" />
                  <span>Успеваемость по классам ИКТ</span>
                </h3>

                <div className="space-y-3">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-neutral-900 dark:text-white">
                          Класс {cls.name}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {cls.studentCount} учащихся · Кабинет 304
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                          {cls.id === '10C' ? '92%' : cls.id === '11B' ? '96%' : '88%'}
                        </div>
                        <div className="text-[10px] text-neutral-400">сдача ДЗ</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Password Generator Promo Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-neutral-900 dark:to-neutral-900 border border-amber-200 dark:border-amber-900/40 space-y-3">
                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center space-x-2">
                  <Key className="w-4 h-4 text-amber-600" />
                  <span>Генератор паролей для учеников</span>
                </h4>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  Быстрая генерация удобных школьных паролей для всего класса к уроку в компьютерном кабинете. Распечатка памяток в 1 клик.
                </p>
                <button
                  onClick={() => setActiveTab('passwords')}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Открыть генератор паролей</span>
                </button>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* TAB: ATTENDANCE AND GRADES REPORTS (NEW USER REQUIREMENT) */}
      {/* =================================================================== */}
      {activeTab === 'reports' && (
        <TeacherReportsTab
          currentUser={currentUser}
          classes={safeClasses}
          lessons={lessons}
          users={safeUsers}
          attendanceRecords={attendance}
          gradeRecords={grades}
          onUpdateAttendance={handleUpdateAttendance}
          onUpdateGrade={handleUpdateGrade}
        />
      )}

      {/* =================================================================== */}
      {/* TAB 2: STUDENT PASSWORD GENERATOR (KEY USER REQUIREMENT) */}
      {/* =================================================================== */}
      {activeTab === 'passwords' && (
        <div className="space-y-6">
          
          {/* Header Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                    Инструмент учителя ИКТ
                  </span>
                  <span className="text-xs text-neutral-400">Кабинет 304 · Преподаватель: Абдугафоров М. Р.</span>
                </div>
                <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white mt-1">
                  Генератор школьных паролей для учеников
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Система генерирует удобные для ввода в компьютерном классе пароли, сохраняет их в базу и формирует ведомости и раздаточные карточки.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPrintCards(!showPrintCards)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                    showPrintCards
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                  }`}
                  title="Показать готовые раздаточные карточки для распечатки ученикам"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{showPrintCards ? 'Скрыть карточки' : 'Карточки для печати'}</span>
                </button>

                {stagedCredentials.length > 0 && (
                  <button
                    onClick={handleCopyClipboard}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 transition-all flex items-center space-x-1.5"
                  >
                    {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedNotification || 'Копировать ведомость'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Generator Controls */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
              
              {/* Select Class */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  1. Целевой класс учащихся
                </label>
                <select
                  value={selectedClassForPasswords}
                  onChange={(e) => setSelectedClassForPasswords(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">Все классы школы ({safeUsers.filter(u => u.role === 'student').length} уч.)</option>
                  {safeClasses.map(c => {
                    const cnt = safeUsers.filter(u => u.role === 'student' && u.classId === c.id).length;
                    return (
                      <option key={c.id} value={c.id}>Класс {c.name} ({cnt} учеников)</option>
                    );
                  })}
                </select>
              </div>

              {/* Password Format */}
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  2. Формат генерируемых паролей
                </label>
                <select
                  value={passwordFormat}
                  onChange={(e) => setPasswordFormat(e.target.value as PasswordFormat)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="school">Школьный ИКТ (ict-4892, py-7310)</option>
                  <option value="mnemonic">Мнемонический (learn-48x, logic-91)</option>
                  <option value="pin">Цифровой PIN-код (6 цифр: 839104)</option>
                  <option value="secure">Сложный символьный (A7#mQ9!v)</option>
                </select>
              </div>

              {/* Generate Button */}
              <div>
                <button
                  onClick={handleGenerateClassPasswords}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all flex items-center justify-center space-x-2 shadow-md shadow-amber-500/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Сгенерировать пароли</span>
                </button>
              </div>

              {/* Save / Apply Button */}
              <div>
                <button
                  onClick={handleApplyStagedPasswords}
                  disabled={stagedCredentials.length === 0}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2 ${
                    stagedCredentials.length > 0
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 cursor-pointer'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Применить для учеников ({stagedCredentials.length})</span>
                </button>
              </div>

            </div>
          </div>

          {/* PRINTABLE SLIPS (РАЗДАТОЧНЫЙ МАТЕРИАЛ ДЛЯ КОМПЬЮТЕРНОГО КЛАССА) */}
          {showPrintCards && (
            <div className="p-6 rounded-3xl bg-neutral-100 dark:bg-neutral-900 border-2 border-dashed border-purple-400 dark:border-purple-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center space-x-2">
                    <Printer className="w-4 h-4 text-purple-600" />
                    <span>Памятки-карточки доступа для раздачи учащимся на уроке ИКТ</span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Учитель может распечатать эти карточки перед уроком в кабинете 304 для быстрой авторизации за школьными компьютерами.
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-all flex items-center space-x-1.5 shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Отправить на печать</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {(stagedCredentials.length > 0 ? stagedCredentials : eligibleStudents.map(s => ({
                  userId: s.id,
                  userName: s.name,
                  userEmail: s.email,
                  classId: s.classId,
                  password: s.password || 'student123'
                }))).map((cred) => (
                  <div
                    key={cred.userId}
                    className="p-4 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 shadow-sm space-y-2 relative"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700 pb-1.5">
                      <div className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                        Smart ICT · Кабинет (№304)
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                        Класс {cred.classId || '10-C'}
                      </span>
                    </div>

                    <div>
                      <div className="font-bold text-xs text-neutral-900 dark:text-white">
                        {cred.userName}
                      </div>
                      <div className="text-[11px] text-neutral-500 font-mono">
                        Логин: <strong className="text-neutral-800 dark:text-neutral-200">{cred.userEmail}</strong>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between">
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold">Пароль:</span>
                      <span className="font-mono text-xs font-black text-amber-700 dark:text-amber-300 tracking-wider">
                        {cred.password}
                      </span>
                    </div>

                    <div className="text-[9px] text-neutral-400 text-center pt-0.5">
                      Преподаватель: Абдугафоров М. Р.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Students Password Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-600" />
                <span>Список учеников и управление паролями</span>
              </h3>
              <span className="text-xs text-neutral-400">
                {stagedCredentials.length > 0 ? `Сгенерировано для ${stagedCredentials.length} учеников` : `${eligibleStudents.length} учащихся`}
              </span>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Ученик</th>
                  <th className="pb-3">Класс</th>
                  <th className="pb-3">Текущий пароль</th>
                  <th className="pb-3">Сгенерированный пароль</th>
                  <th className="pb-3 text-right">Быстрое действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {eligibleStudents.map((student) => {
                  const isVisible = !!visiblePasswords[student.id];
                  const staged = stagedCredentials.find(c => c.userId === student.id);

                  return (
                    <tr key={student.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                      {/* Student Name */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={student.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700"
                          />
                          <div>
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {student.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {student.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {student.classId || '10-C'}
                        </span>
                      </td>

                      {/* Current Password */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono font-bold text-neutral-700 dark:text-neutral-300">
                            {isVisible ? (student.password || 'student123') : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(student.id)}
                            className="text-neutral-400 hover:text-neutral-600 p-0.5"
                            title={isVisible ? 'Скрыть' : 'Показать'}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Staged Password */}
                      <td className="py-3 pr-4">
                        {staged ? (
                          <span className="px-2.5 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono font-bold border border-amber-300 dark:border-amber-800">
                            {staged.password}
                          </span>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">Не генерировался</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleGenerateSinglePassword(student.id, student.name)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 hover:bg-amber-100 transition-all inline-flex items-center space-x-1"
                          title="Сгенерировать случайный пароль для этого ученика прямо сейчас"
                        >
                          <Sparkles className="w-3 h-3 text-amber-500" />
                          <span>Сгенерировать</span>
                        </button>

                        {onSwitchUser && (
                          <button
                            onClick={() => {
                              onSwitchUser(student);
                              showToast(`Вы вошли под учеником «${student.name}»`);
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all"
                            title="Тестировать кабинет ученика"
                          >
                            Тест входа
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ICT CURRICULUM & LESSONS */}
      {/* =================================================================== */}
      {activeTab === 'materials' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span>Учебная программа по информатике и ИКТ</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Интерактивные уроки, слайды, Python-песочницы и лабораторные работы
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onCreateLesson}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить новый урок</span>
              </button>
              {onNavigate && currentUser.role === 'admin' && (
                <button
                  onClick={() => onNavigate('/admin')}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all flex items-center space-x-1"
                >
                  <span>Админ-конструктор</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Lessons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lessons.map((les) => (
              <div
                key={les.id}
                className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500 transition-all shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                      Урок {les.order}
                    </span>
                    <div className="flex gap-1">
                      {les.targetClassIds?.map(c => (
                        <span key={c} className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>

                  <h4 className="font-bold text-sm text-neutral-900 dark:text-white mt-2">
                    {les.title}
                  </h4>
                  <p className="text-xs text-neutral-500 line-clamp-2 mt-1">
                    {les.description}
                  </p>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {les.starterCode && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                        🐍 Python Sandbox
                      </span>
                    )}
                    {les.homework && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        📝 ДЗ ({les.homework.maxScore} б.)
                      </span>
                    )}
                    {les.quiz && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                        ❓ Тест
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">
                    +{les.xpReward} XP
                  </span>
                  <button
                    onClick={() => onSelectLesson(les)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center space-x-1"
                  >
                    <span>Открыть урок</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: STUDENTS JOURNAL */}
      {/* =================================================================== */}
      {activeTab === 'students' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Электронный журнал учащихся ИКТ</span>
              </h3>
              <p className="text-xs text-neutral-500">
                Список школьников, класс, опыт (XP), статус сданных работ и пароли
              </p>
            </div>

            {/* Filter */}
            <div className="flex items-center space-x-2">
              <div className="relative w-48">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Поиск по имени..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
              </div>

              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
              >
                <option value="all">Все классы</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Класс {c.name}</option>
                ))}
              </select>

              <button
                onClick={handleExportStudentsCsv}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center space-x-1.5 shrink-0"
                title="Экспорт успеваемости и оценок учащихся в CSV файл"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Экспорт в CSV</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Учащийся</th>
                  <th className="pb-3">Класс</th>
                  <th className="pb-3">Уровень и XP</th>
                  <th className="pb-3">Пароль (ИКТ)</th>
                  <th className="pb-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredStudents.map((st) => {
                  const isVisible = !!visiblePasswords[st.id];

                  return (
                    <tr key={st.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={st.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700"
                          />
                          <div>
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {st.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {st.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {st.classId || '10-C'}
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="font-bold text-neutral-800 dark:text-neutral-200">
                          Уровень {st.level}
                        </div>
                        <div className="text-[11px] text-neutral-400 font-semibold">
                          {st.xp} XP · серия {st.streakDays} дн.
                        </div>
                      </td>

                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-1.5 font-mono">
                          <span className="font-bold text-neutral-700 dark:text-neutral-300">
                            {isVisible ? (st.password || 'student123') : '••••••••'}
                          </span>
                          <button
                            onClick={() => togglePasswordVisibility(st.id)}
                            className="text-neutral-400 hover:text-neutral-600 p-0.5"
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleGenerateSinglePassword(st.id, st.name)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all inline-flex items-center space-x-1"
                        >
                          <RefreshCw className="w-3 h-3 text-amber-500" />
                          <span>Сгенерировать пароль</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
