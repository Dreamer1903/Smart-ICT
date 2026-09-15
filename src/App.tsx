import React, { useState, useEffect } from 'react';
import {
  MOCK_USERS,
  MOCK_CLASSES,
  MOCK_SUBJECTS,
  MOCK_LESSONS,
  MOCK_SUBMISSIONS,
  MOCK_ANNOUNCEMENTS,
  MOCK_NOTIFICATIONS,
  MOCK_BADGES
} from './data/mockData';
import {
  User,
  SchoolClass,
  Subject,
  Lesson,
  HomeworkSubmission,
  Announcement,
  AppNotification,
  GamificationBadge,
  UserRole
} from './types';

// Router
import { RouterProvider, useRouter } from './router/RouterContext';

// Components
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { NotificationsModal } from './components/layout/NotificationsModal';
import { AuthModal } from './components/auth/AuthModal';
import { HeroSection } from './components/landing/HeroSection';
import { StudentDashboard } from './components/dashboard/StudentDashboard';
import { TeacherDashboard } from './components/dashboard/TeacherDashboard';
import { LessonList } from './components/lessons/LessonList';
import { LessonDetail } from './components/lessons/LessonDetail';
import { GamificationView } from './components/gamification/GamificationView';
import { CalendarView } from './components/calendar/CalendarView';
import { SpotlightSearch } from './components/search/SpotlightSearch';
import { ArchitectureStudio } from './components/architecture/ArchitectureStudio';
import { AdminManager } from './components/admin/AdminManager';
import { TeacherReviewModal } from './components/homework/TeacherReviewModal';
import { CreateLessonModal } from './components/lessons/CreateLessonModal';
import { AiAssistantDrawer } from './components/lessons/cards/AiAssistantDrawer';

// Multi-page subpages
import { HomeworkPage } from './pages/HomeworkPage';
import { AboutPage } from './pages/AboutPage';
import { FaqPage } from './pages/FaqPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Shield } from 'lucide-react';

function AppContent() {
  const { currentPath, navigate } = useRouter();

  // Theme state
  const [isDark, setIsDark] = useState(true);

  // Core Data State with LocalStorage persistence
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_users') || localStorage.getItem('codeedu_users');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return MOCK_USERS;
  });

  const [currentUser, setCurrentUser] = useState<User>(() => {
    try {
      const savedId = localStorage.getItem('smart_ict_current_user_id') || localStorage.getItem('codeedu_current_user_id');
      const savedUsers = localStorage.getItem('smart_ict_users') || localStorage.getItem('codeedu_users');
      const uList = savedUsers ? JSON.parse(savedUsers) : MOCK_USERS;
      if (savedId) {
        const found = uList.find((u: User) => u.id === savedId);
        if (found) return found;
      }
      return uList[0];
    } catch (e) {
      return MOCK_USERS[0];
    }
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_classes') || localStorage.getItem('codeedu_classes');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return MOCK_CLASSES;
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_subjects') || localStorage.getItem('codeedu_subjects');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return MOCK_SUBJECTS;
  });

  const [lessons, setLessons] = useState<Lesson[]>(() => {
    try {
      const saved = localStorage.getItem('smart_ict_lessons') || localStorage.getItem('codeedu_lessons');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return MOCK_LESSONS;
  });

  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>(MOCK_SUBMISSIONS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(MOCK_ANNOUNCEMENTS);
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [badges, setBadges] = useState<GamificationBadge[]>(MOCK_BADGES);

  // Synchronize state with LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('smart_ict_users', JSON.stringify(users));
    } catch (e) {
      console.error(e);
    }
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_ict_current_user_id', currentUser.id);
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_ict_lessons', JSON.stringify(lessons));
    } catch (e) {
      console.error(e);
    }
  }, [lessons]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_ict_classes', JSON.stringify(classes));
    } catch (e) {
      console.error(e);
    }
  }, [classes]);

  useEffect(() => {
    try {
      localStorage.setItem('smart_ict_subjects', JSON.stringify(subjects));
    } catch (e) {
      console.error(e);
    }
  }, [subjects]);

  // Modals & Drawers
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [createLessonModalOpen, setCreateLessonModalOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<HomeworkSubmission | null>(null);
  const [globalAiDrawerOpen, setGlobalAiDrawerOpen] = useState(false);
  const [aiContextLesson, setAiContextLesson] = useState<Lesson | undefined>(undefined);

  // Manage Dark Mode Class on Document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Synchronize Page Title & Scroll on route changes
  useEffect(() => {
    if (currentPath === '/' || currentPath === '/home') {
      document.title = 'Smart ICT — Цифровой кабинет информатики';
    } else if (currentPath === '/dashboard') {
      document.title = 'Личный кабинет | Smart ICT';
    } else if (currentPath === '/lessons') {
      document.title = 'Каталог уроков | Smart ICT';
    } else if (currentPath.startsWith('/lessons/')) {
      const lId = currentPath.replace('/lessons/', '');
      const found = lessons.find(l => l.id === lId);
      document.title = found ? `${found.title} — Урок | Smart ICT` : 'Урок не найден | Smart ICT';
    } else if (currentPath === '/homework') {
      document.title = 'Центр домашних заданий | Smart ICT';
    } else if (currentPath === '/gamification') {
      document.title = 'Рейтинг и достижения | Smart ICT';
    } else if (currentPath === '/calendar') {
      document.title = 'Календарь занятий | Smart ICT';
    } else if (currentPath === '/about') {
      document.title = 'О платформе Smart ICT | Методика обучения';
    } else if (currentPath === '/faq') {
      document.title = 'Часто задаваемые вопросы (FAQ) | Smart ICT';
    } else if (currentPath === '/database') {
      document.title = 'Архитектура & Схема PostgreSQL 16 | Smart ICT';
    } else if (currentPath === '/admin') {
      document.title = 'Панель администратора | Smart ICT';
    } else {
      document.title = '404 — Страница не найдена | Smart ICT';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPath, lessons]);

  // Current class for student
  const currentClass = classes.find(c => c.id === currentUser.classId);

  // Filter lessons strictly for current student's class
  const classLessons = currentUser?.role === 'student' && currentUser?.classId
    ? (lessons || []).filter(l => (l.classIds || []).includes(currentUser.classId!))
    : (lessons || []);

  // Handlers
  const handleSelectUser = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'student' && currentPath === '/admin') {
      navigate('/dashboard');
    }
  };

  const handleRegisterUser = (newUserData: Omit<User, 'id' | 'xp' | 'level' | 'streakDays' | 'completedLessons' | 'badges' | 'registeredAt'>) => {
    const newUser: User = {
      ...newUserData,
      id: `usr-${Date.now()}`,
      xp: 100,
      level: 1,
      streakDays: 1,
      completedLessons: [],
      badges: ['bdg-1'],
      registeredAt: new Date().toISOString().split('T')[0]
    };
    setUsers(prev => [newUser, ...prev]);
    setCurrentUser(newUser);
    navigate('/dashboard');

    // Add welcome notification
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: newUser.id,
        title: `Добро пожаловать в класс ${classes.find(c => c.id === newUser.classId)?.name || ''}!`,
        message: 'Вам открыт доступ ко всем урокам и материалам вашего класса.',
        type: 'announcement',
        read: false,
        date: 'Только что'
      },
      ...prev
    ]);
  };

  const handleMarkLessonCompleted = (lessonId: string) => {
    if (!currentUser.completedLessons.includes(lessonId)) {
      const updatedUser = {
        ...currentUser,
        completedLessons: [...currentUser.completedLessons, lessonId],
        xp: currentUser.xp + 50
      };
      setCurrentUser(updatedUser);
      setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));

      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          userId: currentUser.id,
          title: 'Урок пройден! +50 XP',
          message: 'Вы успешно завершили изучение всех материалов урока.',
          type: 'achievement',
          read: false,
          date: 'Только что'
        },
        ...prev
      ]);
    }
  };

  const handleSubmitHomework = (
    lessonId: string,
    files: { name: string; size: string; content?: string }[],
    studentComment: string
  ) => {
    const targetLesson = lessons.find(l => l.id === lessonId);
    if (!targetLesson) return;

    const existingIndex = submissions.findIndex(
      s => s.lessonId === targetLesson.id && s.studentId === currentUser.id
    );

    const newSub: HomeworkSubmission = {
      id: existingIndex >= 0 ? submissions[existingIndex].id : `sub-${Date.now()}`,
      homeworkId: targetLesson.homework.id || `hw-${targetLesson.id}`,
      lessonId: targetLesson.id,
      lessonTitle: targetLesson.title,
      studentId: currentUser.id,
      studentName: currentUser.name,
      studentAvatar: currentUser.avatarUrl,
      classId: currentUser.classId || '10-C',
      submittedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      status: 'submitted',
      files: files.map(f => ({ name: f.name, size: f.size, url: '#' })),
      studentComment,
      maxScore: targetLesson.homework.maxScore
    };

    if (existingIndex >= 0) {
      const updated = [...submissions];
      updated[existingIndex] = newSub;
      setSubmissions(updated);
    } else {
      setSubmissions([newSub, ...submissions]);
    }

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: currentUser.id,
        title: 'Домашнее задание отправлено!',
        message: `Работа по уроку «${targetLesson.title}» передана на проверку преподавателю.`,
        type: 'grade',
        read: false,
        date: 'Только что'
      },
      ...prev
    ]);
  };

  const handleSaveGrade = (submissionId: string, score: number, feedback: string, status: 'graded' | 'needs_revision') => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    const updatedSubmissions = submissions.map(s => {
      if (s.id === submissionId) {
        return {
          ...s,
          score,
          teacherFeedback: feedback,
          status,
          gradedAt: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
        };
      }
      return s;
    });
    setSubmissions(updatedSubmissions);

    if (status === 'graded') {
      const student = users.find(u => u.id === sub.studentId);
      if (student) {
        const xpEarned = Math.round(score * 1.5);
        const updatedStudent = {
          ...student,
          xp: student.xp + xpEarned
        };
        setUsers(users.map(u => u.id === student.id ? updatedStudent : u));
        if (currentUser.id === student.id) {
          setCurrentUser(updatedStudent);
        }
      }
    }

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: sub.studentId,
        title: status === 'graded' ? `Работа проверена: ${score} баллов` : 'Работа требует доработки',
        message: feedback || 'Преподаватель оставил отзыв по вашему домашнему заданию.',
        type: 'grade',
        read: false,
        date: 'Только что'
      },
      ...prev
    ]);
  };

  const handleCompleteTest = (score: number, maxScore: number, xpEarned: number) => {
    const updatedUser = {
      ...currentUser,
      xp: currentUser.xp + xpEarned
    };
    setCurrentUser(updatedUser);
    setUsers(users.map(u => u.id === currentUser.id ? updatedUser : u));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: currentUser.id,
        title: `Тест сдан: ${score} / ${maxScore} (+${xpEarned} XP)`,
        message: 'Поздравляем с успешным прохождением тестирования!',
        type: 'achievement',
        read: false,
        date: 'Только что'
      },
      ...prev
    ]);
  };

  const handleOpenLesson = (lesson: Lesson) => {
    navigate(`/lessons/${lesson.id}`);
  };

  const handleCreateLesson = (newLesson: Lesson) => {
    setLessons([newLesson, ...lessons]);
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: 'all',
        title: `Опубликован новый урок: ${newLesson.title}`,
        message: `Для учащихся ${newLesson.grade} классов открыт новый интерактивный модуль.`,
        type: 'announcement',
        read: false,
        date: 'Только что'
      },
      ...prev
    ]);
  };

  const handleAddClass = (newClassData: Omit<SchoolClass, 'id'>) => {
    const newCls: SchoolClass = {
      ...newClassData,
      id: `${newClassData.grade}${newClassData.letter || newClassData.name.replace(/[^a-zA-Z0-9]/g, '') || String(Date.now()).slice(-3)}`
    };
    setClasses([...classes, newCls]);
  };

  const handleDeleteClass = (classId: string) => {
    setClasses(classes.filter(c => c.id !== classId));
  };

  const handleAddSubject = (newSubData: Omit<Subject, 'id'>) => {
    const newSub: Subject = {
      ...newSubData,
      id: `sub-${Date.now()}`
    };
    setSubjects([...subjects, newSub]);
  };

  const handleDeleteSubject = (subId: string) => {
    setSubjects(subjects.filter(s => s.id !== subId));
  };

  const handleDeleteLesson = (lessonId: string) => {
    setLessons(lessons.filter(l => l.id !== lessonId));
  };

  const handleAddExtraMaterial = (
    lessonId: string,
    material: { title: string; url: string; type: string; description: string }
  ) => {
    setLessons(prev =>
      prev.map(l => {
        if (l.id === lessonId) {
          const newExtra = {
            id: `ext-${Date.now()}`,
            title: material.title,
            url: material.url,
            type: material.type as any,
            description: material.description
          };
          return {
            ...l,
            extraMaterials: [...(l.extraMaterials || []), newExtra]
          };
        }
        return l;
      })
    );
  };

  const handleUpdateUserRole = (userId: string, role: UserRole, classId?: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, role, classId };
      }
      return u;
    });
    setUsers(updated);
    if (currentUser.id === userId) {
      setCurrentUser({ ...currentUser, role, classId });
    }
  };

  const handleUpdateUserPassword = (userId: string, newPassword: string) => {
    const updated = users.map(u => {
      if (u.id === userId) {
        return { ...u, password: newPassword };
      }
      return u;
    });
    setUsers(updated);
    if (currentUser.id === userId) {
      setCurrentUser({ ...currentUser, password: newPassword });
    }
  };

  const handleBulkUpdatePasswords = (updates: { userId: string; newPassword: string }[]) => {
    const updateMap = new Map(updates.map(item => [item.userId, item.newPassword]));
    const updated = users.map(u => {
      if (updateMap.has(u.id)) {
        return { ...u, password: updateMap.get(u.id)! };
      }
      return u;
    });
    setUsers(updated);
    if (updateMap.has(currentUser.id)) {
      setCurrentUser({ ...currentUser, password: updateMap.get(currentUser.id)! });
    }
  };

  const handleAddUser = (newUser: User) => {
    setUsers([newUser, ...users]);
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter(u => u.id !== userId));
  };

  const handlePostAnnouncement = (annData: Omit<Announcement, 'id' | 'date'>) => {
    const newAnn: Announcement = {
      ...annData,
      id: `ann-${Date.now()}`,
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
    };
    setAnnouncements([newAnn, ...announcements]);
  };

  // Resolve current active route view
  const renderCurrentPage = () => {
    // 1. Home / Landing
    if (currentPath === '/' || currentPath === '/home') {
      return (
        <HeroSection
          onOpenAuth={() => setAuthModalOpen(true)}
          onExploreLessons={() => navigate('/lessons')}
          classes={classes}
          subjects={subjects}
          lessons={lessons}
          announcements={announcements}
          currentUser={currentUser}
          onSelectLesson={handleOpenLesson}
        />
      );
    }

    // 2. Dashboard
    if (currentPath === '/dashboard') {
      return currentUser.role === 'student' ? (
        <StudentDashboard
          currentUser={currentUser}
          currentClass={currentClass}
          classLessons={classLessons}
          submissions={submissions}
          badges={badges}
          onSelectLesson={handleOpenLesson}
          onOpenAiAssistant={(les) => {
            setAiContextLesson(les);
            setGlobalAiDrawerOpen(true);
          }}
          onSelectTab={(tab) => {
            if (tab === 'lessons') navigate('/lessons');
            else if (tab === 'gamification') navigate('/gamification');
            else if (tab === 'calendar') navigate('/calendar');
            else if (tab === 'homework') navigate('/homework');
            else if (tab === 'about') navigate('/about');
            else if (tab === 'faq') navigate('/faq');
            else if (tab === 'database') navigate('/database');
            else navigate(`/${tab}`);
          }}
        />
      ) : (
        <TeacherDashboard
          currentUser={currentUser}
          classes={classes}
          lessons={lessons}
          submissions={submissions}
          announcements={announcements}
          users={users}
          onReviewSubmission={(sub) => setReviewSubmission(sub)}
          onCreateLesson={() => setCreateLessonModalOpen(true)}
          onPostAnnouncement={handlePostAnnouncement}
          onSelectLesson={handleOpenLesson}
          onUpdateUserPassword={handleUpdateUserPassword}
          onBulkUpdatePasswords={handleBulkUpdatePasswords}
          onNavigate={(path) => navigate(path)}
          onSwitchUser={handleSelectUser}
        />
      );
    }

    // 3. Lessons Catalog
    if (currentPath === '/lessons') {
      return (
        <LessonList
          lessons={lessons}
          classes={classes}
          subjects={subjects}
          currentUser={currentUser}
          onSelectLesson={handleOpenLesson}
          onCreateLesson={() => setCreateLessonModalOpen(true)}
        />
      );
    }

    // 4. Single Lesson Detail Route: /lessons/:lessonId
    if (currentPath.startsWith('/lessons/')) {
      const lessonId = currentPath.replace('/lessons/', '').trim();
      const currentLesson = lessons.find(l => l.id === lessonId);

      if (currentLesson) {
        return (
          <LessonDetail
            lesson={currentLesson}
            currentUser={currentUser}
            submission={submissions.find(s => s.lessonId === currentLesson.id && s.studentId === currentUser.id)}
            onBack={() => navigate('/lessons')}
            onMarkCompleted={handleMarkLessonCompleted}
            onSubmitHomework={(files, comment) => handleSubmitHomework(currentLesson.id, files, comment)}
            onCompleteTest={handleCompleteTest}
          />
        );
      } else {
        return <NotFoundPage />;
      }
    }

    // 5. Homework Page
    if (currentPath === '/homework') {
      return (
        <HomeworkPage
          currentUser={currentUser}
          lessons={lessons}
          submissions={submissions}
          classes={classes}
          onReviewSubmission={(sub) => setReviewSubmission(sub)}
          onOpenLesson={handleOpenLesson}
        />
      );
    }

    // 6. Gamification & Leaderboard
    if (currentPath === '/gamification') {
      return (
        <GamificationView
          currentUser={currentUser}
          allUsers={users}
          badges={badges}
          classes={classes}
        />
      );
    }

    // 7. Calendar View
    if (currentPath === '/calendar') {
      return (
        <CalendarView
          lessons={lessons}
          currentUser={currentUser}
          classes={classes}
          onSelectLesson={handleOpenLesson}
        />
      );
    }

    // 8. About Platform & Methodology Page
    if (currentPath === '/about') {
      return <AboutPage />;
    }

    // 9. FAQ & Knowledge Base Page
    if (currentPath === '/faq') {
      return <FaqPage />;
    }

    // 10. Database & Architecture Studio
    if (currentPath === '/database') {
      return <ArchitectureStudio />;
    }

    // 11. Admin Management (guarded for admin and teacher, with 1-click switcher for students)
    if (currentPath === '/admin') {
      if (currentUser.role === 'admin' || currentUser.role === 'teacher') {
        return (
          <AdminManager
            classes={classes}
            subjects={subjects}
            users={users}
            lessons={lessons}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
            onAddSubject={handleAddSubject}
            onDeleteSubject={handleDeleteSubject}
            onUpdateUserRole={handleUpdateUserRole}
            onUpdateUserPassword={handleUpdateUserPassword}
            onBulkUpdatePasswords={handleBulkUpdatePasswords}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onCreateLesson={handleCreateLesson}
            onDeleteLesson={handleDeleteLesson}
            onAddExtraMaterial={handleAddExtraMaterial}
            onSelectLesson={handleOpenLesson}
            onSwitchUser={handleSelectUser}
          />
        );
      } else {
        return (
          <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center space-y-4 shadow-xl animate-in fade-in">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Панель управления Smart ICT</h2>
            <p className="text-xs text-neutral-500">
              Этот раздел предназначен для администратора и учителей. Отсюда осуществляется добавление учебных материалов (конспекты, слайды, тесты, Python-задачи), управление классами и учетными записями.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => {
                  const adminUser = users.find(u => u.role === 'admin') || users[2];
                  handleSelectUser(adminUser);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20 transition-all"
              >
                Войти как Администратор (демо)
              </button>
              <button
                onClick={() => {
                  const teacherUser = users.find(u => u.role === 'teacher') || users[1];
                  handleSelectUser(teacherUser);
                }}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all"
              >
                Войти как Учитель (демо)
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 rounded-xl text-xs font-semibold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Вернуться в личный кабинет
              </button>
            </div>
          </div>
        );
      }
    }

    // 12. 404 Not Found Page
    return <NotFoundPage />;
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-neutral-950 text-neutral-100' : 'bg-neutral-50 text-neutral-900'
    }`}>
      
      {/* Navigation Topbar */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        availableUsers={users}
        isDark={isDark}
        onToggleDark={() => setIsDark(!isDark)}
        notifications={notifications}
        onOpenNotifications={() => setNotificationsModalOpen(true)}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenAuth={() => setAuthModalOpen(true)}
        classes={classes}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {renderCurrentPage()}
      </main>

      {/* Footer */}
      <Footer currentUser={currentUser} />

      {/* Global AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={globalAiDrawerOpen}
        onClose={() => {
          setGlobalAiDrawerOpen(false);
          setAiContextLesson(undefined);
        }}
        lesson={aiContextLesson || lessons[0]}
        studentClass={currentUser.classId}
      />

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        classes={classes}
        onRegister={handleRegisterUser}
        onLoginAs={handleSelectUser}
        availableUsers={users}
        onUpdatePassword={handleUpdateUserPassword}
      />

      <NotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAllRead={() => setNotifications(notifications.map(n => ({ ...n, read: true })))}
        onSelectLink={(link) => {
          if (link?.startsWith('lesson:')) {
            const lId = link.replace('lesson:', '');
            navigate(`/lessons/${lId}`);
          } else if (link === 'homework') {
            navigate('/homework');
          } else if (link === 'gamification') {
            navigate('/gamification');
          } else {
            navigate('/dashboard');
          }
        }}
      />

      <SpotlightSearch
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        lessons={classLessons}
        onSelectLesson={handleOpenLesson}
      />

      <CreateLessonModal
        isOpen={createLessonModalOpen}
        onClose={() => setCreateLessonModalOpen(false)}
        classes={classes}
        subjects={subjects}
        onCreateLesson={handleCreateLesson}
      />

      <TeacherReviewModal
        submission={reviewSubmission}
        onClose={() => setReviewSubmission(null)}
        onSaveGrade={handleSaveGrade}
      />

    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AppContent />
    </RouterProvider>
  );
}
