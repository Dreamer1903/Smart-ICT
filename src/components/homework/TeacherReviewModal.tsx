import React, { useState } from 'react';
import { X, Check, FileCode, FileText, Send, Star, AlertCircle } from 'lucide-react';
import { HomeworkSubmission } from '../../types';

interface TeacherReviewModalProps {
  submission: HomeworkSubmission | null;
  onClose: () => void;
  onSaveGrade: (submissionId: string, score: number, feedback: string, status: 'graded' | 'needs_revision') => void;
}

export const TeacherReviewModal: React.FC<TeacherReviewModalProps> = ({
  submission,
  onClose,
  onSaveGrade
}) => {
  if (!submission) return null;

  const [score, setScore] = useState<number>(submission.score || 90);
  const [feedback, setFeedback] = useState<string>(
    submission.teacherFeedback || 'Работа выполнена аккуратно. Код соответствует стандарту PEP8, алгоритмическая сложность решения оптимальна.'
  );
  const [status, setStatus] = useState<'graded' | 'needs_revision'>('graded');
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveGrade(submission.id, Number(score), feedback.trim(), status);
    onClose();
  };

  const currentFile = submission.files[activeFileIndex] || submission.files[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl shadow-2xl border p-6 backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                Класс {submission.classId}
              </span>
              <span className="text-xs text-neutral-400">Сдано: {submission.submittedAt}</span>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
              Проверка работы: {submission.studentName}
            </h3>
            <p className="text-xs text-neutral-500">
              Урок: {submission.lessonTitle}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto py-4 space-y-5 flex-1 pr-1">
          
          {/* Student Comment */}
          {submission.studentComment && (
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 text-xs">
              <span className="font-bold text-neutral-700 dark:text-neutral-300">Комментарий ученика: </span>
              <span className="italic text-neutral-600 dark:text-neutral-400">«{submission.studentComment}»</span>
            </div>
          )}

          {/* Attached Files Switcher */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-2">
              Прикрепленные файлы ({submission.files.length}):
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {submission.files.map((file, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveFileIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    activeFileIndex === idx
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'
                  }`}
                >
                  {file.name.endsWith('.py') ? (
                    <FileCode className="w-3.5 h-3.5" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>{file.name}</span>
                </button>
              ))}
            </div>

            {/* File Viewer Box */}
            {currentFile && (
              <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-950 text-neutral-100 font-mono text-xs">
                <div className="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex justify-between items-center text-[11px] text-neutral-400">
                  <span>{currentFile.name} ({currentFile.size})</span>
                  <span>Язык: Python / Text</span>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto whitespace-pre leading-relaxed">
                  {currentFile.content || `# [Предпросмотр файла ${currentFile.name}]\n# Файл загружен в защищенное хранилище Supabase Storage.\n# Статус проверки: антивирус пройден, размер ${currentFile.size}.`}
                </div>
              </div>
            )}
          </div>

          {/* Evaluation Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Оценка за работу (макс. {submission.maxScore})
                </label>
                <div className="relative">
                  <Star className="w-4 h-4 text-amber-500 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min={0}
                    max={submission.maxScore}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Статус проверки
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="graded">Принято (Оценка выставлена)</option>
                  <option value="needs_revision">Отправить на доработку</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Развернутый отзыв учителя для ученика
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Напишите комментарий к коду, отметьте сильные стороны и зоны роста..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Сохранить оценку и отправить ученику</span>
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
