import React, { useState } from 'react';
import { Sparkles, Lightbulb, ChevronLeft, ChevronRight, RotateCw, Check } from 'lucide-react';
import { ConceptCard } from '../../../types';

interface ConceptCardsViewProps {
  cards?: ConceptCard[];
  lessonTitle: string;
}

export const ConceptCardsView: React.FC<ConceptCardsViewProps> = ({ cards = [], lessonTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // If no custom concept cards were generated, supply default educational flashcards
  const displayCards: ConceptCard[] = cards.length > 0 ? cards : [
    {
      id: 'default-1',
      term: 'Теоретический фундамент',
      definition: `Основные определения, математические концепции и терминология по теме «${lessonTitle}».`,
      codeSnippet: `# Базовый шаблон\ndef solution():\n    return True`,
      keyRule: 'Всегда проверяйте граничные условия и корректность типов входных данных.',
    },
    {
      id: 'default-2',
      term: 'Сложность алгоритма (Big-O)',
      definition: 'Оценка времени выполнения программы и расхода оперативной памяти при росте входных данных.',
      codeSnippet: `# Линейная сложность O(N)\nfor item in collection:\n    pass`,
      keyRule: 'Оптимизируйте алгоритмы, избегая квадратичной сложности O(N²) на больших массивах.',
    },
    {
      id: 'default-3',
      term: 'Стандарты кода PEP8',
      definition: 'Общепринятый стиль написания чистого, читаемого и поддерживаемого кода на языке Python.',
      codeSnippet: `snake_case_variable = 100`,
      keyRule: 'Используйте осмысленные имена переменных и соблюдайте отступы в 4 пробела.',
    }
  ];

  const currentCard = displayCards[currentIndex] || displayCards[0];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.min(displayCards.length - 1, prev + 1));
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
              Карточки ключевых понятий (Flashcards)
            </h4>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Быстрое запоминание терминов, правил и синтаксических конструкций к уроку
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
          {currentIndex + 1} / {displayCards.length}
        </span>
      </div>

      {/* Main Flashcard with Flip Animation */}
      <div className="perspective-1000 max-w-xl mx-auto">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className={`min-h-[280px] p-6 sm:p-8 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between select-none shadow-lg ${
            isFlipped
              ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 shadow-indigo-500/10'
              : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-blue-400'
          }`}
        >
          {/* Card Top */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
              Понятие #{currentIndex + 1}
            </span>
            <span className="text-[11px] text-neutral-400 flex items-center space-x-1">
              <RotateCw className="w-3 h-3" />
              <span>{isFlipped ? 'Показана обратная сторона' : 'Нажмите, чтобы перевернуть'}</span>
            </span>
          </div>

          {/* Card Body */}
          {!isFlipped ? (
            <div className="space-y-3 py-4 text-center">
              <h3 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                {currentCard.term}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-md mx-auto">
                {currentCard.definition}
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {currentCard.codeSnippet && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-neutral-500 uppercase">
                    Пример синтаксиса / реализации:
                  </span>
                  <pre className="p-3 rounded-2xl bg-neutral-950 text-emerald-400 font-mono text-xs overflow-x-auto">
                    <code>{currentCard.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {currentCard.keyRule && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-2 text-xs text-amber-900 dark:text-amber-200">
                  <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Главное правило:</span>
                    <span>{currentCard.keyRule}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card Bottom Indicator */}
          <div className="text-center pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <span className="text-[10px] text-neutral-400 font-medium">
              Нажмите в любое место карточки для переворота
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center space-x-4 pt-2">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-all disabled:opacity-30 flex items-center space-x-1"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Предыдущая</span>
        </button>

        <div className="flex space-x-1.5">
          {displayCards.map((_, dotIdx) => (
            <div
              key={dotIdx}
              onClick={() => {
                setIsFlipped(false);
                setCurrentIndex(dotIdx);
              }}
              className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
                dotIdx === currentIndex ? 'bg-blue-600 w-5' : 'bg-neutral-300 dark:bg-neutral-700'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentIndex === displayCards.length - 1}
          className="px-4 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-all disabled:opacity-30 flex items-center space-x-1"
        >
          <span>Следующая</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
