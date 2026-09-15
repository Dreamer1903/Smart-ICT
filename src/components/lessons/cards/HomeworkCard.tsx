import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCode,
  FileText,
  FileArchive,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Send,
  Star,
  ShieldCheck
} from 'lucide-react';
import { LessonHomework, HomeworkSubmission, User } from '../../../types';

interface HomeworkCardProps {
  homework: LessonHomework;
  lessonTitle: string;
  currentUser: User;
  submission?: HomeworkSubmission;
  onSubmitHomework: (files: { name: string; size: string; content?: string }[], studentComment: string) => void;
}

export const HomeworkCard: React.FC<HomeworkCardProps> = ({
  homework,
  lessonTitle,
  currentUser,
  submission,
  onSubmitHomework
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; content?: string }[]>(
    submission ? submission.files : []
  );
  const [studentComment, setStudentComment] = useState(submission?.studentComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const processFiles = (files: File[]) => {
    const newFiles = files.map((f) => ({
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      content: `# Файл ${f.name} подготовлен к загрузке в защищенное хранилище Supabase.\n# Размер: ${f.size} байт.`
    }));
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (idx: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedFiles.length === 0) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitHomework(uploadedFiles, studentComment);
      setIsSubmitting(false);
    }, 600);
  };

  const getStatusBadge = () => {
    if (!submission) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex items-center space-x-1">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Не сдано</span>
        </span>
      );
    }

    switch (submission.status) {
      case 'graded':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center space-x-1">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Проверено: {submission.score} / {submission.maxScore} баллов</span>
          </span>
        );
      case 'submitted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>На проверке у учителя</span>
          </span>
        );
      case 'needs_revision':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 flex items-center space-x-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Требуется доработка</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Assignment Overview & Criteria */}
      <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Домашнее задание
              </span>
              <span className="text-xs text-neutral-400">Максимум: {homework.maxScore} баллов</span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-1">
              {homework.title}
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Deadline Banner */}
        <div className="flex items-center space-x-2 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-200 dark:border-amber-900/50">
          <Clock className="w-4 h-4" />
          <span>Крайний срок сдачи (дедлайн): <strong>{homework.deadline}</strong></span>
        </div>

        {/* Task description */}
        <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed space-y-2">
          <p>{homework.description}</p>
        </div>

        {/* Grading criteria */}
        <div className="pt-2">
          <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider mb-2">
            Критерии оценивания:
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {homework.criteria.map((crit, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 text-xs flex items-center space-x-2"
              >
                <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-neutral-700 dark:text-neutral-300">{crit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Teacher Grade & Review Feedback if available */}
      {submission && submission.teacherFeedback && (
        <div className="p-6 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 shadow-sm space-y-3">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              Рецензия преподавателя М.Р. Абдугафорова
            </h4>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-300 leading-relaxed font-medium">
            {submission.teacherFeedback}
          </p>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">
            Итоговая оценка: {submission.score} из {submission.maxScore} баллов
          </div>
        </div>
      )}

      {/* Upload Zone & Submission Form */}
      <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
          Сдача работы учеником
        </h4>

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
              : 'border-neutral-300 dark:border-neutral-700 hover:border-blue-400 bg-neutral-50/50 dark:bg-neutral-800/20'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".py,.pdf,.docx,.pptx,.zip,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <UploadCloud className="w-10 h-10 text-blue-500 mx-auto mb-3 animate-bounce" />
          <p className="text-xs font-bold text-neutral-900 dark:text-white">
            Перетащите файлы сюда или нажмите для выбора с компьютера
          </p>
          <p className="text-[11px] text-neutral-400 mt-1">
            Поддерживаются: Python (.py), PDF (.pdf), Word (.docx), Презентации (.pptx), Архивы (.zip)
          </p>
        </div>

        {/* Attached Files List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
              Прикреплено к сдаче ({uploadedFiles.length}):
            </span>
            <div className="space-y-1.5">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    {file.name.endsWith('.py') ? (
                      <FileCode className="w-4 h-4 text-blue-500" />
                    ) : file.name.endsWith('.zip') ? (
                      <FileArchive className="w-4 h-4 text-amber-500" />
                    ) : (
                      <FileText className="w-4 h-4 text-rose-500" />
                    )}
                    <span className="font-mono font-medium">{file.name}</span>
                    <span className="text-neutral-400 text-[10px]">({file.size})</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Student comment field */}
        <div>
          <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
            Комментарий к решению (вопросы или пояснения для учителя):
          </label>
          <textarea
            value={studentComment}
            onChange={(e) => setStudentComment(e.target.value)}
            rows={2}
            placeholder="Например: Задание выполнено, дополнительно реализовал обработку пустых массивов..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="pt-2 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Безопасная передача в Supabase Storage</span>
          </div>

          <button
            type="submit"
            disabled={uploadedFiles.length === 0 || isSubmitting}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center space-x-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Отправка...' : submission ? 'Отправить повторно' : 'Сдать домашнее задание'}</span>
          </button>
        </div>

      </form>

    </div>
  );
};
