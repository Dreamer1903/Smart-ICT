import React, { useState, useEffect } from 'react';
import { Search, X, BookOpen, Terminal, Code, ArrowRight } from 'lucide-react';
import { Lesson } from '../../types';

interface SpotlightSearchProps {
  isOpen: boolean;
  onClose: () => void;
  lessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
}

export const SpotlightSearch: React.FC<SpotlightSearchProps> = ({
  isOpen,
  onClose,
  lessons = [],
  onSelectLesson
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const safeLessons = lessons || [];

  const filtered = query.trim()
    ? safeLessons.filter(l => 
        (l.title || '').toLowerCase().includes(query.toLowerCase()) ||
        (l.topic || '').toLowerCase().includes(query.toLowerCase()) ||
        (l.description || '').toLowerCase().includes(query.toLowerCase()) ||
        (l.notes?.sections || []).some(s => (s.title || '').toLowerCase().includes(query.toLowerCase()))
      )
    : safeLessons.slice(0, 4);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-3xl shadow-2xl border backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 overflow-hidden">
        
        {/* Search Input Bar */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center space-x-3">
          <Search className="w-5 h-5 text-neutral-400" />
          <input
            type="text"
            autoFocus
            placeholder="Поиск уроков, структур данных, алгоритмов или Python..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm font-medium focus:outline-none placeholder:text-neutral-400"
          />
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            ESC
          </span>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="p-3 max-h-96 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              По запросу «{query}» ничего не найдено.
            </div>
          ) : (
            filtered.map((les) => (
              <button
                key={les.id}
                onClick={() => {
                  onSelectLesson(les);
                  onClose();
                }}
                className="w-full p-3 rounded-2xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                      {les.title}
                    </div>
                    <div className="text-[10px] text-neutral-500">
                      {les.grade} класс · {les.topic}
                    </div>
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-neutral-400 group-hover:text-blue-600" />
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 flex justify-between items-center text-[10px] text-neutral-400">
          <span>Навигация по материалам Smart ICT</span>
          <span>Нажмите Enter для выбора</span>
        </div>

      </div>
    </div>
  );
};
