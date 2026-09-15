import React, { useState } from 'react';
import {
  Database,
  Layers,
  ShieldCheck,
  Code,
  Copy,
  Check,
  ExternalLink,
  Cpu,
  Server,
  Lock,
  GitBranch,
  Key
} from 'lucide-react';
import { POSTGRESQL_DDL_SCHEMA, DATABASE_ERD_TABLES, SYSTEM_ARCHITECTURE_LAYERS } from '../../data/sqlSchema';

export const ArchitectureStudio: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'erd' | 'sql' | 'clean_arch' | 'security'>('erd');
  const [copied, setCopied] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(POSTGRESQL_DDL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 text-white p-6 sm:p-8 border border-neutral-800 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Production Architecture & Database Studio</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Архитектура платформы и схема PostgreSQL (Supabase)
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
              Чистая архитектура (Clean Architecture), схема нормализованной реляционной БД на 16 сущностей, строгая изоляция Row-Level Security (RLS) для защиты данных учеников по классам.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopySql}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'SQL DDL скопирован!' : 'Скопировать весь SQL'}</span>
            </button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="mt-6 pt-4 border-t border-neutral-800 flex space-x-2 overflow-x-auto">
          {[
            { id: 'erd', label: 'Интерактивная схема ERD', icon: GitBranch },
            { id: 'sql', label: 'Полный PostgreSQL DDL скрипт', icon: Code },
            { id: 'clean_arch', label: 'Слои Clean Architecture', icon: Layers },
            { id: 'security', label: 'RLS & Безопасность (OWASP)', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center space-x-2 transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab: ERD Tables */}
      {activeTab === 'erd' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span>Реляционные таблицы и связи в PostgreSQL (3-я нормальная форма)</span>
            </h3>
            <span className="text-xs text-neutral-500">
              {DATABASE_ERD_TABLES.length} ключевых сущностей
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DATABASE_ERD_TABLES.map((table) => (
              <div
                key={table.name}
                className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {table.name}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono">
                    Таблица
                  </span>
                </div>

                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {table.description}
                </p>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Поля и атрибуты:
                  </span>
                  <div className="space-y-1 font-mono text-[11px]">
                    {table.columns.map((col, cIdx) => (
                      <div key={cIdx} className="flex justify-between text-neutral-700 dark:text-neutral-300">
                        <span className="font-semibold text-neutral-900 dark:text-white">{col.name}</span>
                        <span className="text-neutral-500">{col.type}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {table.relations && table.relations.length > 0 && (
                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400 space-y-1">
                    <span className="font-bold uppercase tracking-wider">Связи:</span>
                    {table.relations.map((rel, rIdx) => (
                      <div key={rIdx} className="text-blue-600 dark:text-blue-400 font-mono">
                        → {rel}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Full SQL DDL */}
      {activeTab === 'sql' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Code className="w-5 h-5 text-blue-600" />
              <span>Готовый к выполнению SQL скрипт (PostgreSQL 16 + RLS)</span>
            </h3>
            <button
              onClick={handleCopySql}
              className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
            </button>
          </div>

          <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-950 text-neutral-100 font-mono text-xs shadow-xl">
            <div className="p-4 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center text-[11px] text-neutral-400">
              <span>schema_v1_production.sql</span>
              <span>100% готов к запуску в Supabase SQL Editor</span>
            </div>
            <pre className="p-6 overflow-x-auto text-[11px] leading-relaxed text-emerald-300 max-h-[600px] overflow-y-auto">
              <code>{POSTGRESQL_DDL_SCHEMA}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Tab: Clean Architecture */}
      {activeTab === 'clean_arch' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Архитектурные слои Clean Architecture (Onion / Hexagonal)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SYSTEM_ARCHITECTURE_LAYERS.map((layer) => (
              <div
                key={layer.name}
                className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {layer.name}
                  </h4>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    {layer.responsibility}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                    Ключевые модули:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {layer.modules.map((m, mIdx) => (
                      <span
                        key={mIdx}
                        className="px-2.5 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-mono"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Security & RLS */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 space-y-3">
            <div className="flex items-center space-x-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200">
                Защита данных школьников и изоляция по классам
              </h3>
            </div>
            <p className="text-xs text-emerald-950 dark:text-emerald-300 leading-relaxed">
              Все таблицы защищены политиками Row-Level Security в PostgreSQL. Ученик не может получить доступ к материалам или оценкам других классов даже при прямой манипуляции запросами API.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-neutral-900 dark:text-white">
                <Lock className="w-4 h-4 text-blue-500" />
                <span>Изоляция учеников (Class Scoping)</span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Политика <code>lessons_read_policy</code> проверяет принадлежность ученика к классу: <code>lesson.class_ids @&gt; ARRAY[auth.jwt() -&gt;&gt; 'class_id']</code>.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-neutral-900 dark:text-white">
                <Key className="w-4 h-4 text-indigo-500" />
                <span>Безопасность API Gemini (Server-side)</span>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Секретный ключ <code>GEMINI_API_KEY</code> хранится строго в контейнере backend Express (server.ts) и никогда не попадает в браузер ученика.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
