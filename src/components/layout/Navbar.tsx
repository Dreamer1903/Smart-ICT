import React, { useState } from 'react';
import {
  Code,
  BookOpen,
  LayoutDashboard,
  Award,
  Calendar as CalendarIcon,
  Database,
  Search,
  Bell,
  Moon,
  Sun,
  UserCheck,
  LogOut,
  FolderKanban,
  Flame,
  ChevronDown,
  FileCheck,
  HelpCircle,
  Info,
  KeyRound
} from 'lucide-react';
import { User, SchoolClass, AppNotification } from '../../types';
import { Link, NavLink, useRouter } from '../../router/RouterContext';

interface NavbarProps {
  currentUser: User;
  onSelectUser: (user: User) => void;
  availableUsers: User[];
  isDark: boolean;
  onToggleDark: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onOpenSearch: () => void;
  onOpenAuth: () => void;
  classes: SchoolClass[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectUser,
  availableUsers,
  isDark,
  onToggleDark,
  notifications = [],
  onOpenNotifications,
  onOpenSearch,
  onOpenAuth,
  classes = []
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const { currentPath } = useRouter();
  const unreadCount = (notifications || []).filter(n => !n.read).length;

  const currentClass = (classes || []).find(c => c.id === currentUser?.classId);

  const navLinkBase = "px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-all flex items-center space-x-1.5";
  const navLinkInactive = "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800";
  const navLinkActive = "bg-blue-600 text-white shadow-sm";

  return (
    <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${
      isDark 
        ? 'bg-neutral-900/80 border-neutral-800 text-neutral-100' 
        : 'bg-white/80 border-neutral-200 text-neutral-800'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <Link to="/" className="flex items-center space-x-3 cursor-pointer group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            <Code className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent">
                Smart ICT
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                LMS
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
              Кабинет ИКТ М.Р. Абдугафорова
            </p>
          </div>
        </Link>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1">
          <NavLink
            to="/"
            exact
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <span>Главная</span>
          </NavLink>
          
          <NavLink
            to="/dashboard"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Дашборд</span>
          </NavLink>

          <NavLink
            to="/lessons"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <BookOpen className="w-4 h-4" />
            <span>Уроки</span>
            {currentUser.role === 'student' && currentClass && (
              <span className="text-[11px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded font-semibold">
                {currentClass.name}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/homework"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <FileCheck className="w-4 h-4" />
            <span>ДЗ</span>
          </NavLink>

          <NavLink
            to="/gamification"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <Award className="w-4 h-4" />
            <span>Рейтинг</span>
          </NavLink>

          <NavLink
            to="/calendar"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Календарь</span>
          </NavLink>

          {currentUser.role === 'admin' && (
            <NavLink
              to="/admin"
              className={navLinkBase}
              activeClassName={navLinkActive}
            >
              <FolderKanban className="w-4 h-4 text-purple-500" />
              <span>Админ-панель</span>
            </NavLink>
          )}

          <NavLink
            to="/about"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <Info className="w-4 h-4" />
            <span>О платформе</span>
          </NavLink>

          <NavLink
            to="/faq"
            className={navLinkBase}
            activeClassName={navLinkActive}
          >
            <HelpCircle className="w-4 h-4" />
            <span>FAQ</span>
          </NavLink>

          <NavLink
            to="/database"
            className={navLinkBase}
            activeClassName={navLinkActive}
            title="Схема БД PostgreSQL 16 и Clean Architecture"
          >
            <Database className="w-4 h-4" />
            <span className="hidden xl:inline">База данных</span>
          </NavLink>
        </nav>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          
          {/* Quick Demo Accounts / Login button */}
          <button
            id="btn-auth-demo"
            onClick={onOpenAuth}
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/60 transition-all shadow-xs"
            title="Вход по паролю и выбор демо-аккаунта"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Вход / Демо</span>
          </button>

          {/* Spotlight Search Trigger */}
          <button
            id="btn-search-open"
            onClick={onOpenSearch}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Поиск по урокам и материалам (Cmd+K)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Toggle */}
          <button
            id="btn-theme-toggle"
            onClick={onToggleDark}
            className="p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Переключить тему оформления"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button
            id="btn-notifications-open"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Уведомления"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-neutral-900 animate-pulse" />
            )}
          </button>

          {/* Student Streak Flame */}
          {currentUser.role === 'student' && (
            <Link
              to="/gamification"
              className="hidden lg:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-semibold hover:bg-orange-500/20 transition-colors"
              title={`Серия обучения: ${currentUser.streakDays} дней подряд!`}
            >
              <Flame className="w-3.5 h-3.5 fill-orange-500" />
              <span>{currentUser.streakDays} дн.</span>
            </Link>
          )}

          {/* User Profile & Role Switcher */}
          <div className="relative">
            <button
              id="user-menu-trigger"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-2 p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all text-left"
            >
              <img
                src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover ring-1 ring-blue-500"
              />
              <div className="hidden sm:block text-left pr-1">
                <div className="text-xs font-semibold leading-tight line-clamp-1">
                  {currentUser.name}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-1">
                  <span className="uppercase font-bold tracking-wider text-[9px]">
                    {currentUser.role === 'admin' ? 'Админ' : currentUser.role === 'teacher' ? 'Учитель' : `${currentClass?.name || 'Класс'}`}
                  </span>
                  {currentUser.role === 'student' && (
                    <span className="text-blue-600 dark:text-blue-400">· {currentUser.xp} XP</span>
                  )}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div 
                className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-2xl bg-white/95 dark:bg-neutral-900/95 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Быстрое переключение роли
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Тестируйте платформу от лица ученика, учителя или администратора
                  </p>
                </div>

                <div className="py-1 space-y-0.5 max-h-64 overflow-y-auto">
                  {availableUsers.map((user) => {
                    const isSelected = user.id === currentUser.id;
                    const uClass = classes.find(c => c.id === user.classId);
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          onSelectUser(user);
                          setUserDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium'
                            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <img
                            src={user.avatarUrl}
                            alt=""
                            className="w-7 h-7 rounded-lg object-cover"
                          />
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-neutral-100">
                              {user.name}
                            </div>
                            <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                              {user.role === 'admin'
                                ? 'Администратор'
                                : user.role === 'teacher'
                                ? 'Учитель информатики'
                                : `Ученик (${uClass?.name || 'Класс'})`}
                            </div>
                          </div>
                        </div>
                        {isSelected && <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </button>
                    );
                  })}
                </div>

                <div className="border-t border-neutral-100 dark:border-neutral-800 mt-1 pt-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onOpenAuth();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs flex items-center space-x-2 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Войти под новым пользователем / Регистрация</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Mobile subnav */}
      <div className="md:hidden border-t border-neutral-200 dark:border-neutral-800 px-3 py-2 flex items-center space-x-2 overflow-x-auto text-xs font-medium">
        <NavLink
          to="/dashboard"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          Дашборд
        </NavLink>
        <NavLink
          to="/lessons"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          Уроки ({currentClass?.name || 'Все'})
        </NavLink>
        <NavLink
          to="/homework"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          ДЗ
        </NavLink>
        <NavLink
          to="/gamification"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          Рейтинг
        </NavLink>
        <NavLink
          to="/calendar"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          Календарь
        </NavLink>
        {currentUser.role === 'admin' && (
          <NavLink
            to="/admin"
            className="px-3 py-1 rounded-lg whitespace-nowrap text-purple-600 dark:text-purple-400 font-bold"
            activeClassName="bg-purple-600 text-white"
          >
            Админ-панель
          </NavLink>
        )}
        <NavLink
          to="/about"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          О платформе
        </NavLink>
        <NavLink
          to="/faq"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          FAQ
        </NavLink>
        <NavLink
          to="/database"
          className="px-3 py-1 rounded-lg whitespace-nowrap text-neutral-600 dark:text-neutral-300"
          activeClassName="bg-blue-600 text-white"
        >
          БД & SQL
        </NavLink>
      </div>
    </header>
  );
};
