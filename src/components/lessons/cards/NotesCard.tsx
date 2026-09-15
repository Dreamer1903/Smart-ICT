import React, { useState } from 'react';
import { Copy, Check, BookOpen, Lightbulb, Bookmark } from 'lucide-react';
import { LessonNotes } from '../../../types';

interface NotesCardProps {
  notes: LessonNotes;
  lessonTitle: string;
}

export const NotesCard: React.FC<NotesCardProps> = ({ notes, lessonTitle }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Intro Header */}
      <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-start space-x-3">
        <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
            Конспект урока
          </h4>
          <p className="text-xs text-blue-800 dark:text-blue-300 mt-0.5 leading-relaxed">
            Основные теоретические концепции, определения и синтаксические шаблоны по теме «{lessonTitle}».
          </p>
        </div>
      </div>

      {/* Main Markdown / Content Sections */}
      <div className="space-y-6">
        {notes.sections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-blue-600" />
              <span>{section.title}</span>
            </h3>

            <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed space-y-2">
              {section.content.split('\n\n').map((para, pIdx) => (
                <p key={pIdx}>{para}</p>
              ))}
            </div>

            {/* Code Block if any */}
            {section.codeExample && (
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-950 text-neutral-100 font-mono text-xs shadow-md">
                <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center text-[11px] text-neutral-400">
                  <span className="font-semibold text-neutral-300">
                    {section.codeLanguage || 'python'}
                  </span>
                  <button
                    onClick={() => handleCopy(section.codeExample!, idx)}
                    className="flex items-center space-x-1 hover:text-white transition-colors"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Скопировано!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Копировать</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 overflow-x-auto text-[11px] leading-relaxed text-emerald-300">
                  <code>{section.codeExample}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Key Takeaways Box */}
      {notes.keyTakeaways && notes.keyTakeaways.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>Главное из урока для экзамена и олимпиад:</span>
          </div>
          <ul className="space-y-1.5 pl-6 list-disc text-xs text-amber-950 dark:text-amber-300">
            {notes.keyTakeaways.map((item, idx) => (
              <li key={idx} className="leading-relaxed">{item}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
};
