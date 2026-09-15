import React from 'react';
import { Code, Heart, ShieldCheck, Database, Terminal, Cpu, BookOpen, FileCheck, HelpCircle, Info, Lock } from 'lucide-react';
import { Link } from '../../router/RouterContext';
import { User } from '../../types';

interface FooterProps {
  currentUser?: User;
}

export const Footer: React.FC<FooterProps> = ({ currentUser }) => {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 py-12 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand & Mission */}
          <div className="space-y-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Code className="w-4 h-4" />
              </div>
              <span className="font-bold text-base tracking-tight text-neutral-900 dark:text-white">
                Smart ICT
              </span>
            </Link>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Многостраничная образовательная веб-платформа для уроков информатики и программирования. 
              Интерактивные конспекты, автопроверка кода Python, онлайн-тестирование и AI-ассистент.
            </p>
            <div className="flex items-center space-x-2 text-xs text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>PostgreSQL + RLS Защита данных</span>
            </div>
          </div>

          {/* Navigation Pages */}
          <div>
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-3">
              Основные разделы
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li>
                <Link to="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <span>Главная страница</span>
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <span>Личный кабинет (Дашборд)</span>
                </Link>
              </li>
              <li>
                <Link to="/lessons" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Каталог уроков (7–11 классы)</span>
                </Link>
              </li>
              <li>
                <Link to="/homework" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Центр домашних заданий</span>
                </Link>
              </li>
              <li>
                <Link to="/calendar" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <span>Календарь занятий и дедлайнов</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Educational & Community */}
          <div>
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-3">
              Обучение & Помощь
            </h4>
            <ul className="space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              <li>
                <Link to="/about" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>О платформе и методике</span>
                </Link>
              </li>
              <li>
                <Link to="/faq" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>База знаний (FAQ)</span>
                </Link>
              </li>
              <li>
                <Link to="/gamification" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center space-x-1.5">
                  <span>Рейтинг учеников и бейджи</span>
                </Link>
              </li>
              <li>
                <Link to="/lessons" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Крафтинг & Робототехника</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Architecture & DB - Restricted to Admin role only */}
          {currentUser?.role === 'admin' ? (
            <div>
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-3">
                Архитектура & База данных
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3">
                Спроектирована по принципам Clean Architecture и SOLID с защитой RLS для разграничения доступа учеников по классам.
              </p>
              <Link
                to="/database"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
              >
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span>Открыть SQL схему и ERD</span>
              </Link>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-3 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Безопасность данных</span>
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed mb-3">
                Все персональные данные, оценки и домашние задания учеников защищены политиками изоляции классов (RLS). Доступ к административной базе данных защищен.
              </p>
              <div className="inline-flex items-center space-x-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-4 h-4" />
                <span>Доступ строго регламентирован</span>
              </div>
            </div>
          )}

        </div>

        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400">
          <p>© 2026 Smart ICT. Кабинет ИКТ М.Р. Абдугафорова. Все права защищены.</p>
          <div className="flex items-center space-x-1 mt-2 sm:mt-0">
            <span>Сделано с</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 inline" />
            <span>для современных уроков информатики</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
