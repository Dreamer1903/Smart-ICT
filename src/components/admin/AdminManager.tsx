import React, { useState } from 'react';
import {
  Shield,
  Users,
  School,
  BookOpen,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  FolderKanban,
  FileText,
  Video,
  Code,
  HelpCircle,
  FileCheck,
  Link as LinkIcon,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
  Search,
  Sparkles,
  Filter,
  Layers,
  GraduationCap,
  ArrowRight,
  Clock,
  Terminal,
  LogIn,
  Key,
  RefreshCw,
  Copy,
  Printer
} from 'lucide-react';
import { SchoolClass, Subject, User, UserRole, Lesson } from '../../types';
import { CurriculumUploadGenerator } from './CurriculumUploadGenerator';
import {
  generatePassword,
  generateClassCredentials,
  formatCredentialsForClipboard,
  PasswordFormat,
  GeneratedCredential
} from '../../utils/passwordGenerator';

interface AdminManagerProps {
  classes: SchoolClass[];
  subjects: Subject[];
  users: User[];
  lessons: Lesson[];
  onAddClass: (cls: Omit<SchoolClass, 'id'>) => void;
  onDeleteClass?: (classId: string) => void;
  onAddSubject: (sub: Omit<Subject, 'id'>) => void;
  onDeleteSubject?: (subjectId: string) => void;
  onUpdateUserRole: (userId: string, role: UserRole, classId?: string) => void;
  onUpdateUserPassword?: (userId: string, newPass: string) => void;
  onBulkUpdatePasswords?: (updates: { userId: string; newPassword: string }[]) => void;
  onAddUser?: (newUser: User) => void;
  onDeleteUser?: (userId: string) => void;
  onCreateLesson: (newLesson: Lesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
  onAddExtraMaterial?: (lessonId: string, material: { title: string; url: string; type: string; description: string }) => void;
  onSelectLesson?: (lesson: Lesson) => void;
  onSwitchUser?: (user: User) => void;
}

export const AdminManager: React.FC<AdminManagerProps> = ({
  classes = [],
  subjects = [],
  users = [],
  lessons = [],
  onAddClass,
  onDeleteClass,
  onAddSubject,
  onDeleteSubject,
  onUpdateUserRole,
  onUpdateUserPassword,
  onBulkUpdatePasswords,
  onAddUser,
  onDeleteUser,
  onCreateLesson,
  onDeleteLesson,
  onAddExtraMaterial,
  onSelectLesson,
  onSwitchUser
}) => {
  const safeClasses = classes || [];
  const safeSubjects = subjects || [];
  const safeUsers = users || [];
  const safeLessons = lessons || [];

  const [activeTab, setActiveTab] = useState<'materials' | 'curriculum' | 'classes' | 'subjects' | 'users'>('materials');

  // Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ----------------------------------------------------
  // TAB: MATERIALS & LESSONS STATE
  // ----------------------------------------------------
  const [materialSearch, setMaterialSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);

  // New Lesson Form State
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonTopic, setNewLessonTopic] = useState('');
  const [newLessonDesc, setNewLessonDesc] = useState('');
  const [newLessonSubjectId, setNewLessonSubjectId] = useState(subjects[0]?.id || 'subj-cs');
  const [newLessonGrade, setNewLessonGrade] = useState(10);
  const [newLessonClassIds, setNewLessonClassIds] = useState<string[]>(['10C']);
  const [newLessonDuration, setNewLessonDuration] = useState(45);
  const [newLessonQuarter, setNewLessonQuarter] = useState(1);
  
  // Lesson Materials Config
  const [notesContent, setNotesContent] = useState('');
  const [notesCode, setNotesCode] = useState('def solution():\n    print("Hello from Smart ICT!")\n');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/embed/dQw4w9WgXcQ');
  const [pdfTitle, setPdfTitle] = useState('');
  const [labInstructions, setLabInstructions] = useState('');
  const [labStarterCode, setLabStarterCode] = useState('def solve():\n    # Решение задачи\n    pass\n');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwMaxScore, setHwMaxScore] = useState(100);
  const [quizQuestion, setQuizQuestion] = useState('');
  const [quizOptions, setQuizOptions] = useState(['Вариант A', 'Вариант B', 'Вариант C', 'Вариант D']);
  const [quizCorrectIdx, setQuizCorrectIdx] = useState(0);

  // Quick Add Extra Material Modal State
  const [targetLessonForMaterial, setTargetLessonForMaterial] = useState<Lesson | null>(null);
  const [extraMatTitle, setExtraMatTitle] = useState('');
  const [extraMatUrl, setExtraMatUrl] = useState('');
  const [extraMatType, setExtraMatType] = useState('doc');
  const [extraMatDesc, setExtraMatDesc] = useState('');

  // ----------------------------------------------------
  // TAB: USERS & PASSWORDS STATE
  // ----------------------------------------------------
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  
  // Add User Form State
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('student');
  const [newUserClassId, setNewUserClassId] = useState('10C');

  // Password reset inline state
  const [editingPasswordUserId, setEditingPasswordUserId] = useState<string | null>(null);
  const [tempNewPassword, setTempNewPassword] = useState('');

  // Batch password generator state
  const [isBatchGeneratingPasswords, setIsBatchGeneratingPasswords] = useState(false);
  const [batchPasswordClass, setBatchPasswordClass] = useState<string>('all');
  const [batchPasswordFormat, setBatchPasswordFormat] = useState<PasswordFormat>('school');
  const [batchStagedCredentials, setBatchStagedCredentials] = useState<GeneratedCredential[]>([]);
  const [batchCopiedNotification, setBatchCopiedNotification] = useState<string | null>(null);
  const [showBatchPrintCards, setShowBatchPrintCards] = useState(false);

  // ----------------------------------------------------
  // TAB: CLASSES STATE
  // ----------------------------------------------------
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(10);
  const [newClassDesc, setNewClassDesc] = useState('');

  // ----------------------------------------------------
  // TAB: SUBJECTS STATE
  // ----------------------------------------------------
  const [newSubName, setNewSubName] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [newSubColor, setNewSubColor] = useState('#2563eb');

  // ----------------------------------------------------
  // HANDLERS: LESSONS & MATERIALS
  // ----------------------------------------------------
  const handleToggleClassForNewLesson = (cId: string) => {
    setNewLessonClassIds(prev =>
      prev.includes(cId) ? prev.filter(x => x !== cId) : [...prev, cId]
    );
  };

  const handleCreateFullLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim() || newLessonClassIds.length === 0) {
      showToast('Укажите название урока и хотя бы один целевой класс.');
      return;
    }

    const created: Lesson = {
      id: `les-${Date.now()}`,
      title: newLessonTitle.trim(),
      slug: newLessonTitle.toLowerCase().replace(/\s+/g, '-'),
      topic: newLessonTopic.trim() || 'Информатика и программирование',
      description: newLessonDesc.trim() || 'Интерактивный учебный модуль с материалами и практикумом.',
      subjectId: newLessonSubjectId,
      grade: newLessonGrade,
      classIds: newLessonClassIds,
      quarter: newLessonQuarter,
      orderNumber: lessons.length + 1,
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
      durationMinutes: newLessonDuration,
      notes: {
        sections: [
          {
            title: `1. Теоретический конспект: ${newLessonTitle}`,
            content: notesContent.trim() || `Основные теоретические положения по теме «${newLessonTitle}».`,
            codeExample: notesCode.trim() || undefined,
            codeLanguage: 'python'
          }
        ],
        keyTakeaways: [
          'Усвоить фундаментальные понятия темы',
          'Закрепить полученные знания на практике в Python'
        ],
        readTimeMinutes: 8
      },
      slides: [
        {
          id: 'slide-1',
          title: newLessonTitle,
          bullets: [
            'Введение в проблематику урока',
            'Основные правила и синтаксические конструкции',
            'Примеры типовых задач и решений'
          ],
          codeSnippet: notesCode.trim(),
          slideNumber: 1
        }
      ],
      video: {
        title: `Видеолекция: ${newLessonTitle}`,
        durationMinutes: 15,
        youtubeUrl: videoUrl.trim() || 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc13c744ef5?w=800&auto=format&fit=crop&q=80',
        chapters: [
          { time: '00:00', title: 'Введение' },
          { time: '05:00', title: 'Разбор теории' },
          { time: '10:00', title: 'Практическая часть' }
        ]
      },
      pdf: {
        title: pdfTitle.trim() || `Методическое руководство: ${newLessonTitle}`,
        fileSize: '1.5 MB',
        pageCount: 8,
        url: '#'
      },
      lab: {
        title: `Лабораторная работа: ${newLessonTitle}`,
        instructions: labInstructions.trim() || 'Напишите функцию решения задачи и проверьте ее работу на тестах.',
        starterCode: labStarterCode.trim() || 'def solve():\n    pass\n',
        testCases: [
          { input: 'test1', expectedOutput: 'OK' },
          { input: 'test2', expectedOutput: 'True' }
        ],
        hint: 'Обратите внимание на граничные случаи и типы передаваемых данных.'
      },
      homework: {
        title: hwTitle.trim() || `ДЗ: ${newLessonTitle}`,
        description: hwDesc.trim() || 'Решите задачи из конспекта и прикрепите архив с исходным кодом на проверку.',
        deadline: '25 октября 2026, 23:59',
        maxScore: hwMaxScore,
        criteria: [
          'Корректность алгоритма (50 баллов)',
          'Чистота кода и оформление по PEP-8 (30 баллов)',
          'Оптимальная временная сложность (20 баллов)'
        ]
      },
      extraMaterials: [
        {
          id: `ext-1`,
          title: 'Официальная документация Python 3.12',
          type: 'link',
          url: 'https://docs.python.org/3/',
          description: 'Справочник стандартной библиотеки языка'
        }
      ],
      test: {
        id: `test-${Date.now()}`,
        title: `Контрольный тест: ${newLessonTitle}`,
        timeLimitMinutes: 15,
        rewardXp: 100,
        questions: [
          {
            id: 'q1',
            text: quizQuestion.trim() || `Что является ключевой особенностью темы «${newLessonTitle}»?`,
            type: 'single_choice',
            options: quizOptions,
            correctAnswer: quizCorrectIdx,
            points: 100,
            explanation: 'Правильный ответ основан на материале конспекта.'
          }
        ]
      }
    };

    onCreateLesson(created);
    setIsCreatingLesson(false);
    showToast(`Урок и материалы «${created.title}» успешно добавлены в платформу!`);

    // Reset fields
    setNewLessonTitle('');
    setNewLessonTopic('');
    setNewLessonDesc('');
    setNotesContent('');
  };

  const handleSaveExtraMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLessonForMaterial || !extraMatTitle.trim()) return;

    if (onAddExtraMaterial) {
      onAddExtraMaterial(targetLessonForMaterial.id, {
        title: extraMatTitle.trim(),
        url: extraMatUrl.trim() || '#',
        type: extraMatType,
        description: extraMatDesc.trim() || 'Дополнительный учебный материал'
      });
      showToast(`Материал «${extraMatTitle}» прикреплен к уроку!`);
    }

    setTargetLessonForMaterial(null);
    setExtraMatTitle('');
    setExtraMatUrl('');
    setExtraMatDesc('');
  };

  // ----------------------------------------------------
  // HANDLERS: CLASSES & SUBJECTS
  // ----------------------------------------------------
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    onAddClass({
      name: newClassName.trim(),
      grade: Number(newClassGrade),
      academicYear: '2026-2027',
      studentCount: 0,
      description: newClassDesc.trim() || undefined
    });
    setNewClassName('');
    setNewClassDesc('');
    showToast(`Класс «${newClassName}» успешно создан!`);
  };

  const handleCreateSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    onAddSubject({
      name: newSubName.trim(),
      slug: newSubName.toLowerCase().replace(/\s+/g, '-'),
      description: newSubDesc.trim() || 'Новое учебное направление',
      color: newSubColor,
      lessonCount: 0
    });
    setNewSubName('');
    setNewSubDesc('');
    showToast(`Предмет «${newSubName}» добавлен!`);
  };

  // ----------------------------------------------------
  // HANDLERS: USERS
  // ----------------------------------------------------
  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      showToast('Заполните имя, email и пароль пользователя.');
      return;
    }

    const newUser: User = {
      id: `usr-${Date.now()}`,
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      password: newUserPassword.trim(),
      role: newUserRole,
      classId: newUserRole === 'student' ? newUserClassId : undefined,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(newUserName)}`,
      xp: newUserRole === 'student' ? 100 : 9999,
      level: 1,
      streakDays: 1,
      completedLessons: [],
      badges: ['badge-first-step'],
      registeredAt: new Date().toISOString().split('T')[0]
    };

    if (onAddUser) {
      onAddUser(newUser);
      showToast(`Пользователь «${newUser.name}» (${newUser.role}) успешно создан с паролем «${newUser.password}»!`);
      setIsAddingUser(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
    }
  };

  const handleSavePasswordChange = (userId: string) => {
    if (!tempNewPassword.trim()) return;
    if (onUpdateUserPassword) {
      onUpdateUserPassword(userId, tempNewPassword.trim());
      showToast('Пароль пользователя успешно изменен!');
    }
    setEditingPasswordUserId(null);
    setTempNewPassword('');
  };

  const handleGeneratePasswordForForm = (format: PasswordFormat = 'school') => {
    const generated = generatePassword(format);
    setNewUserPassword(generated);
    showToast(`Сгенерирован пароль: ${generated}`);
  };

  const handleQuickGenerateForStudent = (userId: string, userName: string) => {
    const newPass = generatePassword('school');
    if (onUpdateUserPassword) {
      onUpdateUserPassword(userId, newPass);
      showToast(`Сгенерирован новый пароль для ${userName}: ${newPass}`);
    }
  };

  const eligibleBatchStudents = safeUsers.filter(u => {
    if (u.role !== 'student') return false;
    if (batchPasswordClass === 'all') return true;
    return u.classId === batchPasswordClass;
  });

  const handleGenerateBatchPasswords = () => {
    const creds = generateClassCredentials(
      eligibleBatchStudents.map(s => ({
        id: s.id,
        name: s.name,
        email: s.email,
        classId: s.classId
      })),
      batchPasswordFormat
    );
    setBatchStagedCredentials(creds);
    showToast(`Сгенерированы новые пароли для ${creds.length} учеников. Нажмите «Применить» для сохранения.`);
  };

  const handleApplyBatchPasswords = () => {
    if (batchStagedCredentials.length === 0) return;
    if (onBulkUpdatePasswords) {
      onBulkUpdatePasswords(batchStagedCredentials.map(c => ({ userId: c.userId, newPassword: c.password })));
    } else if (onUpdateUserPassword) {
      batchStagedCredentials.forEach(c => onUpdateUserPassword(c.userId, c.password));
    }
    showToast(`Успешно обновлены пароли для ${batchStagedCredentials.length} учеников!`);
  };

  const handleCopyBatchCredentials = () => {
    if (batchStagedCredentials.length === 0) return;
    const className = batchPasswordClass === 'all' ? 'Все классы' : safeClasses.find(c => c.id === batchPasswordClass)?.name;
    const text = formatCredentialsForClipboard(batchStagedCredentials, className);
    navigator.clipboard.writeText(text);
    setBatchCopiedNotification('Скопировано в буфер!');
    setTimeout(() => setBatchCopiedNotification(null), 3000);
  };

  // Filter lessons
  const filteredLessons = safeLessons.filter(l => {
    const matchesSearch = (l.title || '').toLowerCase().includes(materialSearch.toLowerCase()) ||
                          (l.topic || '').toLowerCase().includes(materialSearch.toLowerCase());
    const matchesClass = selectedClassFilter === 'all' || (l.classIds || []).includes(selectedClassFilter);
    const matchesSubject = selectedSubjectFilter === 'all' || l.subjectId === selectedSubjectFilter;
    return matchesSearch && matchesClass && matchesSubject;
  });

  // Filter users
  const filteredUsers = safeUsers.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-2xl flex items-center space-x-3 border border-neutral-700 animate-in slide-in-from-bottom-5">
          <Check className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-blue-900/30 border border-purple-500/20 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Центр управления образовательной платформой</span>
              </span>
              <span className="text-xs text-neutral-400">Версия 2.4 · PostgreSQL 16</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Панель администратора Smart ICT
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl mt-1">
              Управление учебными материалами (конспекты, слайды, тесты, Python-лабораторные), учетными записями, ролями и классами.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-white/10 dark:bg-neutral-900/60 backdrop-blur-md border border-white/10 text-center">
              <div className="text-xl font-black text-white">{lessons.length}</div>
              <div className="text-[10px] uppercase font-bold text-neutral-300">Уроков</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 dark:bg-neutral-900/60 backdrop-blur-md border border-white/10 text-center">
              <div className="text-xl font-black text-white">{classes.length}</div>
              <div className="text-[10px] uppercase font-bold text-neutral-300">Классов</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 dark:bg-neutral-900/60 backdrop-blur-md border border-white/10 text-center">
              <div className="text-xl font-black text-white">{users.length}</div>
              <div className="text-[10px] uppercase font-bold text-neutral-300">Аккаунтов</div>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 dark:bg-neutral-900/60 backdrop-blur-md border border-white/10 text-center">
              <div className="text-xl font-black text-white">{subjects.length}</div>
              <div className="text-[10px] uppercase font-bold text-neutral-300">Предмета</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div className="flex flex-wrap rounded-2xl bg-neutral-100 dark:bg-neutral-800 p-1 gap-1">
          <button
            onClick={() => setActiveTab('curriculum')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'curriculum'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Годовой план & AI-генерация (Gemini)</span>
          </button>
          <button
            onClick={() => setActiveTab('materials')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'materials'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Учебные материалы & Уроки ({lessons.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-neutral-900 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Пользователи и пароли ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'classes'
                ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <School className="w-4 h-4" />
            <span>Классы ({classes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('subjects')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              activeTab === 'subjects'
                ? 'bg-white dark:bg-neutral-900 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Предметы ({subjects.length})</span>
          </button>
        </div>

        {/* Action Button depending on tab */}
        {activeTab === 'materials' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('curriculum')}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Импорт плана на год (КТП)</span>
            </button>
            <button
              onClick={() => setIsCreatingLesson(!isCreatingLesson)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingLesson ? 'Скрыть форму' : 'Создать вручную'}</span>
            </button>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsBatchGeneratingPasswords(!isBatchGeneratingPasswords)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1.5 ${
                isBatchGeneratingPasswords
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              <Key className="w-4 h-4" />
              <span>{isBatchGeneratingPasswords ? 'Скрыть генератор' : 'Генератор паролей ученикам'}</span>
            </button>

            <button
              onClick={() => {
                setIsAddingUser(!isAddingUser);
                if (!newUserPassword) {
                  setNewUserPassword(generatePassword('school'));
                }
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-500/20 transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isAddingUser ? 'Скрыть форму' : 'Добавить пользователя'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB: CURRICULUM & ANNUAL PLAN AI GENERATOR */}
      {/* ========================================================================= */}
      {activeTab === 'curriculum' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <CurriculumUploadGenerator
            classes={safeClasses}
            onAddLessons={(newLessons) => {
              newLessons.forEach((nl) => onCreateLesson(nl));
              showToast(`Успешно добавлено ${newLessons.length} уроков из годового плана в базу!`);
              setActiveTab('materials');
            }}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MATERIALS & LESSONS */}
      {/* ========================================================================= */}
      {activeTab === 'materials' && (
        <div className="space-y-6">

          {/* CREATE NEW LESSON / MATERIAL FORM (Expandable) */}
          {isCreatingLesson && (
            <form onSubmit={handleCreateFullLesson} className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-6 animate-in slide-in-from-top-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <span>Конструктор нового урока и учебных материалов</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Заполните информацию и прикрепите 9 интерактивных модулей (конспект, видео, Python-практикум, тесты)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreatingLesson(false)}
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  Отмена
                </button>
              </div>

              {/* 1. Basic Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Название урока *
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Структуры данных: Стек, Очередь и Дек на Python"
                    value={newLessonTitle}
                    onChange={(e) => setNewLessonTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Учебное направление / Предмет
                  </label>
                  <select
                    value={newLessonSubjectId}
                    onChange={(e) => setNewLessonSubjectId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-medium"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Тематический блок (Раздел)
                  </label>
                  <input
                    type="text"
                    placeholder="Например: Алгоритмы и сложность"
                    value={newLessonTopic}
                    onChange={(e) => setNewLessonTopic(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Параллель (класс)
                  </label>
                  <select
                    value={newLessonGrade}
                    onChange={(e) => setNewLessonGrade(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-medium"
                  >
                    {[5, 6, 7, 8, 9, 10, 11].map(g => (
                      <option key={g} value={g}>{g} класс</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Длительность занятия
                  </label>
                  <input
                    type="number"
                    value={newLessonDuration}
                    onChange={(e) => setNewLessonDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                    min={20}
                    max={180}
                  />
                </div>
              </div>

              {/* Target Classes Selection */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Классы, которым доступен этот урок (RLS изоляция) *
                </label>
                <div className="flex flex-wrap gap-2">
                  {classes.map(cls => {
                    const isSelected = newLessonClassIds.includes(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => handleToggleClassForNewLesson(cls.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
                        }`}
                      >
                        {cls.name} ({cls.grade} кл.)
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Materials Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                
                {/* Notes & Code */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Конспект урока и пример кода Python</span>
                  </h4>
                  <textarea
                    rows={3}
                    placeholder="Теоретический конспект к уроку..."
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    className="w-full p-3 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                  <textarea
                    rows={4}
                    placeholder="Пример кода на Python..."
                    value={notesCode}
                    onChange={(e) => setNotesCode(e.target.value)}
                    className="w-full p-3 text-xs font-mono rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-900 text-emerald-400"
                  />
                </div>

                {/* Lab starter code */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center space-x-1.5">
                    <Code className="w-4 h-4 text-emerald-500" />
                    <span>Лабораторный практикум (Python Sandbox)</span>
                  </h4>
                  <input
                    type="text"
                    placeholder="Инструкция к лабораторной работе"
                    value={labInstructions}
                    onChange={(e) => setLabInstructions(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                  <textarea
                    rows={4}
                    placeholder="def solve():\n    pass"
                    value={labStarterCode}
                    onChange={(e) => setLabStarterCode(e.target.value)}
                    className="w-full p-3 text-xs font-mono rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-900 text-emerald-400"
                  />
                </div>

                {/* Video & PDF */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center space-x-1.5">
                    <Video className="w-4 h-4 text-red-500" />
                    <span>Видеоурок и PDF-пособие</span>
                  </h4>
                  <input
                    type="url"
                    placeholder="Ссылка на видео (YouTube embed URL)"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                  <input
                    type="text"
                    placeholder="Название методического PDF файла"
                    value={pdfTitle}
                    onChange={(e) => setPdfTitle(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                </div>

                {/* Homework & Test */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-white flex items-center space-x-1.5">
                    <HelpCircle className="w-4 h-4 text-purple-500" />
                    <span>Домашнее задание и контрольный вопрос</span>
                  </h4>
                  <input
                    type="text"
                    placeholder="Тема домашнего задания"
                    value={hwTitle}
                    onChange={(e) => setHwTitle(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                  <input
                    type="text"
                    placeholder="Контрольный вопрос для теста"
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  />
                </div>

              </div>

              {/* Submit */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingLesson(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Опубликовать урок и все материалы</span>
                </button>
              </div>
            </form>
          )}

          {/* FILTER AND SEARCH CONTROLS */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Поиск по урокам и материалам..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-semibold"
              >
                <option value="all">Все классы</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>Класс {c.name}</option>
                ))}
              </select>

              <select
                value={selectedSubjectFilter}
                onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-semibold"
              >
                <option value="all">Все предметы</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* LESSONS & MATERIALS LIST */}
          <div className="space-y-4">
            {filteredLessons.map((lesson) => {
              const lessonSubject = subjects.find(s => s.id === lesson.subjectId);
              return (
                <div
                  key={lesson.id}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: lessonSubject?.color || '#2563eb' }}
                        >
                          {lessonSubject?.name || 'Информатика'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          {lesson.grade} класс
                        </span>
                        <div className="flex items-center space-x-1">
                          {lesson.classIds.map(cId => {
                            const cls = classes.find(c => c.id === cId);
                            return (
                              <span key={cId} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                                {cls?.name || cId}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                        {lesson.title}
                      </h3>
                      <p className="text-xs text-neutral-500 line-clamp-1">
                        {lesson.description}
                      </p>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => setTargetLessonForMaterial(lesson)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center space-x-1.5"
                        title="Прикрепить дополнительную статью, документацию или файл"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Добавить материал</span>
                      </button>

                      {onSelectLesson && (
                        <button
                          onClick={() => onSelectLesson(lesson)}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center space-x-1.5"
                          title="Открыть урок на платформе"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Просмотр</span>
                        </button>
                      )}

                      {onDeleteLesson && (
                        <button
                          onClick={() => {
                            if (confirm(`Удалить урок «${lesson.title}» и связанные материалы?`)) {
                              onDeleteLesson(lesson.id);
                              showToast(`Урок «${lesson.title}» удален.`);
                            }
                          }}
                          className="p-1.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                          title="Удалить урок"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Attached Materials Badges */}
                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
                    <span className="font-semibold text-neutral-400">Прикрепленные модули:</span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      <FileText className="w-3 h-3 text-blue-500" />
                      <span>Конспект ({lesson.notes.sections.length})</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      <Video className="w-3 h-3 text-red-500" />
                      <span>Видео ({lesson.video.durationMinutes} мин)</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      <Terminal className="w-3 h-3 text-emerald-500" />
                      <span>Python Lab ({lesson.lab.testCases.length} теста)</span>
                    </span>
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      <FileCheck className="w-3 h-3 text-purple-500" />
                      <span>ДЗ ({lesson.homework.maxScore} б.)</span>
                    </span>
                    {lesson.extraMaterials && lesson.extraMaterials.length > 0 && (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                        <LinkIcon className="w-3 h-3 text-amber-500" />
                        <span>Доп. материалы ({lesson.extraMaterials.length})</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredLessons.length === 0 && (
              <div className="p-12 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-400">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">Уроки по заданным критериям не найдены</p>
                <p className="text-xs mt-1">Нажмите «Добавить новый урок / материал», чтобы создать первый модуль.</p>
              </div>
            )}
          </div>

          {/* MODAL: ADD EXTRA MATERIAL TO LESSON */}
          {targetLessonForMaterial && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
              <div className="relative w-full max-w-md rounded-3xl p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Добавить материал к уроку</span>
                </h3>
                <p className="text-xs text-neutral-500">
                  Урок: «{targetLessonForMaterial.title}»
                </p>

                <form onSubmit={handleSaveExtraMaterial} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Название материала *
                    </label>
                    <input
                      type="text"
                      placeholder="Например: Шпаргалка по методам списков (PDF)"
                      value={extraMatTitle}
                      onChange={(e) => setExtraMatTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Ссылка / URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://... или #"
                      value={extraMatUrl}
                      onChange={(e) => setExtraMatUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Тип ресурса
                    </label>
                    <select
                      value={extraMatType}
                      onChange={(e) => setExtraMatType(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-semibold"
                    >
                      <option value="doc">Документ / Методичка</option>
                      <option value="link">Ссылка на сайт / GitHub</option>
                      <option value="video">Дополнительное видео</option>
                      <option value="code">Исходный код программы</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      Краткое описание
                    </label>
                    <input
                      type="text"
                      placeholder="Рекомендовано для углубленного изучения"
                      value={extraMatDesc}
                      onChange={(e) => setExtraMatDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setTargetLessonForMaterial(null)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Прикрепить
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: USERS & PASSWORDS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-6">

          {/* BATCH STUDENT PASSWORD GENERATOR (Expandable Panel) */}
          {isBatchGeneratingPasswords && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-50/70 to-orange-50/70 dark:from-neutral-900 dark:to-neutral-900 border border-amber-300 dark:border-amber-900/60 shadow-xl space-y-4 animate-in slide-in-from-top-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center space-x-2">
                    <Key className="w-4 h-4 text-amber-600" />
                    <span>Массовая генерация школьных паролей для учеников</span>
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Автоматически сгенерируйте и примените удобные пароли ко всем ученикам выбранного класса.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowBatchPrintCards(!showBatchPrintCards)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center space-x-1 ${
                      showBatchPrintCards
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{showBatchPrintCards ? 'Скрыть карточки' : 'Карточки для печати'}</span>
                  </button>

                  {batchStagedCredentials.length > 0 && (
                    <button
                      onClick={handleCopyBatchCredentials}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 transition-all flex items-center space-x-1"
                    >
                      {batchCopiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{batchCopiedNotification || 'Копировать ведомость'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="p-4 rounded-2xl bg-white/80 dark:bg-neutral-800/80 border border-amber-200 dark:border-amber-900/50 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Класс учеников:
                  </label>
                  <select
                    value={batchPasswordClass}
                    onChange={(e) => setBatchPasswordClass(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                  >
                    <option value="all">Все классы ({safeUsers.filter(u => u.role === 'student').length} уч.)</option>
                    {safeClasses.map(c => {
                      const count = safeUsers.filter(u => u.role === 'student' && u.classId === c.id).length;
                      return <option key={c.id} value={c.id}>Класс {c.name} ({count} уч.)</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Формат пароля:
                  </label>
                  <select
                    value={batchPasswordFormat}
                    onChange={(e) => setBatchPasswordFormat(e.target.value as PasswordFormat)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-bold"
                  >
                    <option value="school">Школьный ИКТ (ict-4892, py-7310)</option>
                    <option value="mnemonic">Мнемонический (learn-48x)</option>
                    <option value="pin">PIN-код (6 цифр: 839104)</option>
                    <option value="secure">Сложный (A7#mQ9!v)</option>
                  </select>
                </div>

                <div>
                  <button
                    onClick={handleGenerateBatchPasswords}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition-all flex items-center justify-center space-x-1.5 shadow-md shadow-amber-600/20"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Сгенерировать ({eligibleBatchStudents.length})</span>
                  </button>
                </div>

                <div>
                  <button
                    onClick={handleApplyBatchPasswords}
                    disabled={batchStagedCredentials.length === 0}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                      batchStagedCredentials.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 cursor-pointer'
                        : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Применить ({batchStagedCredentials.length})</span>
                  </button>
                </div>
              </div>

              {/* Printable cards in Admin */}
              {showBatchPrintCards && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-2">
                  {(batchStagedCredentials.length > 0 ? batchStagedCredentials : eligibleBatchStudents.map(s => ({
                    userId: s.id,
                    userName: s.name,
                    userEmail: s.email,
                    classId: s.classId,
                    password: s.password || 'student123'
                  }))).map(cred => (
                    <div key={cred.userId} className="p-3 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-[10px] text-blue-600">
                        <span>Smart ICT · Кабинет</span>
                        <span>{cred.classId || 'Класс'}</span>
                      </div>
                      <div className="font-bold text-neutral-900 dark:text-white truncate">{cred.userName}</div>
                      <div className="text-[11px] text-neutral-500 font-mono truncate">Логин: {cred.userEmail}</div>
                      <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex justify-between font-mono font-bold text-amber-800 dark:text-amber-300">
                        <span>Пароль:</span>
                        <span>{cred.password}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ADD USER FORM (Expandable) */}
          {isAddingUser && (
            <form onSubmit={handleCreateUser} className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xl space-y-4 animate-in slide-in-from-top-4">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Создание нового пользователя платформы с паролем</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">ФИО</label>
                  <input
                    type="text"
                    placeholder="Например: Иван Петров"
                    value={newUserName}
                    onChange={(e) => {
                      setNewUserName(e.target.value);
                      if (!newUserEmail && e.target.value.trim().length > 3) {
                        const translit = e.target.value.toLowerCase().replace(/[^a-zа-я0-9]/gi, '').slice(0, 10);
                        setNewUserEmail(`${translit}@school.edu`);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="ivan@school.edu"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Пароль</label>
                    <button
                      type="button"
                      onClick={() => handleGeneratePasswordForForm('school')}
                      className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center space-x-0.5"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Авто-пароль</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Пароль для входа"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-mono pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => handleGeneratePasswordForForm('school')}
                      className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-amber-500 transition-colors"
                      title="Сгенерировать случайный школьный пароль"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Роль</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 font-bold"
                  >
                    <option value="student">Ученик</option>
                    <option value="teacher">Учитель</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
              </div>

              {/* Password generation presets */}
              {newUserRole === 'student' && (
                <div className="flex items-center space-x-2 text-[11px] pt-1">
                  <span className="text-neutral-500 font-medium">Формат генерации пароля:</span>
                  <button
                    type="button"
                    onClick={() => handleGeneratePasswordForForm('school')}
                    className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold hover:bg-amber-200 transition-colors"
                  >
                    Школьный (ict-XXXX)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGeneratePasswordForForm('pin')}
                    className="px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold hover:bg-blue-200 transition-colors"
                  >
                    PIN-код (6 цифр)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGeneratePasswordForForm('mnemonic')}
                    className="px-2 py-0.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 font-semibold hover:bg-purple-200 transition-colors"
                  >
                    Мнемонический
                  </button>
                </div>
              )}

              {newUserRole === 'student' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">Класс обучения</label>
                  <div className="flex flex-wrap gap-2">
                    {classes.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setNewUserClassId(c.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                          newUserClassId === c.id
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-neutral-500"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700"
                >
                  Зарегистрировать пользователя
                </button>
              </div>
            </form>
          )}

          {/* User Filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Поиск по имени или email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUserRoleFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  userRoleFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                Все ({safeUsers.length})
              </button>
              <button
                onClick={() => setUserRoleFilter('student')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  userRoleFilter === 'student' ? 'bg-blue-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                Ученики ({safeUsers.filter(u => u.role === 'student').length})
              </button>
              <button
                onClick={() => setUserRoleFilter('teacher')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  userRoleFilter === 'teacher' ? 'bg-emerald-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                Учителя ({safeUsers.filter(u => u.role === 'teacher').length})
              </button>
              <button
                onClick={() => setUserRoleFilter('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  userRoleFilter === 'admin' ? 'bg-purple-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}
              >
                Админы ({safeUsers.filter(u => u.role === 'admin').length})
              </button>
            </div>
          </div>

          {/* Users Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-neutral-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-3">Пользователь</th>
                  <th className="pb-3">Роль в системе</th>
                  <th className="pb-3">Класс</th>
                  <th className="pb-3">Пароль учетной записи</th>
                  <th className="pb-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredUsers.map((user) => {
                  const isPasswordVisible = !!visiblePasswords[user.id];
                  const uClass = classes.find(c => c.id === user.classId);
                  const isEditingPassword = editingPasswordUserId === user.id;

                  return (
                    <tr key={user.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                      
                      {/* Name & Avatar */}
                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-3">
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-xl object-cover ring-1 ring-neutral-300 dark:ring-neutral-700"
                          />
                          <div>
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {user.name}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Selector */}
                      <td className="py-3 pr-4">
                        <select
                          value={user.role}
                          onChange={(e) => {
                            onUpdateUserRole(user.id, e.target.value as UserRole, user.classId);
                            showToast(`Роль пользователя «${user.name}» изменена на ${e.target.value}`);
                          }}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border ${
                            user.role === 'admin'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-600 border-purple-300 dark:border-purple-800'
                              : user.role === 'teacher'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 border-emerald-300 dark:border-emerald-800'
                              : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 border-blue-300 dark:border-blue-800'
                          }`}
                        >
                          <option value="student">Ученик</option>
                          <option value="teacher">Учитель</option>
                          <option value="admin">Администратор</option>
                        </select>
                      </td>

                      {/* Class */}
                      <td className="py-3 pr-4">
                        {user.role === 'student' ? (
                          <select
                            value={user.classId || ''}
                            onChange={(e) => {
                              onUpdateUserRole(user.id, user.role, e.target.value);
                              showToast(`Класс пользователя «${user.name}» изменен на ${e.target.value}`);
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-semibold border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                          >
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>Класс {c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-neutral-400 italic text-[11px]">Все классы</span>
                        )}
                      </td>

                      {/* Password Viewer & Changer */}
                      <td className="py-3 pr-4">
                        {isEditingPassword ? (
                          <div className="flex items-center space-x-1.5">
                            <input
                              type="text"
                              placeholder="Новый пароль"
                              value={tempNewPassword}
                              onChange={(e) => setTempNewPassword(e.target.value)}
                              className="px-2 py-1 text-xs rounded-lg border border-purple-400 bg-white dark:bg-neutral-800 font-mono w-28"
                            />
                            <button
                              type="button"
                              onClick={() => setTempNewPassword(generatePassword(user.role === 'student' ? 'school' : 'secure'))}
                              className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200"
                              title="Сгенерировать случайный пароль"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleSavePasswordChange(user.id)}
                              className="p-1 rounded-lg bg-emerald-600 text-white"
                              title="Сохранить"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingPasswordUserId(null)}
                              className="p-1 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-600"
                              title="Отмена"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-neutral-700 dark:text-neutral-300 font-bold">
                              {isPasswordVisible ? (user.password || 'student123') : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
                              title={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                            >
                              {isPasswordVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPasswordUserId(user.id);
                                setTempNewPassword(user.password || '');
                              }}
                              className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline ml-1"
                            >
                              Сменить
                            </button>
                            {user.role === 'student' && (
                              <button
                                onClick={() => handleQuickGenerateForStudent(user.id, user.name)}
                                className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline ml-1 font-semibold flex items-center space-x-0.5"
                                title="Сгенерировать новый школьный пароль для ученика"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>Авто</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 text-right space-x-1.5">
                        {onSwitchUser && (
                          <button
                            onClick={() => {
                              onSwitchUser(user);
                              showToast(`Вы вошли под пользователем «${user.name}»`);
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors inline-flex items-center space-x-1"
                            title="Мгновенно протестировать права и кабинет этого пользователя"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>Тест входа</span>
                          </button>
                        )}

                        {onDeleteUser && users.length > 1 && (
                          <button
                            onClick={() => {
                              if (confirm(`Удалить пользователя «${user.name}»?`)) {
                                onDeleteUser(user.id);
                                showToast(`Пользователь «${user.name}» удален.`);
                              }
                            }}
                            className="p-1 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Удалить"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* TAB 3: CLASSES */}
      {/* ========================================================================= */}
      {activeTab === 'classes' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateClass} className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>Создать новый учебный класс</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Название (например, 10-D или 8-Б)"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  required
                />
              </div>
              <div>
                <input
                  type="number"
                  placeholder="Параллель (5-11)"
                  min={5}
                  max={11}
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  required
                />
              </div>
              <div>
                <button
                  type="submit"
                  className="w-full py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors"
                >
                  Создать класс
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {safeClasses.map((cls) => {
              const studentsInClass = safeUsers.filter(u => u.classId === cls.id && u.role === 'student').length;
              return (
                <div
                  key={cls.id}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                      Класс {cls.name}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {studentsInClass} зарегистрированных учеников
                    </p>
                    {cls.description && (
                      <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">
                        {cls.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                      {cls.grade}
                    </div>
                    {onDeleteClass && classes.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Удалить класс «${cls.name}»?`)) {
                            onDeleteClass(cls.id);
                            showToast(`Класс «${cls.name}» удален.`);
                          }
                        }}
                        className="p-1.5 rounded-xl text-red-400 hover:text-red-600"
                        title="Удалить класс"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SUBJECTS */}
      {/* ========================================================================= */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateSubject} className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Plus className="w-4 h-4 text-amber-600" />
              <span>Добавить предмет или спецкурс</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <input
                  type="text"
                  placeholder="Название (например: ИИ и Машинное обучение)"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="Краткое описание программы курса"
                  value={newSubDesc}
                  onChange={(e) => setNewSubDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={newSubColor}
                  onChange={(e) => setNewSubColor(e.target.value)}
                  className="w-10 h-8 rounded-xl border-0 cursor-pointer"
                  title="Выбрать цвет"
                />
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition-colors"
                >
                  Создать
                </button>
              </div>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {safeSubjects.map((sub) => {
              const subjectLessonsCount = safeLessons.filter(l => l.subjectId === sub.id).length;
              return (
                <div
                  key={sub.id}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: sub.color }}
                      >
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                          {sub.name}
                        </h4>
                        <span className="text-xs text-neutral-500">
                          {subjectLessonsCount} учебных уроков
                        </span>
                      </div>
                    </div>

                    {onDeleteSubject && subjects.length > 1 && (
                      <button
                        onClick={() => {
                          if (confirm(`Удалить направление «${sub.name}»?`)) {
                            onDeleteSubject(sub.id);
                            showToast(`Направление «${sub.name}» удалено.`);
                          }
                        }}
                        className="p-1 text-neutral-400 hover:text-red-500"
                        title="Удалить предмет"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400">
                    {sub.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
};
