import { GoogleGenAI } from "@google/genai";
import { Lesson, LessonNotes, LessonSlide, LessonLab, LessonHomework, LessonTest, ConceptCard } from "../types";

export interface CurriculumLessonBlueprint {
  orderNumber: number;
  quarter: number;
  title: string;
  topic: string;
  description: string;
  durationMinutes: number;
  keyConcepts: string[];
}

export function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  try {
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err);
    return null;
  }
}

/**
 * Parses raw text or syllabus content of an annual curriculum into structured lesson blueprints.
 */
export async function parseCurriculumPlan(
  planText: string,
  grade: number = 10,
  subjectName: string = "Информатика и ИКТ",
  customApiKey?: string
): Promise<CurriculumLessonBlueprint[]> {
  const ai = getGeminiClient(customApiKey);

  if (ai) {
    try {
      const prompt = `Ты — ведущий методист по школьной информатике и ИКТ.
Проанализируй текст годового календарно-тематического плана (КТП) или списка тем для ${grade} класса по предмету "${subjectName}".
Текст плана:
"""
${planText.slice(0, 10000)}
"""

Извлеки и структурируй ВСЕ уроки плана в строгий JSON массив объектов.
Каждый объект в массиве должен иметь поля:
- orderNumber: порядковый номер урока (число 1, 2, 3...)
- quarter: четверть (1, 2, 3 или 4, определи по номеру урока или тексту, обычно по ~8-9 уроков на четверть)
- title: четкое название урока (например: "Переменные и базовые типы данных в Python")
- topic: раздел или общая тема (например: "Основы языка Python", "Алгоритмы", "Базы данных", "Сети")
- description: краткое описание урока для ученика (1-2 предложения)
- durationMinutes: продолжительность урока в минутах (обычно 45)
- keyConcepts: массив из 3-5 ключевых понятий (например: ["int", "float", "присваивание", "input()"])

Ответь ТОЛЬКО валидным JSON массивом без разметки markdown и без дополнительного текста.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText = (response.text || "").trim();
      const cleanedJson = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleanedJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, index) => ({
          orderNumber: Number(item.orderNumber) || index + 1,
          quarter: Number(item.quarter) || Math.min(4, Math.floor(index / 9) + 1),
          title: String(item.title || `Урок ${index + 1}`).trim(),
          topic: String(item.topic || subjectName).trim(),
          description: String(item.description || "Изучение теории и выполнение практических заданий.").trim(),
          durationMinutes: Number(item.durationMinutes) || 45,
          keyConcepts: Array.isArray(item.keyConcepts) ? item.keyConcepts.map(String) : [],
        }));
      }
    } catch (error) {
      console.warn("Gemini parse failed or timed out, using fallback parser:", error);
    }
  }

  // Fallback intelligent parser for raw lines or syllabus tables
  return parseCurriculumPlanFallback(planText, grade, subjectName);
}

function parseCurriculumPlanFallback(
  planText: string,
  grade: number,
  subjectName: string
): CurriculumLessonBlueprint[] {
  const lines = planText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 2 && !l.startsWith("#") && !l.toLowerCase().includes("календарно-тематическое"));

  const results: CurriculumLessonBlueprint[] = [];
  let currentQuarter = 1;
  let lessonCounter = 1;

  for (const line of lines) {
    // Detect quarter headers like "1 четверть", "II четверть", "Раздел 1"
    const quarterMatch = line.match(/(?:(\d)|(I{1,3}|IV))\s*(?:четверть|модуль|триместр)/i);
    if (quarterMatch) {
      if (quarterMatch[1]) {
        currentQuarter = Math.min(4, Math.max(1, parseInt(quarterMatch[1], 10)));
      } else if (quarterMatch[2]) {
        const roman = quarterMatch[2].toUpperCase();
        if (roman === "I") currentQuarter = 1;
        else if (roman === "II") currentQuarter = 2;
        else if (roman === "III") currentQuarter = 3;
        else if (roman === "IV") currentQuarter = 4;
      }
      continue;
    }

    // Clean lesson numbering: "1. Введение...", "Урок 2: ...", "2) ...", "Тема 3. ..."
    let cleanTitle = line
      .replace(/^(?:урок|тема|№)?\s*[\d]+[\.\)\:\-]\s*/i, "")
      .replace(/^[\-\*•]\s*/, "")
      .trim();

    // Check if line looks like a table row with tabs or semicolons: "1 \t Тема \t 1 час"
    const parts = line.split(/[\t;|,]/);
    if (parts.length >= 2) {
      const candidate = parts.find((p) => p.trim().length > 5 && !/^\d+$/.test(p.trim()));
      if (candidate) {
        cleanTitle = candidate.trim().replace(/^[\d]+[\.\)]\s*/, "");
      }
    }

    if (cleanTitle.length < 3) continue;

    // Estimate topic category
    let topic = subjectName;
    const lower = cleanTitle.toLowerCase();
    if (lower.includes("python") || lower.includes("функци") || lower.includes("цикл") || lower.includes("переменн")) {
      topic = "Программирование на Python";
    } else if (lower.includes("алгоритм") || lower.includes("стек") || lower.includes("очеред") || lower.includes("граф")) {
      topic = "Алгоритмы и структуры данных";
    } else if (lower.includes("баз") || lower.includes("sql") || lower.includes("таблиц") || lower.includes("excel")) {
      topic = "Базы данных и обработка данных";
    } else if (lower.includes("web") || lower.includes("html") || lower.includes("css") || lower.includes("сайт")) {
      topic = "Web-разработка и интернет-технологии";
    } else if (lower.includes("безопасн") || lower.includes("кибер") || lower.includes("сеть") || lower.includes("интернет")) {
      topic = "Компьютерные сети и безопасность";
    } else if (lower.includes("логик") || lower.includes("высказыван") || lower.includes("таблиц")) {
      topic = "Математическая логика и теория информации";
    }

    results.push({
      orderNumber: lessonCounter,
      quarter: Math.min(4, Math.floor((lessonCounter - 1) / 9) + 1) || currentQuarter,
      title: cleanTitle,
      topic,
      description: `Учебный модуль ${grade} класса: теоретические концепции, решение практических задач и разбор кода по теме «${cleanTitle}».`,
      durationMinutes: 45,
      keyConcepts: extractKeyConcepts(cleanTitle, topic),
    });

    lessonCounter++;
  }

  return results;
}

function extractKeyConcepts(title: string, topic: string): string[] {
  const words = title
    .replace(/[^\wа-яёА-ЯЁ\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["урок", "тема", "введение", "основы", "понятие", "класс"].includes(w.toLowerCase()));
  const concepts = words.slice(0, 4);
  if (concepts.length < 3) {
    concepts.push(topic);
  }
  return concepts;
}

export interface GenerateLessonParams {
  title: string;
  topic?: string;
  grade: number;
  classIds: string[];
  subjectId: string;
  subjectName?: string;
  quarter?: number;
  orderNumber?: number;
  customApiKey?: string;
}

/**
 * Generates comprehensive educational materials (cards, lecture notes, presentation slides,
 * python lab, test, homework) using Gemini or pedagogical fallback.
 */
export async function generateFullLessonMaterials(params: GenerateLessonParams): Promise<Lesson> {
  const {
    title,
    topic = "Информатика",
    grade = 10,
    classIds = ["10C"],
    subjectId = "subj-cs",
    subjectName = "Информатика и ИКТ",
    quarter = 1,
    orderNumber = 1,
    customApiKey,
  } = params;

  const ai = getGeminiClient(customApiKey);

  if (ai) {
    try {
      const prompt = `Ты — заслуженный учитель информатики и методист платформы Smart ICT (Абдугафоров М.Р.).
Сгенерируй полный комплект профессиональных учебных материалов для школьного урока:
- Название урока: "${title}"
- Раздел/Тема: "${topic}"
- Класс: ${grade}
- Предмет: "${subjectName}"

Верни строго валидный JSON объект со следующей точной структурой:
{
  "description": "2-3 содержательных предложения о целях и результатах урока для учащихся ${grade} класса",
  "conceptCards": [
    {
      "id": "card-1",
      "term": "Термин 1",
      "definition": "Понятное строгое определение термина",
      "codeSnippet": "краткий пример кода или формулы если уместно",
      "keyRule": "Главное правило или совет для олимпиады/ЕГЭ"
    },
    {
      "id": "card-2",
      "term": "Термин 2",
      "definition": "Определение",
      "codeSnippet": "пример",
      "keyRule": "совет"
    },
    {
      "id": "card-3",
      "term": "Термин 3",
      "definition": "Определение",
      "codeSnippet": "пример",
      "keyRule": "совет"
    }
  ],
  "notes": {
    "readTimeMinutes": 10,
    "keyTakeaways": [
      "Главный вывод 1",
      "Главный вывод 2",
      "Главный вывод 3"
    ],
    "sections": [
      {
        "title": "1. Введение и актуальность",
        "content": "Подробный разбор теоретического фундамента с объяснением сути явления...",
        "codeExample": null,
        "codeLanguage": null
      },
      {
        "title": "2. Синтаксис и реализация в коде",
        "content": "Пошаговый анализ с разбором каждой строчки кода и типичных подводных камней...",
        "codeExample": "# Полный рабочий пример кода на Python с комментариями\\ndef demo():\\n    pass",
        "codeLanguage": "python"
      },
      {
        "title": "3. Асимптотический анализ и типичные ошибки",
        "content": "Разбор частых ошибок начинающих программистов и рекомендации учителя...",
        "codeExample": null,
        "codeLanguage": null
      }
    ]
  },
  "slides": [
    {
      "slideNumber": 1,
      "title": "${title}",
      "bullets": [
        "Тема урока и практическая значимость",
        "Чему научимся на уроке",
        "Инструменты: Python 3.12, IDE"
      ],
      "codeSnippet": null
    },
    {
      "slideNumber": 2,
      "title": "Ключевые понятия и архитектура",
      "bullets": [
        "Определение базовых терминов",
        "Связь с реальными IT-системами",
        "Правила построения алгоритма"
      ],
      "codeSnippet": null
    },
    {
      "slideNumber": 3,
      "title": "Синтаксис и реализация",
      "bullets": [
        "Базовая конструкция",
        "Обработка граничных случаев",
        "Чистота кода по стандарту PEP8"
      ],
      "codeSnippet": "# Пример синтаксиса\\nx = 10"
    },
    {
      "slideNumber": 4,
      "title": "Практический кейс и оптимизация",
      "bullets": [
        "Сравнение неэффективного и быстрого решений",
        "Оценка времени работы",
        "Паттерны олимпиадного уровня"
      ],
      "codeSnippet": null
    },
    {
      "slideNumber": 5,
      "title": "Итоги и контрольные вопросы",
      "bullets": [
        "Главные выводы занятия",
        "Что повторить к следующему уроку",
        "Чек-лист для домашнего задания"
      ],
      "codeSnippet": null
    }
  ],
  "lab": {
    "title": "Практическая работа: ${title}",
    "instructions": "Четкая пошаговая формулировка задачи для самостоятельного написания кода учеником...",
    "starterCode": "def solve():\\n    # Ваше решение здесь\\n    pass\\n\\nprint(solve())",
    "hint": "Полезная подсказка преподавателя по логике алгоритма",
    "solutionCode": "def solve():\\n    return 'OK'\\n\\nprint(solve())",
    "testCases": [
      { "input": "test_input_1", "expectedOutput": "expected_output_1" },
      { "input": "test_input_2", "expectedOutput": "expected_output_2" }
    ]
  },
  "homework": {
    "title": "Домашнее задание: ${title}",
    "description": "Развернутое домашнее задание с критериями оценивания и творческим заданием повышенной сложности.",
    "deadline": "Через 7 дней к следующему уроку",
    "maxScore": 100,
    "criteria": [
      "Правильность работы алгоритма на всех тестах — 50 баллов",
      "Соблюдение PEP8 и понятные имена переменных — 25 баллов",
      "Оптимальная временная сложность — 25 баллов"
    ]
  },
  "test": {
    "title": "Контрольный тест: ${title}",
    "timeLimitMinutes": 10,
    "rewardXp": 50,
    "questions": [
      {
        "id": "q1",
        "prompt": "Вопрос по проверке базового понимания темы...",
        "type": "single",
        "options": [
          { "id": "a", "text": "Правильный ответ" },
          { "id": "b", "text": "Неверный дистрактор 1" },
          { "id": "c", "text": "Неверный дистрактор 2" },
          { "id": "d", "text": "Неверный дистрактор 3" }
        ],
        "correctOptionIds": ["a"],
        "explanation": "Подробное объяснение, почему именно этот вариант правильный.",
        "points": 25
      },
      {
        "id": "q2",
        "prompt": "Вопрос с фрагментом кода или практической ситуацией...",
        "type": "single",
        "codeSnippet": "print(10 // 3)",
        "options": [
          { "id": "a", "text": "3" },
          { "id": "b", "text": "3.33" },
          { "id": "c", "text": "1" },
          { "id": "d", "text": "0" }
        ],
        "correctOptionIds": ["a"],
        "explanation": "Оператор // выполняет целочисленное деление с отбрасыванием дробной части.",
        "points": 25
      }
    ]
  }
}

Ответь ИСКЛЮЧИТЕЛЬНО валидным JSON объектом без оберток и лишнего текста.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.3,
        },
      });

      const responseText = (response.text || "").trim();
      const cleaned = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      const data = JSON.parse(cleaned);

      const lessonId = `lesson-gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      return assembleLessonObject({
        id: lessonId,
        title,
        topic,
        grade,
        classIds,
        subjectId,
        quarter,
        orderNumber,
        description: data.description || `Учебный урок по теме «${title}».`,
        conceptCards: data.conceptCards || [],
        notes: data.notes || buildDefaultNotes(title, topic),
        slides: (data.slides || []).map((s: any, idx: number) => ({
          id: `slide-${idx + 1}`,
          slideNumber: s.slideNumber || idx + 1,
          title: s.title || `Слайд ${idx + 1}`,
          bullets: Array.isArray(s.bullets) ? s.bullets : ["Ключевой пункт"],
          codeSnippet: s.codeSnippet || undefined,
        })),
        lab: data.lab || buildDefaultLab(title),
        homework: data.homework || buildDefaultHomework(title),
        test: data.test || buildDefaultTest(title),
      });
    } catch (err) {
      console.error("Gemini lesson generation error, falling back to rich curriculum engine:", err);
    }
  }

  // Pedagogically rich fallback generator
  return buildRichFallbackLesson({
    title,
    topic,
    grade,
    classIds,
    subjectId,
    quarter,
    orderNumber,
  });
}

function assembleLessonObject(data: {
  id: string;
  title: string;
  topic: string;
  grade: number;
  classIds: string[];
  subjectId: string;
  quarter: number;
  orderNumber: number;
  description: string;
  conceptCards: ConceptCard[];
  notes: LessonNotes;
  slides: LessonSlide[];
  lab: LessonLab;
  homework: LessonHomework;
  test: LessonTest;
}): Lesson {
  return {
    id: data.id,
    title: data.title,
    topic: data.topic,
    description: data.description,
    grade: data.grade,
    classIds: data.classIds,
    targetClassIds: data.classIds,
    subjectId: data.subjectId,
    quarter: data.quarter,
    orderNumber: data.orderNumber,
    date: new Date().toISOString().split("T")[0],
    durationMinutes: 45,
    published: true,
    conceptCards: data.conceptCards,
    notes: data.notes,
    slides: data.slides,
    lab: data.lab,
    homework: data.homework,
    test: data.test,
    video: {
      title: `Видеоразбор урока: ${data.title}`,
      durationMinutes: 15,
      youtubeUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
      chapters: [
        { time: "00:00", title: "Введение в тему" },
        { time: "03:30", title: "Теоретические концепции" },
        { time: "08:15", title: "Разбор практического примера" },
        { time: "12:40", title: "Итоги и разбор ДЗ" },
      ],
    },
    pdf: {
      title: `Методический конспект: ${data.title}`,
      fileSize: "1.8 МБ",
      pageCount: 8,
      url: "#",
    },
    extraMaterials: [
      {
        id: `ext-1`,
        title: `Официальная документация Python по теме «${data.title}»`,
        type: "doc",
        url: "https://docs.python.org/3/",
        description: "Первоисточник с примерами и стандартами языка.",
      },
      {
        id: `ext-2`,
        title: "Шпаргалка преподавателя по синтаксису и алгоритмам",
        type: "cheat_sheet",
        url: "#",
        description: "Таблица соответствия методов и оценка сложности алгоритмов.",
      },
    ],
    cards: {
      notes: {
        title: `Конспект: ${data.title}`,
        readTimeMinutes: data.notes.readTimeMinutes || 10,
        markdownContent: data.notes.sections.map((s) => `## ${s.title}\n${s.content}\n${s.codeExample ? "```python\n" + s.codeExample + "\n```" : ""}`).join("\n\n"),
      },
      presentation: {
        title: `Презентация: ${data.title}`,
        slides: data.slides.map((s) => ({
          slideNumber: s.slideNumber || 1,
          title: s.title,
          content: s.bullets.join(". "),
          bullets: s.bullets,
          codeSnippet: s.codeSnippet,
        })),
      },
      lab: {
        title: data.lab.title,
        taskDescription: data.lab.instructions,
        initialCode: data.lab.starterCode,
        expectedOutput: data.lab.testCases.map((tc) => tc.expectedOutput).join("\n"),
        hints: [data.lab.hint || "Внимательно проверьте граничные условия и типы данных."],
        solutionCode: data.lab.solutionCode,
      },
      homework: {
        title: data.homework.title,
        taskDescription: data.homework.description,
        deadline: data.homework.deadline,
        maxScore: data.homework.maxScore,
        criteria: data.homework.criteria,
      },
    },
  };
}

function buildDefaultNotes(title: string, topic: string): LessonNotes {
  return {
    readTimeMinutes: 10,
    keyTakeaways: [
      `Понимание фундаментальных принципов по теме «${title}».`,
      "Умение проектировать чистый и эффективный программный код.",
      "Навык обнаружения и исправления типичных алгоритмических ошибок.",
    ],
    sections: [
      {
        title: "1. Теоретические основы",
        content: `Тема «${title}» является ключевым элементом в курсе «${topic}». На этом занятии мы изучаем базовые определения, структуру данных и механизмы решения типовых задач.`,
      },
      {
        title: "2. Программная реализация",
        content: "Рассмотрим типовой шаблон реализации на языке Python. Обратите внимание на организацию логических блоков и именование переменных:",
        codeExample: `# Реализация по теме: ${title}\ndef execute_task(data):\n    result = []\n    for item in data:\n        if item is not None:\n            result.append(item)\n    return result\n\nprint(execute_task([1, 2, 3]))`,
        codeLanguage: "python",
      },
      {
        title: "3. Практические рекомендации и нюансы",
        content: "При решении экзаменационных и олимпиадных задач всегда проверяйте граничные случаи: пустой ввод, отрицательные числа, максимальные допустимые значения.",
      },
    ],
  };
}

function buildDefaultLab(title: string): LessonLab {
  return {
    title: `Лабораторная работа: ${title}`,
    instructions: `Напишите программу на Python для решения практической задачи по теме «${title}». Программа должна корректно обрабатывать входные данные и возвращать требуемый результат.`,
    starterCode: `def solve():\n    # Напишите ваше решение здесь\n    pass\n\n# Проверка:\nprint(solve())`,
    hint: "Используйте встроенные методы Python и следите за отступами (4 пробела).",
    solutionCode: `def solve():\n    return "Решение выполнено корректно"\n\nprint(solve())`,
    testCases: [
      { input: "Тест 1", expectedOutput: "Решение выполнено корректно" },
    ],
  };
}

function buildDefaultHomework(title: string): LessonHomework {
  return {
    title: `Домашнее задание: ${title}`,
    description: `Выполните программное задание по теме «${title}». Напишите и протестируйте скрипт, оформите решение с комментариями и прикрепите файл .py или текстовый отчет.`,
    deadline: "Через 7 дней",
    maxScore: 100,
    criteria: [
      "Работоспособность алгоритма — 50 баллов",
      "Читаемость и стиль кода PEP8 — 30 баллов",
      "Оптимальность решения — 20 баллов",
    ],
  };
}

function buildDefaultTest(title: string): LessonTest {
  return {
    title: `Тестирование по теме: ${title}`,
    timeLimitMinutes: 10,
    rewardXp: 50,
    questions: [
      {
        id: "q-1",
        prompt: `Какова основная цель изучения темы «${title}»?`,
        type: "single",
        options: [
          { id: "a", text: "Освоение эффективных алгоритмических конструкций и чистого кода" },
          { id: "b", text: "Исключительно механическое заучивание синтаксиса" },
          { id: "c", text: "Отключение оптимизации компилятора" },
        ],
        correctOptionIds: ["a"],
        explanation: "Курс направлен на выработку глубокого алгоритмического мышления и практических навыков разработки.",
        points: 25,
      },
      {
        id: "q-2",
        prompt: "Что возвращает логическое выражение 5 > 3 and 2 < 4 в Python?",
        type: "single",
        options: [
          { id: "a", text: "True" },
          { id: "b", text: "False" },
          { id: "c", text: "None" },
        ],
        correctOptionIds: ["a"],
        explanation: "Оба операнда истины, поэтому оператор and возвращает True.",
        points: 25,
      },
    ],
  };
}

function buildRichFallbackLesson(params: {
  title: string;
  topic: string;
  grade: number;
  classIds: string[];
  subjectId: string;
  quarter: number;
  orderNumber: number;
}): Lesson {
  const { title, topic, grade, classIds, subjectId, quarter, orderNumber } = params;
  const lessonId = `lesson-curriculum-${Date.now()}-${orderNumber}`;

  const conceptCards: ConceptCard[] = [
    {
      id: "cc-1",
      term: "Базовая парадигма",
      definition: `Ключевой фундаментальный принцип построения решений по теме «${title}».`,
      codeSnippet: `# Парадигма решения\nx = 42`,
      keyRule: "Соблюдайте модульность и отделяйте логику вычислений от ввода/вывода.",
    },
    {
      id: "cc-2",
      term: "Временная сложность",
      definition: "Характеристика масштабируемости алгоритма при росте входных данных N.",
      codeSnippet: `# Сложность O(N)\nfor item in collection:\n    process(item)`,
      keyRule: "Стремитесь избегать вложенных циклов O(N²) на массивах свыше 10 000 элементов.",
    },
    {
      id: "cc-3",
      term: "Граничные условия",
      definition: "Экстремальные или нетипичные входные параметры (пустой список, 0, отрицательные числа).",
      codeSnippet: `if not data:\n    return None`,
      keyRule: "Всегда валидируйте входные данные в начале функции (Guard Clause).",
    },
  ];

  const slides: LessonSlide[] = [
    {
      id: "s-1",
      slideNumber: 1,
      title: `${title}`,
      bullets: [
        `Курс информатики и ИКТ для ${grade} класса`,
        `Раздел: ${topic}`,
        "Цель: освоить теоретический фундамент и создать практическое решение на Python",
      ],
    },
    {
      id: "s-2",
      slideNumber: 2,
      title: "Основные понятия и формулы",
      bullets: [
        "Определение ключевых структур и терминов",
        "Взаимосвязь с памятью и процессором",
        "Почему это важно для профессионального разработчика",
      ],
      codeSnippet: `# Концептуальный блок\nvalue = initialize_resource()`,
    },
    {
      id: "s-3",
      slideNumber: 3,
      title: "Практическая реализация на Python",
      bullets: [
        "Пошаговый синтаксис",
        "Работа со встроенными коллекциями и типами",
        "Стандарты оформления кода PEP8",
      ],
      codeSnippet: `def solve_problem(n: int) -> int:\n    # Вычисление результата\n    return n * 2`,
    },
    {
      id: "s-4",
      slideNumber: 4,
      title: "Разбор частых ошибок и крайних случаев",
      bullets: [
        "Ошибки индексации (IndexError)",
        "Несовпадение типов (TypeError)",
        "Оптимизация по скорости и расходу оперативной памяти",
      ],
    },
    {
      id: "s-5",
      slideNumber: 5,
      title: "Итоги занятия & Вопросы",
      bullets: [
        "Что мы узнали и закрепили на практике",
        "Домашнее задание и критерии на 100 баллов",
        "Тестирование знаний в интерактивном модуле",
      ],
    },
  ];

  return assembleLessonObject({
    id: lessonId,
    title,
    topic,
    grade,
    classIds,
    subjectId,
    quarter,
    orderNumber,
    description: `Образовательный модуль ${grade} класса по теме «${title}». Включает интерактивные карточки терминов, конспект с разбором кода, слайды презентации, практическую лабу и тест.`,
    conceptCards,
    notes: buildDefaultNotes(title, topic),
    slides,
    lab: buildDefaultLab(title),
    homework: buildDefaultHomework(title),
    test: buildDefaultTest(title),
  });
}

/**
 * Uses Gemini AI to review a list of lesson titles and intelligently distribute them
 * into 4 quarters with pedagogical logic (foundations -> intermediate -> advanced -> synthesis).
 */
export async function distributeCurriculumWithAI(params: {
  lessons: { title: string; topic?: string; hours?: number }[];
  grade: number;
  subjectName: string;
  customApiKey?: string;
}): Promise<{ orderNumber: number; quarter: number; title: string; topic: string }[]> {
  const { lessons, grade, subjectName, customApiKey } = params;
  const ai = getGeminiClient(customApiKey);

  if (ai && lessons.length > 0) {
    try {
      const titlesList = lessons.map((l, i) => `${i + 1}. ${l.title} (Раздел: ${l.topic || subjectName})`).join("\n");
      const prompt = `Ты — ведущий методист-эксперт школьного образования.
Перед тобой список из ${lessons.length} уроков по предмету "${subjectName}" для ${grade} класса:
${titlesList}

Задача:
Методически грамотно распредели эти уроки по 4 учебным четвертям (1, 2, 3 и 4 четверти):
- 1 четверть (сентябрь-октябрь, ~25% уроков): вводные темы, базовый синтаксис, техника безопасности, повторение.
- 2 четверть (ноябрь-декабрь, ~22% уроков): углубление тем, алгоритмические конструкции, функции.
- 3 четверть (январь-март, ~30% уроков, самая длинная): сложные структуры, ООП, алгоритмы, практические работы.
- 4 четверть (апрель-май, ~23% уроков): прикладные модули, базы данных, сети, защита курсовых проектов и итоговая аттестация.

Верни ТОЛЬКО валидный JSON массив объектов следующего вида:
[
  { "orderNumber": 1, "quarter": 1, "title": "...", "topic": "..." }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const responseText = (response.text || "").trim();
      const cleaned = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          orderNumber: Number(item.orderNumber) || idx + 1,
          quarter: Number(item.quarter) >= 1 && Number(item.quarter) <= 4 ? Number(item.quarter) : Math.min(4, Math.floor(idx / 9) + 1),
          title: String(item.title || lessons[idx]?.title || `Урок ${idx + 1}`),
          topic: String(item.topic || lessons[idx]?.topic || subjectName),
        }));
      }
    } catch (err) {
      console.warn("AI distribution failed, using algorithmic fallback:", err);
    }
  }

  // Algorithmic proportional distribution
  const total = lessons.length;
  const q1 = Math.max(1, Math.round(total * 0.26));
  const q2 = Math.max(1, Math.round(total * 0.22));
  const q3 = Math.max(1, Math.round(total * 0.30));

  return lessons.map((l, idx) => {
    let q = 1;
    if (idx < q1) q = 1;
    else if (idx < q1 + q2) q = 2;
    else if (idx < q1 + q2 + q3) q = 3;
    else q = 4;

    return {
      orderNumber: idx + 1,
      quarter: q,
      title: l.title,
      topic: l.topic || subjectName,
    };
  });
}

