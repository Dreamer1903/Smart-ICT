import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Monitor, Code, HelpCircle } from 'lucide-react';
import { LessonSlide } from '../../../types';

interface PresentationCardProps {
  slides: LessonSlide[];
  lessonTitle: string;
}

export const PresentationCard: React.FC<PresentationCardProps> = ({ slides, lessonTitle }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentSlide = slides[currentSlideIndex] || slides[0];

  const handlePrev = () => {
    setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentSlideIndex((prev) => Math.min(slides.length - 1, prev + 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides.length]);

  return (
    <div className="space-y-4">
      
      {/* Slide Navigation Topbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Monitor className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
            Интерактивная презентация ({currentSlideIndex + 1} из {slides.length})
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            disabled={currentSlideIndex === 0}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Предыдущий слайд (стрелка влево)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-xs font-mono font-bold px-2 text-neutral-600 dark:text-neutral-400">
            {currentSlideIndex + 1} / {slides.length}
          </span>

          <button
            onClick={handleNext}
            disabled={currentSlideIndex === slides.length - 1}
            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Следующий слайд (стрелка вправо / пробел)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Slide Canvas (16:9 ratio) */}
      <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-950 to-blue-950 text-white p-6 sm:p-10 flex flex-col justify-between shadow-2xl">
        
        {/* Slide Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">
              {lessonTitle} · Слайд #{currentSlideIndex + 1}
            </span>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white mt-1 leading-tight">
              {currentSlide.title}
            </h2>
          </div>

          <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs font-mono font-bold">
            {currentSlideIndex + 1}
          </div>
        </div>

        {/* Slide Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-auto py-2">
          
          {/* Left Column: Bullet Points */}
          <div className="space-y-3">
            {currentSlide.bullets.map((bullet, bIdx) => (
              <div key={bIdx} className="flex items-start space-x-2.5 text-xs sm:text-sm text-neutral-200 leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Right Column: Code Snippet or Visual Highlight */}
          {currentSlide.codeSnippet ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-4 font-mono text-xs overflow-x-auto shadow-inner text-emerald-300">
              <div className="text-[10px] text-neutral-500 mb-2 border-b border-neutral-800 pb-1 flex items-center space-x-1">
                <Code className="w-3.5 h-3.5 text-blue-400" />
                <span>Python Пример</span>
              </div>
              <pre className="text-[11px] leading-relaxed">
                <code>{currentSlide.codeSnippet}</code>
              </pre>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex flex-col justify-center items-center text-center">
              <div className="text-3xl mb-2">💡</div>
              <p className="text-xs text-neutral-300 italic max-w-xs">
                Запоминаем концепцию и переходим к практической реализации в песочнице
              </p>
            </div>
          )}

        </div>

        {/* Slide Footer */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-800">
          <span>Школьный курс информатики · Smart ICT LMS</span>
          <span>Нажимайте клавиши ⬅ / ➡ для навигации</span>
        </div>

      </div>

      {/* Slide Thumbnails strip */}
      <div className="flex space-x-2 overflow-x-auto pb-2">
        {slides.map((slide, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlideIndex(idx)}
            className={`px-3 py-2 rounded-xl text-left border text-xs whitespace-nowrap transition-all ${
              currentSlideIndex === idx
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-blue-400'
            }`}
          >
            <div className="font-bold text-[11px]">#{idx + 1} {slide.title}</div>
          </button>
        ))}
      </div>

    </div>
  );
};
