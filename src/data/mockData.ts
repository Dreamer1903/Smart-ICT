import {
  User,
  SchoolClass,
  Subject,
  Lesson,
  Test,
  HomeworkSubmission,
  GamificationBadge,
  AppNotification,
  Announcement
} from '../types';

export const INITIAL_CLASSES: SchoolClass[] = [
  { id: '10C', name: '10-C', grade: 10, studentCount: 26, description: 'Профильный IT-класс (Python, Алгоритмы, Олимпиады)' },
  { id: '7A', name: '7-A', grade: 7, studentCount: 28, description: 'Базовый курс информатики (Основы алгоритмизации и Python)' },
  { id: '11B', name: '11-B', grade: 11, studentCount: 22, description: 'Выпускной класс (Подготовка к ЕГЭ, Архитектура ПО)' },
  { id: '5A', name: '5-A', grade: 5, studentCount: 30, description: 'Введение в цифровую грамотность и логику' },
  { id: '6B', name: '6-B', grade: 6, studentCount: 27, description: 'Блочное программирование и цифровая безопасность' },
  { id: '8A', name: '8-A', grade: 8, studentCount: 29, description: 'Алгоритмы обработки массивов и базовая робототехника' },
  { id: '9A', name: '9-A', grade: 9, studentCount: 25, description: 'Подготовка к ОГЭ и основы веб-технологий' },
];

export const INITIAL_SUBJECTS: Subject[] = [
  {
    id: 'subj-cs',
    name: 'Информатика',
    slug: 'cs',
    icon: 'Terminal',
    description: 'Алгоритмы, структуры данных, язык Python, архитектура ЭВМ, сети и базы данных.',
    color: '#2563EB',
    lessonCount: 34
  },
  {
    id: 'subj-crafting',
    name: 'Крафтинг & Робототехника',
    slug: 'crafting',
    icon: 'Cpu',
    description: 'Микроконтроллеры Arduino и ESP32, пайка, датчики, 3D-моделирование и умные устройства.',
    color: '#059669',
    lessonCount: 24
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'student-1',
    email: 'muhammad@school.edu',
    password: 'student123',
    name: 'Мухаммад Салихов',
    role: 'student',
    classId: '10C',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    xp: 1450,
    level: 5,
    streakDays: 8,
    completedLessons: ['lesson-10c-1'],
    badges: ['badge-python-1', 'badge-streak-7', 'badge-hw-master'],
    bio: 'Ученик 10-C класса. Увлекаюсь олимпиадным программированием на Python и алгоритмами.',
    registeredAt: '2026-09-01'
  },
  {
    id: 'student-2',
    email: 'anna@school.edu',
    password: 'student123',
    name: 'Анна Смирнова',
    role: 'student',
    classId: '7A',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    xp: 920,
    level: 3,
    streakDays: 4,
    completedLessons: ['lesson-7a-1'],
    badges: ['badge-first-step'],
    bio: 'Ученица 7-A класса. Люблю создавать первые программы и рисовать в Turtle.',
    registeredAt: '2026-09-02'
  },
  {
    id: 'student-3',
    email: 'daniil@school.edu',
    password: 'student123',
    name: 'Даниил Волков',
    role: 'student',
    classId: '11B',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    xp: 2850,
    level: 9,
    streakDays: 14,
    completedLessons: ['lesson-11b-1'],
    badges: ['badge-algo-pro', 'badge-streak-7'],
    bio: '11-B класс. Цель — 100 баллов на ЕГЭ по информатике.',
    registeredAt: '2026-08-28'
  },
  {
    id: 'teacher-1',
    email: 'teacher@school.edu',
    password: 'teacher123',
    name: 'Абдугафоров Мухаммадрахим Равшанович',
    role: 'teacher',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    xp: 9999,
    level: 50,
    streakDays: 120,
    completedLessons: [],
    badges: ['badge-mentor'],
    bio: 'Учитель информатики и ИКТ (ICT) высшей квалификационной категории. Эксперт по программированию на Python, алгоритмизации и подготовке к олимпиадам.',
    registeredAt: '2025-08-15'
  },
  {
    id: 'admin-1',
    email: 'admin@school.edu',
    password: 'admin123',
    name: 'Елена Андреевна Воронова',
    role: 'admin',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    xp: 9999,
    level: 99,
    streakDays: 365,
    completedLessons: [],
    badges: [],
    bio: 'Системный администратор платформы и завуч по цифровизации.',
    registeredAt: '2025-08-01'
  }
];

export const INITIAL_BADGES: GamificationBadge[] = [
  {
    id: 'badge-first-step',
    title: 'Первый код',
    description: 'Успешно сдать первую практическую работу по программированию.',
    icon: 'Terminal',
    category: 'python',
    xpReward: 100,
    unlocked: true,
    progressPercent: 100
  },
  {
    id: 'badge-python-1',
    title: 'Python Пионер',
    description: 'Решить 10 задач без единой синтаксической ошибки.',
    icon: 'Sparkles',
    category: 'python',
    xpReward: 250,
    unlocked: true,
    progressPercent: 100
  },
  {
    id: 'badge-streak-7',
    title: 'Серия 7 дней',
    description: 'Заходить на платформу и учиться 7 дней подряд без перерыва.',
    icon: 'Flame',
    category: 'streak',
    xpReward: 300,
    unlocked: true,
    progressPercent: 100
  },
  {
    id: 'badge-hw-master',
    title: 'Мастер ДЗ',
    description: 'Сдать 5 домашних заданий с высшей оценкой 100 баллов.',
    icon: 'Award',
    category: 'homework',
    xpReward: 400,
    unlocked: true,
    progressPercent: 100
  },
  {
    id: 'badge-algo-pro',
    title: 'Гуру Алгоритмов',
    description: 'Решить задачу с временной сложностью O(N log N).',
    icon: 'Cpu',
    category: 'general',
    xpReward: 500,
    unlocked: false,
    progressPercent: 65
  },
  {
    id: 'badge-test-ace',
    title: 'Снайпер Тестов',
    description: 'Пройти онлайн-тест на 100% за половину отведенного времени.',
    icon: 'CheckCircle2',
    category: 'tests',
    xpReward: 350,
    unlocked: false,
    progressPercent: 80
  }
];

export const INITIAL_TESTS: Record<string, Test> = {
  'test-10c-1': {
    id: 'test-10c-1',
    lessonId: 'lesson-10c-1',
    title: 'Контрольный срез: Сложность алгоритмов и Стек в Python',
    timeLimitMinutes: 15,
    totalPoints: 100,
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        type: 'single',
        prompt: 'Какова асимптотическая временная сложность поиска элемента в неотсортированном списке длиной N в худшем случае?',
        options: [
          { id: 'opt1', text: 'O(1) — константная' },
          { id: 'opt2', text: 'O(log N) — логарифмическая' },
          { id: 'opt3', text: 'O(N) — линейная' },
          { id: 'opt4', text: 'O(N²) — квадратичная' }
        ],
        correctOptionIds: ['opt3'],
        explanation: 'В худшем случае искомый элемент находится в самом конце списка либо вовсе отсутствует, поэтому алгоритму необходимо просмотреть все N элементов.',
        points: 25
      },
      {
        id: 'q2',
        type: 'code',
        prompt: 'Что выведет следующий фрагмент кода на языке Python?',
        codeSnippet: `stack = []
for x in [10, 20, 30]:
    stack.append(x * 2)
res = stack.pop() + stack.pop()
print(res)`,
        options: [
          { id: 'c1', text: '60' },
          { id: 'c2', text: '100' },
          { id: 'c3', text: '50' },
          { id: 'c4', text: 'Ошибка IndexError' }
        ],
        correctOptionIds: ['c2'],
        explanation: 'В стек добавляются [20, 40, 60]. stack.pop() вернет 60, следующий stack.pop() вернет 40. 60 + 40 = 100.',
        points: 25
      },
      {
        id: 'q3',
        type: 'multiple',
        prompt: 'Какие операции выполняются со структурой данных Стек (Stack) за константное время O(1)?',
        options: [
          { id: 'm1', text: 'push (добавление элемента на вершину)' },
          { id: 'm2', text: 'pop (извлечение верхнего элемента)' },
          { id: 'm3', text: 'peek / top (просмотр верхнего элемента)' },
          { id: 'm4', text: 'поиск минимального элемента в произвольном неотсортированном стеке без доп. памяти' }
        ],
        correctOptionIds: ['m1', 'm2', 'm3'],
        explanation: 'Все базовые операции на вершине стека (push, pop, peek) выполняются строго за O(1). Поиск требует O(N).',
        points: 25
      },
      {
        id: 'q4',
        type: 'matching',
        prompt: 'Сопоставьте алгоритм с его асимптотической сложностью в среднем случае:',
        matchingPairs: [
          { left: 'Быстрая сортировка (QuickSort)', right: 'O(N log N)' },
          { left: 'Бинарный поиск (Binary Search)', right: 'O(log N)' },
          { left: 'Пузырьковая сортировка (Bubble Sort)', right: 'O(N²)' },
          { left: 'Доступ по индексу в массиве (arr[i])', right: 'O(1)' }
        ],
        correctOptionIds: [],
        explanation: 'Бинарный поиск делит массив пополам O(log N), доступ по индексу O(1), QuickSort в среднем O(N log N).',
        points: 25
      }
    ]
  },
  'test-7a-1': {
    id: 'test-7a-1',
    lessonId: 'lesson-7a-1',
    title: 'Тест 7 класс: Переменные и ветвления в Python',
    timeLimitMinutes: 10,
    totalPoints: 100,
    passingScore: 60,
    questions: [
      {
        id: 'q7-1',
        type: 'single',
        prompt: 'Какой оператор в Python используется для проверки равенства двух значений?',
        options: [
          { id: 'a', text: '=' },
          { id: 'b', text: '==' },
          { id: 'c', text: '===' },
          { id: 'd', text: 'eq' }
        ],
        correctOptionIds: ['b'],
        explanation: 'Одиночный знак "=" — это присваивание, а двойной "==" — оператор сравнения на равенство.',
        points: 50
      },
      {
        id: 'q7-2',
        type: 'code',
        prompt: 'Какое значение будет выведено в консоль?',
        codeSnippet: `a = 15
b = 4
print(a // b, a % b)`,
        options: [
          { id: 'r1', text: '3.75 3' },
          { id: 'r2', text: '3 3' },
          { id: 'r3', text: '4 1' },
          { id: 'r4', text: '3 0' }
        ],
        correctOptionIds: ['r2'],
        explanation: '15 // 4 = 3 (целочисленное деление), 15 % 4 = 3 (остаток от деления).',
        points: 50
      }
    ]
  }
};

export const INITIAL_LESSONS = [
  {
    id: 'lesson-10c-1',
    subjectId: 'subj-cs',
    grade: 10,
    targetClassIds: ['10C'],
    orderNumber: 1,
    title: 'Сложность алгоритмов и базовые структуры данных: Стек и Очередь',
    topic: 'Алгоритмы и структуры данных',
    description: 'Изучаем нотацию O-большое (Big-O), анализ временной и пространственной сложности, реализацию структуры данных LIFO (Стек) и FIFO (Очередь) на Python.',
    durationMinutes: 45,
    date: '2026-09-12',
    published: true,
    cards: {
      notes: {
        title: 'Конспект: Нотация Big-O и Стек (LIFO) в деталях',
        readTimeMinutes: 12,
        markdownContent: `# Сложность алгоритмов (Big-O) и Стек (Stack)

## 1. Зачем анализировать сложность?
При решении олимпиадных и прикладных задач скорость работы программы зависит от размера входных данных **N**.

- **O(1)** — Константная сложность: время не зависит от N (например, обращение по индексу \`arr[5]\`).
- **O(log N)** — Логарифмическая: на каждом шаге объем работы уменьшается вдвое (Бинарный поиск).
- **O(N)** — Линейная: просмотр всех элементов один раз (поиск минимума \`min()\`).
- **O(N log N)** — Оптимальная сортировка (Timsort в Python, QuickSort, MergeSort).
- **O(N²)** — Квадратичная: вложенные циклы \`for i in ...: for j in ...:\`.

---

## 2. Структура данных Стек (Stack)
Стек работает по принципу **LIFO** (*Last In, First Out* — последним пришел, первым ушел).

### Базовые операции:
- \`push(item)\` — добавить элемент на вершину (в Python: \`stack.append(x)\`, сложность **O(1)**)
- \`pop()\` — извлечь элемент с вершины (в Python: \`stack.pop()\`, сложность **O(1)**)
- \`peek()\` — посмотреть элемент на вершине без удаления (\`stack[-1]\`, сложность **O(1)**)
- \`is_empty()\` — проверить, пуст ли стек (\`len(stack) == 0\`)

### Классическая задача: Правильная скобочная последовательность
\`\`\`python
def is_bracket_balanced(s: str) -> bool:
    stack = []
    pairs = {')': '(', ']': '[', '}': '{'}
    for char in s:
        if char in '([{':
            stack.append(char)
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]:
                return False
    return len(stack) == 0
\`\`\`
`
      },
      presentation: {
        title: 'Презентация: Архитектура Стека и Анализ Big-O',
        slides: [
          {
            slideNumber: 1,
            title: 'Сложность алгоритмов & Стек',
            content: 'Урок 1: Как писать эффективные программы на Python и правильно выбирать структуры данных.',
            bullets: [
              'Что такое асимптотическая сложность?',
              'Классификация Big-O (от O(1) до O(2^N))',
              'Стек: устройство памяти и применение'
            ]
          },
          {
            slideNumber: 2,
            title: 'Шкала эффективности алгоритмов',
            content: 'График зависимости времени выполнения от объема входных данных N:',
            bullets: [
              '🟢 O(1), O(log N) — великолепная масштабируемость',
              '🟡 O(N), O(N log N) — стандарт для 100 000+ элементов',
              '🔴 O(N²), O(2^N) — недопустимо при N > 5 000'
            ],
            codeSnippet: '# O(1) константа\ndef get_first(items):\n    return items[0] if items else None'
          },
          {
            slideNumber: 3,
            title: 'Принцип работы Стека (LIFO)',
            content: 'Представьте стопку тарелок: новую тарелку вы кладете НАВЕРХ, и забираете тоже СВЕРХУ.',
            bullets: [
              'Append: кладем на вершину стек (push)',
              'Pop: снимаем с вершины (pop)',
              'Все операции за O(1) амортизированное время'
            ]
          },
          {
            slideNumber: 4,
            title: 'Где применяется стек в реальной жизни?',
            content: 'Каждая современная ОС и приложение использует стек:',
            bullets: [
              'Кнопка "Назад" в браузере (История переходов)',
              'Отмена действий (Ctrl+Z / Undo в Photoshop, Word, VS Code)',
              'Call Stack: вызовы функций и рекурсия в процессоре',
              'Парсинг выражений (Обратная польская запись)'
            ]
          }
        ]
      },
      video: {
        title: 'Видеоразбор: Стек в Python за 15 минут с анимацией',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        duration: '14:35',
        summary: 'Наглядная визуализация работы оперативной памяти при добавлении элементов в стек, сравнение list и collections.deque, разбор скобочной последовательности.',
        chapters: [
          { time: '00:00', title: 'Введение и определение Big-O' },
          { time: '03:20', title: 'Визуализация операций Push и Pop' },
          { time: '07:45', title: 'Реализация на чистом Python' },
          { time: '11:10', title: 'Разбор типовой задачи со скобками' }
        ]
      },
      pdf: {
        title: 'Методическое пособие: Алгоритмы и структуры данных для школьников (10 класс)',
        filename: 'Informatics_10_Algorithms_Stack.pdf',
        pages: 18,
        sizeMb: 2.4,
        summary: 'Официальное пособие преподавателя Абдугафорова М.Р. с математическими доказательствами, таблицами сложности встроенных методов Python и 15 задачами с решениями.',
        previewContent: [
          'Раздел 1. Определение временной сложности T(N) и емкостной сложности M(N)',
          'Раздел 2. Анализ амортизированного времени работы динамического массива в CPython',
          'Раздел 3. Структура памяти: Heap vs Stack',
          'Раздел 4. Практикум: Стек на базе связного списка и массива'
        ]
      },
      lab: {
        title: 'Интерактивная практика: Проверка скобочной последовательности',
        taskDescription: 'Напишите функцию `is_valid_brackets(text)`, которая проверяет, сбалансированы ли круглые `()`, квадратные `[]` и фигурные `{}` скобки в переданной строке. Программа должна вернуть True, если последовательность корректна, и False в противном случае.',
        initialCode: `def is_valid_brackets(s: str) -> bool:
    # Используйте список stack = []
    # Ваше решение здесь:
    stack = []
    
    return True

# Тестовые данные для проверки:
test1 = "{ [ ( ) ] }"
test2 = "{ [ ( ] ) }"
print("Тест 1 (Ожидается True):", is_valid_brackets(test1))
print("Тест 2 (Ожидается False):", is_valid_brackets(test2))`,
        expectedOutput: `Тест 1 (Ожидается True): True
Тест 2 (Ожидается False): False`,
        hints: [
          'Создайте словарь соответствия закрывающих и открывающих скобок: matching = {")": "(", "]": "[", "}": "{"}',
          'При встрече открывающей скобки кладите её в stack: stack.append(char)',
          'При встрече закрывающей скобки проверяйте: если stack пуст или стек.pop() не равен парной скобке — возвращайте False!'
        ],
        language: 'python'
      },
      homework: {
        id: 'hw-10c-1',
        title: 'Домашнее задание №1: Калькулятор в Обратной Польской Записи (RPN)',
        description: 'Реализуйте функцию `eval_rpn(tokens)`, которая вычисляет значение арифметического выражения, записанного в обратной польской нотации (постфиксной записи). Например, ["2", "1", "+", "3", "*"] -> ((2 + 1) * 3) -> 9. Прикрепите файл .py с решением, тестами и кратким отчетом в PDF/Word.',
        deadline: '2026-09-18 23:59',
        maxScore: 100,
        allowedFormats: ['py', 'pdf', 'docx', 'zip'],
        attachmentFiles: [
          { name: 'rpn_template.py', size: '1.2 KB', url: '#' },
          { name: 'sample_test_cases.json', size: '3.4 KB', url: '#' }
        ]
      },
      extra: {
        title: 'Дополнительные материалы и ссылки для углубленного изучения',
        resources: [
          {
            title: 'Официальная документация: Collections deque в Python',
            type: 'link',
            url: 'https://docs.python.org/3/library/collections.html#collections.deque',
            desc: 'Почему для очереди и двухстороннего стека следует использовать deque вместо list.'
          },
          {
            title: 'Визуализатор алгоритмов VisuAlgo (Stack & Queue)',
            type: 'link',
            url: 'https://visualgo.net/en/list',
            desc: 'Интерактивная 3D-анимация работы стека и очереди в реальном времени.'
          },
          {
            title: 'Книга: Грокаем алгоритмы (Адитья Бхаргава)',
            type: 'book',
            url: '#',
            desc: 'Главы 3 и 4: Стек вызовов и рекурсивные функции в доступных иллюстрациях.'
          },
          {
            title: 'GitHub Репозиторий: Python Data Structures & Algorithms',
            type: 'github',
            url: 'https://github.com/TheAlgorithms/Python',
            desc: 'Открытый репозиторий с примерами промышленной реализации всех структур данных.'
          }
        ]
      },
      testId: 'test-10c-1',
      aiContext: {
        topics: ['Сложность алгоритмов Big-O', 'Стек LIFO', 'Методы append и pop', 'Скобочные последовательности', 'Вызовы функций Call Stack'],
        sampleQuestions: [
          'Что такое O(N) и O(1)? Объясни на простом жизненном примере.',
          'Как работает стек? Почему это LIFO?',
          'Помоги найти ошибку в моем решении со скобками.',
          'Дай мне дополнительную задачу на стек среднего уровня.'
        ],
        curriculumSummary: 'Материалы 10 класса по информатике и ИКТ преподавателя М.Р. Абдугафорова. Фокус: Python, структуры данных, асимптотика, практическое применение.'
      }
    }
  },
  {
    id: 'lesson-10c-2',
    subjectId: 'subj-cs',
    grade: 10,
    targetClassIds: ['10C'],
    orderNumber: 2,
    title: 'Рекурсия и Мемоизация: От чисел Фибоначчи к Динамическому Программированию',
    topic: 'Динамическое программирование',
    description: 'Базовый случай и шаг рекурсии, стек вызовов функций, экспоненциальная сложность O(2^N) и оптимизация до O(N) через словарь мемоизации и functools.lru_cache.',
    durationMinutes: 45,
    date: '2026-09-15',
    published: true,
    cards: {
      notes: {
        title: 'Конспект: Рекурсия и основы мемоизации',
        readTimeMinutes: 10,
        markdownContent: `# Рекурсия и Мемоизация

## Что такое рекурсия?
Рекурсия — это определение функции через саму себя. Любая корректная рекурсивная функция должна содержать:
1. **Базовый случай (Terminal condition)** — условие остановки, когда ответ известен без рекурсивного вызова.
2. **Шаг рекурсии** — вызов функции с аргументом, приближающим нас к базовому случаю.

\`\`\`python
def factorial(n: int) -> int:
    if n <= 1:
        return 1  # Базовый случай
    return n * factorial(n - 1)  # Шаг рекурсии
\`\`\`

## Мемоизация
Без сохранения промежуточных результатов вычисление n-го числа Фибоначчи требует $O(2^N)$ операций!
С мемоизацией — всего $O(N)$.
\`\`\`python
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
\`\`\`
`
      },
      lab: {
        title: 'Лабораторная: Подсчет путей черепашки на сетке NxM',
        taskDescription: 'Черепашка находится в левом верхнем углу сетки N x M и может двигаться только вправо или вниз. Напишите рекурсивную функцию с мемоизацией, которая возвращает количество уникальных путей до правого нижнего угла.',
        initialCode: `def count_paths(n: int, m: int, memo=None) -> int:
    if memo is None:
        memo = {}
    # Если мы в начале или размерность 1 - путь всего 1
    if n == 1 or m == 1:
        return 1
    # Ваше решение с мемоизацией:
    
    return 1

print("Пути для сетки 3x3 (Ожидается 6):", count_paths(3, 3))
print("Пути для сетки 5x5 (Ожидается 70):", count_paths(5, 5))`,
        expectedOutput: `Пути для сетки 3x3 (Ожидается 6): 6
Пути для сетки 5x5 (Ожидается 70): 70`,
        hints: [
          'Ключом в словаре memo может быть кортеж (n, m)',
          'count_paths(n, m) = count_paths(n-1, m) + count_paths(n, m-1)'
        ],
        language: 'python'
      },
      homework: {
        id: 'hw-10c-2',
        title: 'Домашнее задание №2: Задача о размене монет (Coin Change Problem)',
        description: 'Даны номиналы монет [1, 2, 5, 10] и сумма S. Найдите минимальное количество монет, необходимое для набора суммы S, используя мемоизацию или массив ДП. Загрузите файл solution.py с тестами.',
        deadline: '2026-09-22 23:59',
        maxScore: 100,
        allowedFormats: ['py', 'pdf', 'zip']
      }
    }
  },
  {
    id: 'lesson-7a-1',
    subjectId: 'subj-cs',
    grade: 7,
    targetClassIds: ['7A'],
    orderNumber: 1,
    title: 'Знакомство с языком Python: Переменные, Типы данных и Ввод/Вывод',
    topic: 'Основы синтаксиса Python',
    description: 'Первые шаги в текстовом программировании: функции print() и input(), целые числа int, строки str, вещественные числа float, правила именования переменных.',
    durationMinutes: 40,
    date: '2026-09-11',
    published: true,
    cards: {
      notes: {
        title: 'Конспект: Первые шаги в Python',
        readTimeMinutes: 8,
        markdownContent: `# Знакомство с Python (7 класс)

## 1. Функция вывода print()
\`\`\`python
print("Привет, 7-А класс!")
print(2 + 2 * 2)  # Сначала умножение, результат: 6
\`\`\`

## 2. Переменные и типы данных
- \`int\` — целые числа (\`5\`, \`-12\`, \`0\`)
- \`float\` — числа с плавающей точкой (\`3.14\`, \`-0.5\`)
- \`str\` — строковые значения в кавычках (\`"Информатика"\`)
- \`bool\` — логический тип (\`True\` или \`False\`)

## 3. Функция ввода input()
Функция \`input()\` ВСЕГДА возвращает строку! Чтобы работать с числом, нужно преобразовать тип:
\`\`\`python
name = input("Как тебя зовут? ")
age = int(input("Сколько тебе лет? "))
print(f"Привет, {name}! В следующем году тебе будет {age + 1}.")
\`\`\`
`
      },
      presentation: {
        title: 'Слайды: Архитектура программы на Python',
        slides: [
          {
            slideNumber: 1,
            title: 'Добро пожаловать в Python!',
            content: 'Python — самый популярный язык программирования для обучения, искусственного интеллекта и робототехники.',
            bullets: [
              'Простой и понятный синтаксис',
              'Работает на Windows, Mac, Linux и микрокомпьютерах',
              'Используется в Google, NASA и YouTube'
            ]
          },
          {
            slideNumber: 2,
            title: 'Переменные — это коробки с именами',
            content: 'Переменная хранит значение в оперативной памяти компьютера.',
            bullets: [
              'Имя пишется на английском языке со строчной буквы',
              'Знак "=" — это оператор сохранения значения в переменную',
              'Тип переменной определяется автоматически'
            ]
          }
        ]
      },
      lab: {
        title: 'Практика: Программа расчета периметра и площади прямоугольника',
        taskDescription: 'Даны стороны прямоугольника a = 12 и b = 7. Вычислите и выведите его площадь S = a * b и периметр P = 2 * (a + b).',
        initialCode: `a = 12
b = 7

# Вычислите площадь и периметр:
square = 0
perimeter = 0

print("Площадь:", square)
print("Периметр:", perimeter)`,
        expectedOutput: `Площадь: 84
Периметр: 38`,
        hints: ['square = a * b', 'perimeter = 2 * (a + b)'],
        language: 'python'
      },
      homework: {
        id: 'hw-7a-1',
        title: 'Домашнее задание: Конвертер валют и температур',
        description: 'Напишите программу в файле converter.py, которая переводит температуру из градусов Цельсия в градусы Фаренгейта по формуле F = C * 1.8 + 32.',
        deadline: '2026-09-17 20:00',
        maxScore: 100,
        allowedFormats: ['py', 'docx', 'pdf', 'png']
      },
      testId: 'test-7a-1',
      aiContext: {
        topics: ['Переменные в Python', 'print() и input()', 'Преобразование int() и float()', 'Арифметические операции'],
        sampleQuestions: [
          'Почему при вводе чисел программа складывает их как слова ("5" + "5" = "55")?',
          'Каковы правила именования переменных?',
          'Объясни разницу между делением / и //'
        ],
        curriculumSummary: 'Базовый курс информатики и ИКТ 7 класса. Преподаватель Абдугафоров М.Р. Понятные примеры с акцентом на дружелюбное объяснение.'
      }
    }
  },
  {
    id: 'lesson-11b-1',
    subjectId: 'subj-cs',
    grade: 11,
    targetClassIds: ['11B'],
    orderNumber: 1,
    title: 'Теория графов и алгоритмы поиска: BFS и DFS в олимпиадных задачах',
    topic: 'Графы и структуры данных',
    description: 'Матрица смежности, списки смежности, поиск в ширину (BFS) для нахождения кратчайшего пути и поиск в глубину (DFS) для проверки связности компонентов.',
    durationMinutes: 45,
    date: '2026-09-10',
    published: true,
    cards: {
      notes: {
        title: 'Конспект: Представление графов и обход BFS/DFS',
        readTimeMinutes: 15,
        markdownContent: `# Теория графов в Python (11 класс)

## 1. Представление графа
Самый удобный способ для олимпиадных задач — **список смежности** на базе \`dict\` или \`list\`:
\`\`\`python
graph = {
    'A': ['B', 'C'],
    'B': ['A', 'D', 'E'],
    'C': ['A', 'F'],
    'D': ['B'],
    'E': ['B', 'F'],
    'F': ['C', 'E']
}
\`\`\`

## 2. Поиск в ширину (BFS — Breadth-First Search)
Использует **Очередь (FIFO)**. Гарантированно находит кратчайший путь в невзвешенном графе!
\`\`\`python
from collections import deque

def bfs_shortest_path(graph, start, goal):
    queue = deque([[start]])
    visited = {start}
    while queue:
        path = queue.popleft()
        node = path[-1]
        if node == goal:
            return path
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(path + [neighbor])
    return None
\`\`\`
`
      },
      homework: {
        id: 'hw-11b-1',
        title: 'Домашнее задание: Поиск циклов в ориентированном графе (DFS с цветами вершин)',
        description: 'Реализуйте алгоритм поиска цикла в ориентированном графе с использованием трех цветов вершин (0 — белая, 1 — серая, 2 — черная). Прикрепите cycle_finder.py.',
        deadline: '2026-09-19 23:59',
        maxScore: 100,
        allowedFormats: ['py', 'zip', 'pdf']
      }
    }
  },
  {
    id: 'lesson-craft-1',
    subjectId: 'subj-crafting',
    grade: 8,
    targetClassIds: ['8A', '10C', '7A'],
    orderNumber: 1,
    title: 'Введение в микроконтроллеры Arduino: Порты ввода-вывода и закон Ома',
    topic: 'Робототехника и Схемотехника',
    description: 'Принцип работы микроконтроллера ATmega328P, расчет токоограничивающего резистора для светодиода, сборка первой схемы на макетной плате (Breadboard) и скетч мигания.',
    durationMinutes: 45,
    date: '2026-09-14',
    published: true,
    cards: {
      notes: {
        title: 'Конспект: Основы электроники и Arduino',
        readTimeMinutes: 10,
        markdownContent: `# Микроконтроллеры Arduino & Закон Ома

## Закон Ома для участка цепи
$$I = \\frac{U}{R}$$
Где:
- **I** — сила тока (в Амперах, для светодиода обычно 15-20 мА = 0.02 А)
- **U** — напряжение (в Вольтах, выход Arduino дает 5V, падение на красном светодиоде ~2V, на резисторе остается 3V)
- **R** — сопротивление резистора: $R = \\frac{3V}{0.02A} = 150-220 Ом$.
`
      },
      homework: {
        id: 'hw-craft-1',
        title: 'Домашнее задание: Схема светофора в Tinkercad',
        description: 'Соберите виртуальную схему трехцветного светофора в симуляторе Tinkercad Circuits и напишите скетч для переключения сигналов с паузами. Загрузите скриншот схемы и файл скетча .ino.',
        deadline: '2026-09-20 18:00',
        maxScore: 100,
        allowedFormats: ['png', 'jpg', 'pdf', 'zip']
      }
    }
  }
];

export const INITIAL_SUBMISSIONS: HomeworkSubmission[] = [
  {
    id: 'sub-1',
    homeworkId: 'hw-10c-1',
    lessonId: 'lesson-10c-1',
    lessonTitle: 'Сложность алгоритмов и базовые структуры данных',
    studentId: 'student-1',
    studentName: 'Мухаммад Салихов',
    studentAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    classId: '10C',
    submittedAt: '2026-09-10 16:30',
    status: 'graded',
    score: 95,
    maxScore: 100,
    teacherFeedback: 'Отличная реализация RPN калькулятора! Обработка деления на ноль выполнена корректно через исключение ZeroDivisionError. Дополнительный плюс за модульные тесты.',
    files: [
      {
        name: 'rpn_calculator.py',
        size: '3.8 KB',
        type: 'python',
        content: `def eval_rpn(tokens):\n    stack = []\n    ops = {\n        '+': lambda a, b: a + b,\n        '-': lambda a, b: a - b,\n        '*': lambda a, b: a * b,\n        '/': lambda a, b: int(a / b)\n    }\n    for t in tokens:\n        if t in ops:\n            b = stack.pop()\n            a = stack.pop()\n            stack.append(ops[t](a, b))\n        else:\n            stack.append(int(t))\n    return stack[0]`
      },
      {
        name: 'report_salikhov.pdf',
        size: '240 KB',
        type: 'pdf'
      }
    ],
    studentComment: 'Мухаммадрахим Равшанович, реализовал все 4 базовые операции и добавил проверку на корректность входных токенов.'
  },
  {
    id: 'sub-2',
    homeworkId: 'hw-7a-1',
    lessonId: 'lesson-7a-1',
    lessonTitle: 'Знакомство с языком Python',
    studentId: 'student-2',
    studentName: 'Анна Смирнова',
    studentAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    classId: '7A',
    submittedAt: '2026-09-10 18:15',
    status: 'submitted',
    maxScore: 100,
    files: [
      {
        name: 'temperature_converter.py',
        size: '1.1 KB',
        type: 'python',
        content: `c = float(input("Введите температуру в Цельсиях: "))\nf = c * 1.8 + 32\nprint(f"Температура в Фаренгейтах: {f:.2f}")`
      }
    ],
    studentComment: 'Сделала красивый вывод с округлением до двух знаков после запятой!'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    userId: 'student-1',
    title: 'Домашнее задание проверено',
    message: 'Абдугафоров Мухаммадрахим Равшанович оценил ваше ДЗ "Калькулятор RPN" на 95 баллов из 100.',
    type: 'homework',
    date: '10 минут назад',
    read: false,
    link: 'homework'
  },
  {
    id: 'notif-2',
    userId: 'student-1',
    title: 'Новое достижение разблокировано!',
    message: 'Вы получили значок "Серия 7 дней" и +300 XP за регулярные занятия.',
    type: 'achievement',
    date: 'Вчера',
    read: false,
    link: 'gamification'
  },
  {
    id: 'notif-3',
    userId: 'student-1',
    title: 'Новый урок опубликован',
    message: 'Урок 2 "Рекурсия и Мемоизация" доступен для 10-C класса.',
    type: 'announcement',
    date: '2 дня назад',
    read: true,
    link: 'lessons'
  }
];

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-1',
    title: 'Старт подготовки к олимпиаде по информатике и ИКТ',
    content: 'Уважаемые ученики! По четвергам в 16:30 в кабинете 304 (компьютерный класс) проходят тренировки по алгоритмам и программированию на Python.',
    authorName: 'Абдугафоров Мухаммадрахим Равшанович (Учитель ИКТ)',
    date: '2026-09-08',
    targetClassIds: ['10C', '11B'],
    pinned: true
  },
  {
    id: 'ann-2',
    title: 'Правила сдачи лабораторных и домашних работ на платформе',
    content: 'Напоминаем: все файлы решений на языке Python должны быть проверены линтером, а архивы не должны содержать временных папок .venv или __pycache__.',
    authorName: 'Елена Андреевна (Администратор)',
    date: '2026-09-01',
    targetClassIds: [],
    pinned: false
  }
];

// Unified MOCK collections mapped for full component compatibility
export const MOCK_USERS: User[] = INITIAL_USERS;
export const MOCK_CLASSES: SchoolClass[] = INITIAL_CLASSES;
export const MOCK_SUBJECTS: Subject[] = INITIAL_SUBJECTS;
export const MOCK_BADGES: GamificationBadge[] = INITIAL_BADGES;
export const MOCK_ANNOUNCEMENTS: Announcement[] = INITIAL_ANNOUNCEMENTS;
export const MOCK_NOTIFICATIONS: AppNotification[] = INITIAL_NOTIFICATIONS;
export const MOCK_SUBMISSIONS: HomeworkSubmission[] = INITIAL_SUBMISSIONS;

export const MOCK_LESSONS: Lesson[] = INITIAL_LESSONS.map((l: any) => {
  const c = l.cards || {};
  const testData = c.testId && INITIAL_TESTS[c.testId] ? INITIAL_TESTS[c.testId] : null;

  return {
    ...l,
    classIds: l.targetClassIds || ['10C'],
    quarter: 1,
    notes: {
      sections: [
        {
          title: c.notes?.title || l.title,
          content: c.notes?.markdownContent || l.description,
          codeLanguage: 'python'
        }
      ],
      keyTakeaways: [
        'Понимание асимптотической сложности Big-O',
        'Владение структурами данных Стек и Очередь на Python',
        'Своевременная сдача домашних заданий'
      ],
      readTimeMinutes: c.notes?.readTimeMinutes || 10
    },
    slides: (c.presentation?.slides || []).map((s: any) => ({
      id: `slide-${s.slideNumber || Math.random()}`,
      title: s.title,
      bullets: s.bullets || [s.content],
      codeSnippet: s.codeSnippet,
      slideNumber: s.slideNumber
    })),
    video: {
      title: c.video?.title || `Видеоурок: ${l.title}`,
      durationMinutes: 15,
      youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516116211227-bbc13c744ef5?w=800&auto=format&fit=crop&q=80',
      chapters: c.video?.chapters || [
        { time: '00:00', title: 'Введение' },
        { time: '05:00', title: 'Разбор теории' },
        { time: '10:00', title: 'Практика в коде' }
      ]
    },
    pdf: {
      title: c.pdf?.title || `Методическое пособие: ${l.title}`,
      fileSize: `${c.pdf?.sizeMb || 1.8} MB`,
      pageCount: c.pdf?.pages || 14,
      url: '#'
    },
    lab: {
      title: c.lab?.title || `Лабораторный практикум: ${l.title}`,
      instructions: c.lab?.taskDescription || 'Напишите функцию на Python и проверьте на встроенных тестах.',
      starterCode: c.lab?.initialCode || 'def solve():\n    pass\n',
      testCases: [
        { input: 'test1', expectedOutput: 'True' },
        { input: 'test2', expectedOutput: 'False' }
      ],
      hint: c.lab?.hints?.[0] || 'Внимательно проверяйте граничные условия.'
    },
    homework: {
      title: c.homework?.title || `Домашнее задание: ${l.title}`,
      description: c.homework?.description || 'Выполните домашнее задание и загрузите файл в систему.',
      deadline: c.homework?.deadline || '18 октября 2026, 23:59',
      maxScore: c.homework?.maxScore || 100,
      criteria: [
        'Корректность алгоритма (50 баллов)',
        'Соблюдение стандарта PEP8 и чистота кода (30 баллов)',
        'Оптимальная временная сложность (20 баллов)'
      ]
    },
    extraMaterials: (c.extra?.resources || []).map((r: any, idx: number) => ({
      id: `ext-${idx}`,
      title: r.title,
      type: r.type || 'doc',
      url: r.url,
      description: r.desc || 'Рекомендованный материал преподавателя'
    })),
    test: testData ? {
      id: testData.id,
      title: testData.title,
      timeLimitMinutes: testData.timeLimitMinutes,
      rewardXp: 100,
      questions: testData.questions.map((q: any) => ({
        id: q.id,
        text: q.prompt,
        type: q.type === 'single' ? 'single_choice' : q.type === 'multiple' ? 'multiple_choice' : 'code_output',
        options: (q.options || []).map((o: any) => typeof o === 'string' ? o : o.text),
        correctAnswer: q.correctOptionIds ? (q.options || []).findIndex((o: any) => o.id === q.correctOptionIds[0]) : 0,
        points: q.points,
        explanation: q.explanation,
        codeSnippet: q.codeSnippet
      }))
    } : {
      title: `Тест по теме ${l.title}`,
      timeLimitMinutes: 15,
      rewardXp: 80,
      questions: [
        {
          id: 'q-default',
          text: 'Какая временная сложность у добавления элемента в конец списка Python (append)?',
          type: 'single_choice',
          options: ['O(1) амортизированная', 'O(N) линейная', 'O(N²) квадратичная', 'O(log N)'],
          correctAnswer: 0,
          points: 50,
          explanation: 'Операция list.append в CPython выполняется за амортизированное константное время O(1).'
        }
      ]
    }
  };
});

