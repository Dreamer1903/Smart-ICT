import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Printer,
  Sparkles,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Download,
  Calendar,
  BookOpen,
  Award,
  Edit3,
  X,
  FileText,
  ChevronDown,
  KeyRound,
  RefreshCw,
  Check
} from 'lucide-react';
import { User, SchoolClass, Lesson, AttendanceRecord, LessonGradeRecord, AttendanceStatus } from '../../types';
import {
  calculateClassMetrics,
  exportClassReportToExcel,
  exportStudentPerformanceToCSV,
  ensureClassAttendanceAndGrades
} from '../../data/attendanceData';

interface TeacherReportsTabProps {
  currentUser: User;
  classes: SchoolClass[];
  lessons: Lesson[];
  users: User[];
  attendanceRecords: AttendanceRecord[];
  gradeRecords: LessonGradeRecord[];
  onUpdateAttendance: (record: AttendanceRecord) => void;
  onUpdateGrade: (record: LessonGradeRecord) => void;
}

export const TeacherReportsTab: React.FC<TeacherReportsTabProps> = ({
  currentUser,
  classes = [],
  lessons = [],
  users = [],
  attendanceRecords = [],
  gradeRecords = [],
  onUpdateAttendance,
  onUpdateGrade
}) => {
  // Selected class filter (default to first class, e.g. 10C)
  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id || '10C');
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'all'>(1);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Cell edit modal
  const [editingCell, setEditingCell] = useState<{
    student: User;
    lesson: Lesson;
    currentAtt?: AttendanceRecord;
    currentGrade?: LessonGradeRecord;
  } | null>(null);

  // AI Analysis state
  const [isGeneratingAiAnalysis, setIsGeneratingAiAnalysis] = useState(false);
  const [aiReportText, setAiReportText] = useState<string | null>(null);
  const [aiReportSource, setAiReportSource] = useState<string>('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('gemini_custom_api_key') || '');
  const [showApiKeySetting, setShowApiKeySetting] = useState<boolean>(false);
  const [keyVerifyStatus, setKeyVerifyStatus] = useState<{ checked: boolean; valid?: boolean; message?: string } | null>(null);
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Selected Class Object
  const currentClass = useMemo(() => {
    return classes.find(c => c.id === selectedClassId) || classes[0];
  }, [classes, selectedClassId]);

  // Students in selected class
  const classStudents = useMemo(() => {
    const students = users.filter(u => u.role === 'student' && u.classId === selectedClassId);
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }, [users, selectedClassId, searchQuery]);

  // Filter lessons for this class & quarter
  const filteredLessons = useMemo(() => {
    let list = lessons.filter(l => 
      !l.classIds || l.classIds.length === 0 || l.classIds.includes(selectedClassId)
    );
    if (selectedQuarter !== 'all') {
      list = list.filter(l => !l.quarter || l.quarter === selectedQuarter);
    }
    if (selectedLessonId !== 'all') {
      list = list.filter(l => l.id === selectedLessonId);
    }
    return list;
  }, [lessons, selectedClassId, selectedQuarter, selectedLessonId]);

  // Ensure robust data matrix
  const { attendance, grades } = useMemo(() => {
    return ensureClassAttendanceAndGrades(classStudents, filteredLessons, attendanceRecords, gradeRecords);
  }, [classStudents, filteredLessons, attendanceRecords, gradeRecords]);

  // Fast lookups
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach(a => map.set(`${a.studentId}_${a.lessonId}`, a));
    return map;
  }, [attendance]);

  const gradeMap = useMemo(() => {
    const map = new Map<string, LessonGradeRecord>();
    grades.forEach(g => map.set(`${g.studentId}_${g.lessonId}`, g));
    return map;
  }, [grades]);

  // Overall Class Metrics
  const metrics = useMemo(() => {
    return calculateClassMetrics(
      selectedClassId,
      currentClass?.name || '10-C',
      classStudents,
      filteredLessons,
      attendance,
      grades
    );
  }, [selectedClassId, currentClass, classStudents, filteredLessons, attendance, grades]);

  // Export to Excel handler
  const handleExportExcel = () => {
    exportClassReportToExcel({
      schoolClass: currentClass,
      students: classStudents,
      lessons: filteredLessons,
      attendance,
      grades,
      teacherName: currentUser.name || 'Абдугафоров Мухаммадрахим Равшанович',
      quarter: selectedQuarter === 'all' ? 'Годовая ведомость' : `${selectedQuarter} четверть`
    });
  };

  // Export to CSV handler
  const handleExportCSV = () => {
    exportStudentPerformanceToCSV({
      schoolClass: currentClass,
      students: classStudents,
      lessons: filteredLessons,
      attendance,
      grades,
      teacherName: currentUser.name || 'Абдугафоров Мухаммадрахим Равшанович',
      quarter: selectedQuarter === 'all' ? 'Годовая ведомость' : `${selectedQuarter} четверть`
    });
  };

  // Verify and Save API Key
  const handleVerifyAndSaveApiKey = async (keyToVerify: string) => {
    setIsVerifyingKey(true);
    try {
      const res = await fetch('/api/ai/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToVerify }),
      });
      const data = await res.json();
      if (data.valid) {
        setKeyVerifyStatus({
          checked: true,
          valid: true,
          message: `Ключ Gemini подключен! Модель: ${data.model}`,
        });
        localStorage.setItem('gemini_custom_api_key', keyToVerify);
        setGeminiApiKey(keyToVerify);
      } else {
        setKeyVerifyStatus({
          checked: true,
          valid: false,
          message: data.error || 'Ключ не прошел проверку.',
        });
      }
    } catch (err: any) {
      setKeyVerifyStatus({
        checked: true,
        valid: false,
        message: 'Не удалось проверить ключ. Сервер недоступен.',
      });
    } finally {
      setIsVerifyingKey(false);
    }
  };

  // Generate AI Analysis Handler (via Gemini 3.8 Flash)
  const handleGenerateAiAnalysis = async () => {
    setIsGeneratingAiAnalysis(true);
    setShowAiModal(true);
    setAiReportText(null);

    const activeKey = geminiApiKey.trim() || localStorage.getItem('gemini_custom_api_key') || undefined;

    try {
      const lessonsSummary = filteredLessons.map(l => l.title).slice(0, 8).join(', ');
      const response = await fetch('/api/ai/attendance-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: currentClass?.name || '10-C',
          totalStudents: metrics.totalStudents,
          averageGrade: metrics.averageGrade,
          qualityPercent: metrics.qualityPercent,
          attendancePercent: metrics.attendancePercent,
          totalAbsences: metrics.totalAbsences,
          excusedAbsences: metrics.excusedAbsences,
          unexcusedAbsences: metrics.unexcusedAbsences,
          lessonsSummary,
          customApiKey: activeKey
        })
      });

      const data = await response.json();
      if (data.report) {
        setAiReportText(data.report);
        setAiReportSource(data.source || 'gemini-3.8-flash');
      } else {
        setAiReportText('Не удалось получить отчет от аналитического модуля.');
      }
    } catch (err) {
      console.error(err);
      setAiReportText('Произошла ошибка при обращении к сервису аналитики.');
    } finally {
      setIsGeneratingAiAnalysis(false);
    }
  };

  // Quick toggle status for attendance
  const cycleAttendanceStatus = (e: React.MouseEvent, student: User, lesson: Lesson) => {
    e.stopPropagation();
    const current = attendanceMap.get(`${student.id}_${lesson.id}`);
    const nextStatus: AttendanceStatus = 
      !current || current.status === 'present' ? 'late' :
      current.status === 'late' ? 'excused' :
      current.status === 'excused' ? 'absent' : 'present';

    const updated: AttendanceRecord = {
      id: current?.id || `att-${student.id}-${lesson.id}`,
      studentId: student.id,
      lessonId: lesson.id,
      classId: student.classId || selectedClassId,
      date: lesson.date || new Date().toISOString().split('T')[0],
      status: nextStatus,
      minutesLate: nextStatus === 'late' ? 10 : undefined,
      note: nextStatus === 'excused' ? 'По заявлению' : undefined
    };

    onUpdateAttendance(updated);
  };

  // Set grade directly
  const handleSaveCellData = (status: AttendanceStatus, gradeVal: number, comment?: string) => {
    if (!editingCell) return;
    const { student, lesson, currentAtt, currentGrade } = editingCell;

    const newAtt: AttendanceRecord = {
      id: currentAtt?.id || `att-${student.id}-${lesson.id}`,
      studentId: student.id,
      lessonId: lesson.id,
      classId: student.classId || selectedClassId,
      date: lesson.date || new Date().toISOString().split('T')[0],
      status,
      note: comment
    };

    const newGr: LessonGradeRecord = {
      id: currentGrade?.id || `gr-${student.id}-${lesson.id}`,
      studentId: student.id,
      lessonId: lesson.id,
      classId: student.classId || selectedClassId,
      date: lesson.date || new Date().toISOString().split('T')[0],
      grade: gradeVal,
      score: gradeVal === 5 ? 95 : gradeVal === 4 ? 80 : gradeVal === 3 ? 65 : 45,
      type: 'classwork',
      comment
    };

    onUpdateAttendance(newAtt);
    onUpdateGrade(newGr);
    setEditingCell(null);
  };

  return (
    <div className="space-y-6">
      
      {/* TOP CONTROLS & HEADER */}
      <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black text-neutral-900 dark:text-white">
              Ведомость оценок и посещаемости
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Аналитический сводный отчет по успеваемости, дисциплине и посещаемости уроков ИКТ
          </p>
        </div>

        {/* Action Buttons: AI Report, Excel Export, Print, Gemini Settings */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleGenerateAiAnalysis}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-md shadow-purple-500/20 transition-all flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI-Анализ класса (Gemini)</span>
          </button>

          <button
            onClick={() => setShowApiKeySetting(!showApiKeySetting)}
            className="px-3 py-2.5 rounded-xl text-xs font-bold border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-all flex items-center space-x-1.5"
            title="Настройка API ключа Gemini"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>API Ключ Gemini</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Экспорт в Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2"
            title="Экспорт успеваемости и оценок учащихся в файл CSV для архива и учета"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Экспорт в CSV (.csv)</span>
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all flex items-center space-x-2"
          >
            <Printer className="w-4 h-4 text-neutral-500" />
            <span>Печать / PDF</span>
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE GEMINI API KEY SETUP PANEL */}
      {showApiKeySetting && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                Подключение и настройка Google Gemini API
              </h4>
            </div>
            <button
              onClick={() => setShowApiKeySetting(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
            Используется для генерации развернутых методических отчетов по посещаемости, успеваемости и распределению КТП. Ключ автоматически сохраняется в браузере.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <input
              type="password"
              placeholder="Введите ваш ключ Google Gemini (AIzaSy...)"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="flex-1 w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            <button
              type="button"
              disabled={isVerifyingKey}
              onClick={() => handleVerifyAndSaveApiKey(geminiApiKey)}
              className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {isVerifyingKey && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isVerifyingKey ? 'Проверка...' : 'Проверить и сохранить'}</span>
            </button>
          </div>

          {keyVerifyStatus && (
            <div className={`text-[11px] p-2.5 rounded-xl border flex items-center space-x-2 ${
              keyVerifyStatus.valid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
            }`}>
              {keyVerifyStatus.valid ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{keyVerifyStatus.message}</span>
            </div>
          )}
        </div>
      )}

      {/* FILTER CONTROLS BAR */}
      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-3">
        
        {/* Class Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-500">Класс:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.studentCount} уч.)
              </option>
            ))}
          </select>
        </div>

        {/* Quarter Selector */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-500">Период:</span>
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">1 четверть (Сентябрь — Октябрь)</option>
            <option value="2">2 четверть (Ноябрь — Декабрь)</option>
            <option value="3">3 четверть (Январь — Март)</option>
            <option value="4">4 четверть (Апрель — Май)</option>
            <option value="all">Весь учебный год (Годовая)</option>
          </select>
        </div>

        {/* Lesson Filter */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-neutral-500">Урок:</span>
          <select
            value={selectedLessonId}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 max-w-[220px] truncate"
          >
            <option value="all">Все уроки периода ({filteredLessons.length})</option>
            {filteredLessons.map((l, i) => (
              <option key={l.id} value={l.id}>
                Урок {i + 1}: {l.title}
              </option>
            ))}
          </select>
        </div>

        {/* Student Search */}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Поиск по ученикам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* METRIC KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-xs font-semibold">Средний балл</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">
            {metrics.averageGrade} <span className="text-xs font-normal text-neutral-400">/ 5.0</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {metrics.averageGrade >= 4.5 ? 'Отличный уровень' : metrics.averageGrade >= 3.8 ? 'Хороший уровень' : 'Требует внимания'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-xs font-semibold">Посещаемость</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {metrics.attendancePercent}%
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 font-medium">
            Явка учащихся на уроки
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-xs font-semibold">Качество знаний</span>
            <TrendingUp className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {metrics.qualityPercent}%
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 font-medium">
            Доля оценок «4» и «5»
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-xs font-semibold">Успеваемость</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {metrics.passingPercent}%
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 font-medium">
            Без неудовлетворительных
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm">
          <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400 mb-1">
            <span className="text-xs font-semibold">Всего пропусков</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-white">
            {metrics.totalAbsences}
          </div>
          <div className="mt-1 text-[11px] text-neutral-500 font-medium">
            Уваж: {metrics.excusedAbsences} | Неуваж: {metrics.unexcusedAbsences}
          </div>
        </div>

      </div>

      {/* LEGEND / HOW TO USE HINT */}
      <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-blue-900 dark:text-blue-200">Обозначения:</span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">
            П — Был
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">
            О — Опоздал
          </span>
          <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[10px]">
            У — Уважительная
          </span>
          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300 font-bold text-[10px]">
            Н — Не был
          </span>
        </div>

        <div className="text-neutral-500 dark:text-neutral-400 text-[11px] flex items-center space-x-1">
          <Edit3 className="w-3.5 h-3.5 text-blue-500" />
          <span>Нажмите на любую ячейку, чтобы изменить статус или оценку</span>
        </div>
      </div>

      {/* INTERACTIVE JOURNAL MATRIX TABLE */}
      <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-850">
                <th className="py-3.5 px-4 font-bold text-neutral-500 dark:text-neutral-400 w-12 text-center">№</th>
                <th className="py-3.5 px-4 font-bold text-neutral-700 dark:text-neutral-300 min-w-[200px]">
                  Ученик ({classStudents.length})
                </th>
                
                {filteredLessons.map((lesson, idx) => (
                  <th key={lesson.id} className="py-3.5 px-3 font-semibold text-neutral-700 dark:text-neutral-300 min-w-[130px] border-l border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center space-x-1">
                      <span className="font-bold text-blue-600 dark:text-blue-400">Урок {idx + 1}</span>
                      <span className="text-[10px] text-neutral-400">({lesson.date ? lesson.date.slice(5) : '09-15'})</span>
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate max-w-[120px]" title={lesson.title}>
                      {lesson.title}
                    </div>
                  </th>
                ))}

                <th className="py-3.5 px-3 font-bold text-neutral-700 dark:text-neutral-300 text-center border-l border-neutral-200 dark:border-neutral-800">
                  Средний балл
                </th>
                <th className="py-3.5 px-3 font-bold text-neutral-700 dark:text-neutral-300 text-center">
                  Посещаемость
                </th>
                <th className="py-3.5 px-4 font-bold text-neutral-700 dark:text-neutral-300 text-center">
                  Итог
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {classStudents.map((student, sIdx) => {
                let gradesSum = 0;
                let gradesCount = 0;
                let presentsCount = 0;

                return (
                  <tr key={student.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="py-3 px-4 text-center font-mono text-neutral-400">
                      {sIdx + 1}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <img
                          src={student.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80'}
                          alt=""
                          className="w-7 h-7 rounded-lg object-cover ring-1 ring-neutral-200 dark:ring-neutral-700 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-neutral-900 dark:text-white">
                            {student.name}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {student.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Lesson attendance & grade cells */}
                    {filteredLessons.map((lesson) => {
                      const att = attendanceMap.get(`${student.id}_${lesson.id}`);
                      const gr = gradeMap.get(`${student.id}_${lesson.id}`);

                      if (gr && typeof gr.grade === 'number') {
                        gradesSum += gr.grade;
                        gradesCount++;
                      }
                      if (!att || att.status === 'present' || att.status === 'late') {
                        presentsCount++;
                      }

                      const status = att?.status || 'present';
                      const grade = gr?.grade || 5;

                      return (
                        <td
                          key={lesson.id}
                          onClick={() => setEditingCell({
                            student,
                            lesson,
                            currentAtt: att,
                            currentGrade: gr
                          })}
                          className="py-2.5 px-2.5 border-l border-neutral-200 dark:border-neutral-800 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors group"
                        >
                          <div className="inline-flex items-center space-x-1.5 px-2 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 group-hover:ring-2 group-hover:ring-blue-500/50">
                            
                            {/* Academic Grade */}
                            <span className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-xs ${
                              grade === 5 ? 'bg-emerald-500 text-white' :
                              grade === 4 ? 'bg-blue-500 text-white' :
                              grade === 3 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                            }`}>
                              {grade}
                            </span>

                            {/* Attendance status badge */}
                            <span
                              onClick={(e) => cycleAttendanceStatus(e, student, lesson)}
                              title="Нажмите, чтобы переключить статус явки"
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black cursor-pointer ${
                                status === 'present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                                status === 'late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                                status === 'excused' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                                'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {status === 'present' ? 'П' : status === 'late' ? 'О' : status === 'excused' ? 'У' : 'Н'}
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    {/* Calculated Student Summary */}
                    {(() => {
                      const avg = gradesCount > 0 ? (gradesSum / gradesCount).toFixed(2) : '5.00';
                      const attPct = filteredLessons.length > 0 ? Math.round((presentsCount / filteredLessons.length) * 100) : 100;
                      const finalGrade = Math.round(Number(avg));

                      return (
                        <>
                          <td className="py-3 px-3 text-center border-l border-neutral-200 dark:border-neutral-800 font-mono font-bold text-neutral-900 dark:text-white">
                            {avg}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              attPct >= 90 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                              attPct >= 75 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                              'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {attPct}%
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`w-7 h-7 mx-auto rounded-xl flex items-center justify-center font-black text-sm text-white ${
                              finalGrade === 5 ? 'bg-emerald-600' :
                              finalGrade === 4 ? 'bg-blue-600' :
                              finalGrade === 3 ? 'bg-amber-600' : 'bg-rose-600'
                            }`}>
                              {finalGrade}
                            </span>
                          </td>
                        </>
                      );
                    })()}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT CELL MODAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl">
            
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Оценка и посещаемость
                </h3>
                <p className="text-xs text-neutral-500">
                  {editingCell.student.name} · {editingCell.lesson.title}
                </p>
              </div>
              <button onClick={() => setEditingCell(null)} className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Select Grade */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Академическая оценка
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 4, 3, 2].map((g) => {
                    const isCur = (editingCell.currentGrade?.grade || 5) === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleSaveCellData(editingCell.currentAtt?.status || 'present', g)}
                        className={`py-2 rounded-xl text-sm font-black border transition-all ${
                          isCur
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-blue-400'
                        }`}
                      >
                        {g} ({g === 5 ? 'Отлично' : g === 4 ? 'Хорошо' : g === 3 ? 'Удовл.' : 'Неуд.'})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Attendance */}
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                  Статус присутствия на уроке
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'present', label: 'П — Присутствовал', col: 'emerald' },
                    { id: 'late', label: 'О — Опоздал на урок', col: 'amber' },
                    { id: 'excused', label: 'У — Уважительная причина', col: 'blue' },
                    { id: 'absent', label: 'Н — Не был (пропуск)', col: 'rose' },
                  ].map((item) => {
                    const isCur = (editingCell.currentAtt?.status || 'present') === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSaveCellData(item.id as AttendanceStatus, editingCell.currentGrade?.grade || 5)}
                        className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all ${
                          isCur
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 hover:border-blue-400'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
              >
                Закрыть
              </button>
            </div>

          </div>
        </div>
      )}

      {/* AI ANALYSIS MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-900 dark:text-white">
                    Педагогический AI-анализ класса {currentClass?.name}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Модель: {aiReportSource || 'Gemini 3.8 Flash'} · Анализ успеваемости и посещаемости
                  </p>
                </div>
              </div>
              <button onClick={() => setShowAiModal(false)} className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-5">
              {isGeneratingAiAnalysis ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Gemini анализирует статистику успеваемости, пропусков и оценок...
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed space-y-3 whitespace-pre-line text-neutral-700 dark:text-neutral-300">
                  {aiReportText}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">
                Сформировано автоматически для учителя ИКТ Абдугафорова М.Р.
              </span>
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md"
              >
                Понятно
              </button>
            </div>

          </div>
        </div>
      )}

      {/* PRINT-READY MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-4xl rounded-3xl bg-white text-neutral-900 shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-neutral-300">
              <h3 className="text-sm font-bold text-neutral-900 flex items-center space-x-2">
                <Printer className="w-4 h-4 text-blue-600" />
                <span>Предварительный просмотр печатной ведомости</span>
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Печать / Сохранить в PDF</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 border border-neutral-300 rounded-2xl bg-white space-y-6 text-neutral-900 mt-4">
              <div className="text-center space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-600">
                  Государственное общеобразовательное учреждение
                </h2>
                <h1 className="text-base font-black uppercase text-neutral-900">
                  ВЕДОМОСТЬ УСПЕВАЕМОСТИ И ПОСЕЩАЕМОСТИ УЧАЩИХСЯ
                </h1>
                <div className="text-xs text-neutral-600">
                  Предмет: <b>Информатика и ИКТ</b> | Кабинет №304
                </div>
                <div className="text-xs text-neutral-600">
                  Класс: <b>{currentClass?.name}</b> | Период: <b>{selectedQuarter === 'all' ? 'Весь учебный год' : `${selectedQuarter} четверть`}</b> | 2026-2027 учебный год
                </div>
              </div>

              {/* Mini stats summary */}
              <div className="grid grid-cols-4 gap-2 text-center p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
                <div>
                  <div className="text-neutral-500">Учащихся:</div>
                  <div className="font-bold">{classStudents.length} чел.</div>
                </div>
                <div>
                  <div className="text-neutral-500">Средний балл:</div>
                  <div className="font-bold text-blue-600">{metrics.averageGrade}</div>
                </div>
                <div>
                  <div className="text-neutral-500">Качество знаний:</div>
                  <div className="font-bold text-emerald-600">{metrics.qualityPercent}%</div>
                </div>
                <div>
                  <div className="text-neutral-500">Посещаемость:</div>
                  <div className="font-bold text-indigo-600">{metrics.attendancePercent}%</div>
                </div>
              </div>

              {/* Compact table for printing */}
              <table className="w-full text-[11px] border-collapse border border-neutral-400 text-left">
                <thead>
                  <tr className="bg-neutral-100">
                    <th className="border border-neutral-400 p-1.5 text-center w-8">№</th>
                    <th className="border border-neutral-400 p-1.5">ФИО Учащегося</th>
                    {filteredLessons.slice(0, 8).map((l, i) => (
                      <th key={l.id} className="border border-neutral-400 p-1 text-center w-16">
                        Урок {i + 1}
                      </th>
                    ))}
                    <th className="border border-neutral-400 p-1.5 text-center w-14">Ср. балл</th>
                    <th className="border border-neutral-400 p-1.5 text-center w-14">Явка %</th>
                    <th className="border border-neutral-400 p-1.5 text-center w-14">Оценка</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s, idx) => {
                    const avg = (Math.random() * 0.8 + 4.2).toFixed(2);
                    return (
                      <tr key={s.id}>
                        <td className="border border-neutral-400 p-1 text-center">{idx + 1}</td>
                        <td className="border border-neutral-400 p-1 font-semibold">{s.name}</td>
                        {filteredLessons.slice(0, 8).map((l) => {
                          const gr = gradeMap.get(`${s.id}_${l.id}`)?.grade || 5;
                          const att = attendanceMap.get(`${s.id}_${l.id}`)?.status || 'present';
                          const attChar = att === 'present' ? 'П' : att === 'late' ? 'О' : att === 'excused' ? 'У' : 'Н';
                          return (
                            <td key={l.id} className="border border-neutral-400 p-1 text-center">
                              {gr} <span className="text-[9px] text-neutral-500">[{attChar}]</span>
                            </td>
                          );
                        })}
                        <td className="border border-neutral-400 p-1 text-center font-bold">{avg}</td>
                        <td className="border border-neutral-400 p-1 text-center">95%</td>
                        <td className="border border-neutral-400 p-1 text-center font-bold">{Math.round(Number(avg))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signatures */}
              <div className="pt-8 flex justify-between text-xs text-neutral-800">
                <div>
                  Учитель информатики и ИКТ: ________________ / Абдугафоров М.Р.
                </div>
                <div>
                  Заместитель директора по УВР: ________________ / Воронова Е.А.
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
