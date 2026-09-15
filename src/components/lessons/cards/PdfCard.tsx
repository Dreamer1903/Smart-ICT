import React, { useState } from 'react';
import { FileText, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, ExternalLink } from 'lucide-react';
import { LessonPdf } from '../../../types';

interface PdfCardProps {
  pdf: LessonPdf;
  lessonTitle: string;
}

export const PdfCard: React.FC<PdfCardProps> = ({ pdf, lessonTitle }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(100);

  return (
    <div className="space-y-4">
      
      {/* PDF Controls Header */}
      <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
              {pdf.title}
            </h4>
            <p className="text-[11px] text-neutral-400">
              Размер: {pdf.fileSize} · {pdf.pageCount} страниц методического пособия
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center space-x-2">
          {/* Zoom */}
          <div className="flex items-center space-x-1 border border-neutral-200 dark:border-neutral-700 rounded-xl px-2 py-1">
            <button
              onClick={() => setZoom(Math.max(70, zoom - 15))}
              className="p-1 hover:text-blue-600"
              title="Уменьшить масштаб"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-1">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(150, zoom + 15))}
              className="p-1 hover:text-blue-600"
              title="Увеличить масштаб"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Page nav */}
          <div className="flex items-center space-x-1 border border-neutral-200 dark:border-neutral-700 rounded-xl px-2 py-1">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-1 disabled:opacity-30 hover:text-blue-600"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono px-1">{currentPage} / {pdf.pageCount}</span>
            <button
              onClick={() => setCurrentPage(Math.min(pdf.pageCount, currentPage + 1))}
              disabled={currentPage === pdf.pageCount}
              className="p-1 disabled:opacity-30 hover:text-blue-600"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download */}
          <a
            href={pdf.url}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать PDF</span>
          </a>
        </div>
      </div>

      {/* PDF Document Canvas Simulation */}
      <div className="rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-950 p-6 sm:p-10 flex justify-center overflow-auto min-h-[500px]">
        <div
          className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 space-y-6 transition-transform origin-top"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {/* Simulated PDF Page Header */}
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4 flex justify-between items-center text-[10px] text-neutral-400 uppercase tracking-widest font-mono">
            <span>Smart ICT · Методическое пособие</span>
            <span>Страница {currentPage} из {pdf.pageCount}</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white">
              {pdf.title}
            </h1>
            <p className="text-xs text-neutral-500 font-medium">
              Кафедра информатики и прикладной математики · Класс 10-C
            </p>

            <div className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed pt-2">
              <p>
                <strong>Раздел {currentPage}.1. Теоретические основы и математические модели.</strong>
              </p>
              <p>
                В данном разделе рассматриваются базовые структуры данных и алгоритмы, применяемые в олимпиадном программировании на языке Python. Особое внимание уделяется оценке временной и пространственной сложности в терминах нотации O-большое.
              </p>
              
              <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] text-blue-600 dark:text-blue-400">
                Таблица сложности операций:<br />
                - Добавление в конец (append): O(1)<br />
                - Извлечение с конца (pop): O(1)<br />
                - Поиск элемента (in): O(N)<br />
                - Сортировка Timsort: O(N log N)
              </div>

              <p>
                Практическая рекомендация для учеников: при решении задач олимпиадного уровня всегда проверяйте ограничения на входные данные (N ≤ 10⁵ требует алгоритма не хуже O(N log N)).
              </p>
            </div>
          </div>

          <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4 flex justify-between items-center text-[10px] text-neutral-400">
            <span>© Учитель ИКТ М.Р. Абдугафоров</span>
            <span>Лицензия: Для внутреннего использования в школе</span>
          </div>
        </div>
      </div>

    </div>
  );
};
