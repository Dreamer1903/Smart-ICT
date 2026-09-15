import React from 'react';
import { ExternalLink, BookOpen, FileText, Globe, Bookmark, Sparkles } from 'lucide-react';
import { LessonExtraMaterial } from '../../../types';

interface ExtraCardProps {
  materials: LessonExtraMaterial[];
  lessonTitle: string;
}

export const ExtraCard: React.FC<ExtraCardProps> = ({ materials, lessonTitle }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'book':
        return <BookOpen className="w-5 h-5 text-indigo-500" />;
      case 'doc':
        return <Globe className="w-5 h-5 text-blue-500" />;
      case 'cheat_sheet':
        return <Bookmark className="w-5 h-5 text-emerald-500" />;
      default:
        return <FileText className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 flex items-start space-x-3">
        <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">
            Дополнительные материалы и олимпиадный резерв
          </h4>
          <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5 leading-relaxed">
            Официальные стандарты, шпаргалки по алгоритмам и рекомендованная литература для углубленного изучения.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {materials.map((mat) => (
          <a
            key={mat.id}
            href={mat.url}
            target="_blank"
            rel="noreferrer"
            className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-500 transition-all shadow-sm group flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                  {getIcon(mat.type)}
                </div>
                <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-blue-600 transition-colors" />
              </div>

              <h4 className="text-sm font-bold text-neutral-900 dark:text-white group-hover:text-blue-600 transition-colors">
                {mat.title}
              </h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {mat.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="uppercase font-semibold tracking-wider">{mat.type}</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium">Открыть ресурс →</span>
            </div>
          </a>
        ))}
      </div>

    </div>
  );
};
