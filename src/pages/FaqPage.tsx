import React, { useState, useMemo } from 'react';
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  BookOpen, 
  ShieldCheck, 
  Terminal, 
  Bot,
  Sparkles,
  Award
} from 'lucide-react';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { Link } from '../router/RouterContext';

interface FaqItem {
  id: string;
  category: 'students' | 'teachers' | 'ai' | 'grading';
  categoryLabel: string;
  question: string;
  answer: React.ReactNode;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'students',
    categoryLabel: 'Ученикам',
    question: 'Как сдать домашнее задание и какие файлы принимаются?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          В каждом уроке откройте вкладку <strong>«Домашнее задание»</strong>. Вы можете перетащить файл прямо в область загрузки (drag-and-drop) или нажать «Выбрать файл».
        </p>
        <p>
          Поддерживаемые форматы: <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-blue-600 dark:text-blue-400 font-mono text-xs">.py</code> (скрипты Python), <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-xs">.zip</code> (архивы проектов), <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-xs">.pdf</code> (отчеты и блок-схемы) и <code className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 font-mono text-xs">.docx</code>.
        </p>
        <p>
          При необходимости оставьте текстовый комментарий для учителя с пояснением к вашему решению.
        </p>
      </div>
    )
  },
  {
    id: 'faq-2',
    category: 'students',
    categoryLabel: 'Ученикам',
    question: 'Почему я вижу уроки только для своего класса (например, 10-C)?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          В платформе Smart ICT действует строгая изоляция учебных программ:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Ученики 7-х классов видят программу базовой информатики и крафтинга;</li>
          <li>Ученики 10-C видят углубленные модули олимпиадного программирования (стеки, деревья, алгоритмы);</li>
          <li>Ученики 11-B видят практикумы подготовки к ЕГЭ и реляционные базы данных.</li>
        </ul>
        <p>
          Это защищает от путаницы и гарантирует выполнение актуальных дедлайнов именно вашего класса.
        </p>
      </div>
    )
  },
  {
    id: 'faq-3',
    category: 'grading',
    categoryLabel: 'Оценки и XP',
    question: 'Как начисляются баллы опыта (XP) и серии дней (Streaks)?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          Опыт (XP) начисляется за активное обучение:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>+50 XP</strong> — успешное завершение изучения всех 9 карточек урока;</li>
          <li><strong>+30 XP</strong> — своевременная отправка домашнего задания;</li>
          <li><strong>+80–120 XP</strong> — сдача контрольного онлайн-тестирования без ошибок;</li>
          <li><strong>+20 XP</strong> — решение задачи в интерактивной консоли Python.</li>
        </ul>
        <p>
          Каждый день, когда вы открываете урок или решаете задачу, счетчик непрерывной серии дней (Streak) увеличивается на 1.
        </p>
      </div>
    )
  },
  {
    id: 'faq-4',
    category: 'ai',
    categoryLabel: 'AI-Тьютор',
    question: 'Почему AI-тьютор не пишет готовое решение домашнего задания?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          AI-тьютор разработан как <strong>педагогический наставник</strong>, а не генератор ответов для списывания.
        </p>
        <p>
          Он обучен по методике учителя информатики: находит синтаксические ошибки, объясняет суть алгоритма простыми словами, рисует аналогии (например, стек как стопка тарелок) и задает наводящие вопросы, чтобы вы сами нашли правильное решение.
        </p>
      </div>
    )
  },
  {
    id: 'faq-5',
    category: 'teachers',
    categoryLabel: 'Учителям',
    question: 'Как создать новый урок и наполнить все 9 типов карточек?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          Войдите под ролью учителя (в верхнем меню выберите преподавателя) и нажмите кнопку <strong>«+ Создать урок»</strong> в каталоге или дашборде.
        </p>
        <p>
          В конструкторе вы задаете:
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Параллель и целевые классы (например, 7-A или 10-C);</li>
          <li>Конспект с поддержкой форматирования кода;</li>
          <li>Слайды презентации и ссылку на видеоурок;</li>
          <li>Условия лабораторной работы и тесты для Python-раннера;</li>
          <li>Критерии оценивания домашнего задания и дедлайн;</li>
          <li>Вопросы для теста с выбором ответа или анализом вывода кода.</li>
        </ol>
      </div>
    )
  },
  {
    id: 'faq-6',
    category: 'teachers',
    categoryLabel: 'Учителям',
    question: 'Как устроен процесс рецензирования и выставления оценок?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          В панели учителя в разделе <strong>«Работы на проверке»</strong> отображаются все сданные файлы учащихся.
        </p>
        <p>
          Учитель может просмотреть прикрепленный код Python или файл отчета, выставить оценку от 0 до 100 баллов, написать развернутую обратную связь или вернуть работу со статусом «Требует доработки». Ученик моментально получает уведомление в колокольчик.
        </p>
      </div>
    )
  },
  {
    id: 'faq-7',
    category: 'grading',
    categoryLabel: 'Оценки и XP',
    question: 'Что означают значки и достижения (Badges)?',
    answer: (
      <div className="space-y-2 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
        <p>
          Бейджи — это награды за выдающиеся успехи:
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>«Первый код»</strong> — запуск первой программы в онлайн-лаборатории;</li>
          <li><strong>«Python Пионер»</strong> — сдача первого домашнего задания;</li>
          <li><strong>«Серия 7 дней»</strong> — непрерывная учеба в течение недели;</li>
          <li><strong>«Знаток алгоритмов»</strong> — сдача олимпиадного теста с максимальным баллом.</li>
        </ul>
        <p>
          Все бейджи отображаются в вашем профиле и на странице рейтинга.
        </p>
      </div>
    )
  }
];

export const FaqPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openItemIds, setOpenItemIds] = useState<Record<string, boolean>>({
    'faq-1': true,
    'faq-4': true
  });

  const toggleItem = (id: string) => {
    setOpenItemIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredItems = useMemo(() => {
    return FAQ_ITEMS.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inQuestion = item.question.toLowerCase().includes(q);
        const inCat = item.categoryLabel.toLowerCase().includes(q);
        return inQuestion || inCat;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Часто задаваемые вопросы (FAQ)' }]} />

      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>База знаний Smart ICT</span>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
          Часто задаваемые вопросы
        </h1>
        
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Руководство по работе с уроками, сдаче домашних работ, автопроверке кода и системе геймификации
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по вопросам: например, 'дедлайн', 'python', 'XP', 'домашнее задание'..."
          className="w-full pl-12 pr-4 py-3 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Все вопросы ({FAQ_ITEMS.length})
        </button>

        <button
          onClick={() => setSelectedCategory('students')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'students'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Ученикам
        </button>

        <button
          onClick={() => setSelectedCategory('teachers')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'teachers'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Учителям
        </button>

        <button
          onClick={() => setSelectedCategory('grading')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'grading'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          Оценки & XP
        </button>

        <button
          onClick={() => setSelectedCategory('ai')}
          className={`px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            selectedCategory === 'ai'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          AI-тьютор
        </button>
      </div>

      {/* Accordion List */}
      <div className="space-y-3">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <HelpCircle className="w-8 h-8 text-neutral-400 mx-auto" />
            <div className="font-semibold text-neutral-900 dark:text-white text-sm">
              Ничего не найдено
            </div>
            <p className="text-xs text-neutral-500">
              Попробуйте изменить поисковый запрос или сбросить фильтры
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isOpen = Boolean(openItemIds[item.id]);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => toggleItem(item.id)}
                  className="w-full p-5 text-left flex items-center justify-between space-x-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 uppercase tracking-wider">
                      {item.categoryLabel}
                    </span>
                    <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-white">
                      {item.question}
                    </h3>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Callout box */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/30 to-indigo-900/20 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
              Остались вопросы по домашнему заданию или коду?
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Наш интеллектуальный AI-тьютор поможет разобрать ошибку в любое время суток
            </p>
          </div>
        </div>

        <Link
          to="/lessons"
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 whitespace-nowrap shadow-md shadow-blue-500/20 transition-all"
        >
          Перейти к урокам
        </Link>
      </div>

    </div>
  );
};
