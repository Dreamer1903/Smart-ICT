import React, { useState } from 'react';
import { X, Plus, BookOpen, Terminal, CheckCircle2, Clock } from 'lucide-react';
import { Lesson, SchoolClass, Subject } from '../../types';

interface CreateLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  subjects: Subject[];
  onCreateLesson: (newLesson: Lesson) => void;
}

export const CreateLessonModal: React.FC<CreateLessonModalProps> = ({
  isOpen,
  onClose,
  classes,
  subjects,
  onCreateLesson
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState(10);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || 'sub-cs');
  const [selectedClasses, setSelectedClasses] = useState<string[]>(['10C']);
  const [durationMinutes, setDurationMinutes] = useState(45);

  const toggleClass = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedClasses.length === 0) return;

    const newLesson: Lesson = {
      id: `les-${Date.now()}`,
      title: title.trim(),
      slug: title.toLowerCase().replace(/\s+/g, '-'),
      topic: topic.trim() || 'Информатика и алгоритмы',
      description: description.trim() || 'Интерактивный учебный модуль с практическими заданиями по Python.',
      subjectId,
      grade,
      classIds: selectedClasses,
      quarter: 1,
      orderNumber: 3,
      date: new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }),
      durationMinutes,
      notes: {
        sections: [
          {
            title: `1. Введение в ${title}`,
            content: `Теоретический конспект к уроку «${title}». Здесь представлены базовые концепции и математические обоснования.`,
            codeExample: `# Пример программы по теме ${title}\ndef solution(data):\n    print(f"Обработка: {data}")\n    return len(data)\n\nprint(solution([1, 2, 3]))`,
            codeLanguage: 'python'
          }
        ],
        keyTakeaways: [
          'Повторить основные определения перед тестом',
          'Сдать практическую работу в песочнице Python'
        ]
      },
      slides: [
        {
          id: 's1',
          title: title,
          bullets: [
            'Ключевые тезисы урока',
            'Методология и примеры',
            'Практическая реализация'
          ],
          codeSnippet: `print("Урок: ${title}")`
        }
      ],
      video: {
        title: `Видеоразбор: ${title}`,
        durationMinutes: 15,
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc13c744ef5?w=800&auto=format&fit=crop&q=80',
        chapters: [
          { time: '00:00', title: 'Введение' },
          { time: '05:00', title: 'Разбор кода' }
        ]
      },
      pdf: {
        title: `Методическое пособие: ${title}`,
        fileSize: '1.2 MB',
        pageCount: 6,
        url: '#'
      },
      lab: {
        title: `Практика: ${title}`,
        instructions: 'Напишите функцию на Python, решающую поставленную задачу. Проверьте ее работу на встроенных тестах.',
        starterCode: `def solve():\n    # Напишите ваше решение здесь\n    pass\n`,
        testCases: [
          { input: 'test_1', expectedOutput: 'OK' }
        ],
        hint: 'Обратите внимание на граничные случаи.'
      },
      homework: {
        title: `ДЗ: ${title}`,
        description: 'Решите предложенную задачу и загрузите файл .py или .pdf в форму сдачи.',
        deadline: '18 октября 2026, 23:59',
        maxScore: 100,
        criteria: [
          'Корректность алгоритма (50 б.)',
          'Чистота кода PEP8 (30 б.)',
          'Эффективность по памяти (20 б.)'
        ]
      },
      extraMaterials: [
        {
          id: 'ext-1',
          title: 'Официальная документация Python',
          type: 'doc',
          url: 'https://docs.python.org/3/',
          description: 'Справочник по стандартной библиотеке.'
        }
      ],
      test: {
        title: `Тест по теме «${title}»`,
        timeLimitMinutes: 10,
        rewardXp: 50,
        questions: [
          {
            id: 'q1',
            text: 'Какое ключевое слово используется в Python для объявления функции?',
            type: 'single_choice',
            options: ['func', 'def', 'function', 'define'],
            correctAnswer: 1,
            points: 10,
            explanation: 'В языке Python функции определяются ключевым словом def.'
          }
        ]
      }
    };

    onCreateLesson(newLesson);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl shadow-2xl border p-6 backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-h-[90vh] flex flex-col">
        
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Конструктор нового урока</h3>
              <p className="text-xs text-neutral-400">Автоматически создаст все 9 карточек материалов</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-neutral-400 hover:text-neutral-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto py-4 space-y-4 flex-1 pr-1 text-xs">
          <div>
            <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Название урока
            </label>
            <input
              type="text"
              placeholder="Например: Двоичный поиск и логарифмическая сложность"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Тематический блок / Раздел
              </label>
              <input
                type="text"
                placeholder="Алгоритмы поиска"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Продолжительность (мин)
              </label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Краткое описание урока
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="О чем этот урок и какие навыки получат учащиеся..."
              className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
              Классы с доступом к уроку (RLS фильтрация):
            </label>
            <div className="flex flex-wrap gap-2">
              {classes.map(c => {
                const isSelected = selectedClasses.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleClass(c.id)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    Класс {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20"
            >
              Опубликовать урок
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
