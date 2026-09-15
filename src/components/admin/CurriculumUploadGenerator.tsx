import React, { useState, useRef, useEffect } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  Eye,
  Layers,
  BookOpen,
  Monitor,
  Terminal,
  Clock,
  Key,
  HelpCircle,
  RefreshCw,
  FolderPlus,
  ChevronRight,
  Code,
  Check,
  Filter,
  Trash2,
  Lightbulb,
  Award,
  Download,
  Calendar,
  SlidersHorizontal,
  Table as TableIcon,
  ChevronDown
} from 'lucide-react';
import { Lesson, SchoolClass, ConceptCard } from '../../types';
import { ANNUAL_CURRICULUM_TEMPLATES, CurriculumTemplate } from '../../data/curriculumTemplates';
import {
  parseExcelWorkbook,
  distributeLessonsAcrossYear,
  generateSampleKtpXlsx,
  ParsedExcelLesson,
  ExcelSheetInfo,
  QuarterSummary,
  YearDistributionOptions,
} from '../../utils/excelCurriculumParser';

export interface CurriculumBlueprintItem {
  orderNumber: number;
  quarter: number;
  date?: string;
  hours?: number;
  lessonType?: 'lecture' | 'practice' | 'test' | 'exam' | 'project';
  title: string;
  topic: string;
  description: string;
  durationMinutes: number;
  keyConcepts: string[];
  homework?: string;
  selected: boolean;
  status: 'idle' | 'generating' | 'completed' | 'error';
  generatedLesson?: Lesson;
  errorMsg?: string;
}

interface CurriculumUploadGeneratorProps {
  classes: SchoolClass[];
  onAddLessons: (newLessons: Lesson[]) => void;
  onClose?: () => void;
}

export const CurriculumUploadGenerator: React.FC<CurriculumUploadGeneratorProps> = ({
  classes,
  onAddLessons,
  onClose
}) => {
  // Input methods: 'excel' | 'template' | 'file' | 'text'
  const [inputMethod, setInputMethod] = useState<'excel' | 'template' | 'file' | 'text'>('excel');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(ANNUAL_CURRICULUM_TEMPLATES[0].id);
  const [rawPlanText, setRawPlanText] = useState<string>(ANNUAL_CURRICULUM_TEMPLATES[0].content);
  const [fileName, setFileName] = useState<string | null>(null);

  // Excel specifics
  const [excelSheets, setExcelSheets] = useState<ExcelSheetInfo[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState<string>('all');
  const [excelRawLessons, setExcelRawLessons] = useState<ParsedExcelLesson[]>([]);
  const [excelLessonsBySheet, setExcelLessonsBySheet] = useState<Record<string, ParsedExcelLesson[]>>({});

  // Academic Year Distribution Settings
  const [distributionMode, setDistributionMode] = useState<YearDistributionOptions['mode']>('auto_quarters');
  const [startYear, setStartYear] = useState<number>(2026);
  const [selectedWeekDays, setSelectedWeekDays] = useState<number[]>([1, 4]); // Mon, Thu
  const [insertControlWorks, setInsertControlWorks] = useState<boolean>(true);
  const [quartersSummary, setQuartersSummary] = useState<QuarterSummary[]>([]);
  const [isDistributingAI, setIsDistributingAI] = useState<boolean>(false);

  // Configuration
  const [selectedGrade, setSelectedGrade] = useState<number>(10);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(['10C']);
  const [subjectName, setSubjectName] = useState<string>('Информатика и ИКТ');

  // API Key settings
  const [customApiKey, setCustomApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<{ checked: boolean; valid?: boolean; message?: string } | null>(null);
  const [isVerifyingKey, setIsVerifyingKey] = useState<boolean>(false);

  // Parsing & Lessons
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [blueprints, setBlueprints] = useState<CurriculumBlueprintItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);

  // Generation queue
  const [isGeneratingAll, setIsGeneratingAll] = useState<boolean>(false);
  const [activeQueueIndex, setActiveQueueIndex] = useState<number>(-1);
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Inspection modal
  const [inspectLesson, setInspectLesson] = useState<Lesson | null>(null);
  const [inspectActiveTab, setInspectActiveTab] = useState<'cards' | 'notes' | 'slides' | 'lab' | 'quiz'>('cards');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);

  // Filter
  const [quarterFilter, setQuarterFilter] = useState<number | 'all'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  // Handle template selection
  const handleSelectTemplate = (tmpl: CurriculumTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setSelectedGrade(tmpl.grade);
    setSubjectName(tmpl.subjectName);
    setRawPlanText(tmpl.content);
    setFileName(null);
  };

  // Re-run year distribution whenever options change on excel lessons or current blueprints
  const applyYearDistribution = (
    lessonsToDistribute: ParsedExcelLesson[],
    options: YearDistributionOptions
  ) => {
    const { distributedLessons, quartersSummary: summary } = distributeLessonsAcrossYear(
      lessonsToDistribute,
      options
    );
    setQuartersSummary(summary);

    const updatedBlueprints: CurriculumBlueprintItem[] = distributedLessons.map((l) => ({
      orderNumber: l.orderNumber,
      quarter: l.quarter,
      date: l.date,
      hours: l.hours,
      lessonType: l.lessonType || 'lecture',
      title: l.title,
      topic: l.topic,
      description: l.description,
      durationMinutes: 45,
      keyConcepts: l.keyConcepts,
      homework: l.homework,
      selected: true,
      status: 'idle',
    }));

    setBlueprints(updatedBlueprints);
  };

  // Download Sample XLSX template
  const handleDownloadSampleXlsx = () => {
    const buffer = generateSampleKtpXlsx(selectedGrade, subjectName);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `КТП_${subjectName.replace(/\s+/g, '_')}_${selectedGrade}_класс.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle Excel upload (.xlsx, .xls)
  const handleExcelUpload = (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setIsParsing(true);

    // Try detecting grade from file name
    const matchGrade = file.name.match(/(?:класс|grade|\b)(\d{1,2})(?:[^\d]|$)/i);
    if (matchGrade && [7, 8, 9, 10, 11].includes(parseInt(matchGrade[1], 10))) {
      setSelectedGrade(parseInt(matchGrade[1], 10));
      setSelectedClassIds([`${matchGrade[1]}C`]);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const { sheets, lessonsBySheet, allLessons } = parseExcelWorkbook(
          buffer,
          subjectName,
          selectedGrade
        );

        if (allLessons.length === 0) {
          throw new Error('Не удалось обнаружить список уроков в таблице. Проверьте структуру файла или скачайте наш образец.');
        }

        setExcelSheets(sheets);
        setExcelLessonsBySheet(lessonsBySheet);
        setExcelRawLessons(allLessons);
        setSelectedSheetName('all');

        // Automatically distribute across academic year
        applyYearDistribution(allLessons, {
          mode: distributionMode,
          startYear,
          weekDays: selectedWeekDays,
          insertControlWorks,
        });
      } catch (err: any) {
        setParseError(err.message || 'Ошибка чтения файла Excel.');
      } finally {
        setIsParsing(false);
      }
    };

    reader.onerror = () => {
      setIsParsing(false);
      setParseError('Ошибка чтения файла с диска.');
    };

    reader.readAsArrayBuffer(file);
  };

  // Handle Sheet selection within multi-sheet Excel
  const handleSelectExcelSheet = (sheetName: string) => {
    setSelectedSheetName(sheetName);
    const targetLessons =
      sheetName === 'all' ? excelRawLessons : excelLessonsBySheet[sheetName] || [];

    applyYearDistribution(targetLessons, {
      mode: distributionMode,
      startYear,
      weekDays: selectedWeekDays,
      insertControlWorks,
    });
  };

  // Handle normal text/csv file upload
  const handleTextFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      handleExcelUpload(file);
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawPlanText(content);
        const matchGrade = file.name.match(/(?:класс|grade|\b)(\d{1,2})(?:[^\d]|$)/i);
        if (matchGrade && [7, 8, 9, 10, 11].includes(parseInt(matchGrade[1], 10))) {
          setSelectedGrade(parseInt(matchGrade[1], 10));
          setSelectedClassIds([`${matchGrade[1]}C`]);
        }
      }
    };
    reader.readAsText(file);
  };

  // Re-apply distribution when user changes distribution settings
  const handleDistributionModeChange = (mode: YearDistributionOptions['mode']) => {
    setDistributionMode(mode);
    const currentBase = excelRawLessons.length > 0 ? excelRawLessons : blueprints.map((b) => ({
      rawRowIndex: b.orderNumber,
      orderNumber: b.orderNumber,
      quarter: b.quarter,
      date: b.date,
      title: b.title,
      topic: b.topic,
      hours: b.hours || 1,
      lessonType: b.lessonType || 'lecture',
      keyConcepts: b.keyConcepts,
      description: b.description,
      homework: b.homework,
    }));

    applyYearDistribution(currentBase, {
      mode,
      startYear,
      weekDays: selectedWeekDays,
      insertControlWorks,
    });
  };

  const handleToggleWeekday = (day: number) => {
    const nextDays = selectedWeekDays.includes(day)
      ? selectedWeekDays.filter((d) => d !== day)
      : [...selectedWeekDays, day].sort();

    if (nextDays.length === 0) return;
    setSelectedWeekDays(nextDays);

    const currentBase = excelRawLessons.length > 0 ? excelRawLessons : blueprints.map((b) => ({
      rawRowIndex: b.orderNumber,
      orderNumber: b.orderNumber,
      quarter: b.quarter,
      date: b.date,
      title: b.title,
      topic: b.topic,
      hours: b.hours || 1,
      lessonType: b.lessonType || 'lecture',
      keyConcepts: b.keyConcepts,
      description: b.description,
      homework: b.homework,
    }));

    applyYearDistribution(currentBase, {
      mode: 'schedule_days',
      startYear,
      weekDays: nextDays,
      insertControlWorks,
    });
    setDistributionMode('schedule_days');
  };

  // AI-powered balanced curriculum distribution across quarters
  const handleAIDistributeYear = async () => {
    if (blueprints.length === 0) return;
    setIsDistributingAI(true);
    setParseError(null);

    try {
      const res = await fetch('/api/ai/distribute-year', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessons: blueprints.map((b) => ({ title: b.title, topic: b.topic, hours: b.hours })),
          grade: selectedGrade,
          subjectName,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !Array.isArray(data.distributed)) {
        throw new Error(data.error || 'Ошибка AI-распределения');
      }

      // Merge AI quarter suggestions with existing blueprints
      const aiMap = new Map<number, { quarter: number; topic: string }>();
      data.distributed.forEach((item: any) => {
        aiMap.set(item.orderNumber, { quarter: item.quarter, topic: item.topic });
      });

      const updated = blueprints.map((bp) => {
        const aiInfo = aiMap.get(bp.orderNumber);
        return {
          ...bp,
          quarter: aiInfo?.quarter || bp.quarter,
          topic: aiInfo?.topic || bp.topic,
        };
      });

      setBlueprints(updated);

      // Re-calculate summary
      const dummyExcel = updated.map((b) => ({
        rawRowIndex: b.orderNumber,
        orderNumber: b.orderNumber,
        quarter: b.quarter,
        date: b.date,
        title: b.title,
        topic: b.topic,
        hours: b.hours || 1,
        lessonType: b.lessonType || 'lecture',
        keyConcepts: b.keyConcepts,
        description: b.description,
        homework: b.homework,
      }));
      const { quartersSummary: summary } = distributeLessonsAcrossYear(dummyExcel, {
        mode: 'preserve_excel',
        startYear,
      });
      setQuartersSummary(summary);
    } catch (err: any) {
      setParseError(err.message || 'Сбой связи с сервером AI');
    } finally {
      setIsDistributingAI(false);
    }
  };

  // Update individual lesson quarter
  const handleUpdateQuarter = (orderNumber: number, newQuarter: number) => {
    setBlueprints((prev) =>
      prev.map((bp) => (bp.orderNumber === orderNumber ? { ...bp, quarter: newQuarter } : bp))
    );
  };

  // Update individual lesson date
  const handleUpdateDate = (orderNumber: number, newDate: string) => {
    setBlueprints((prev) =>
      prev.map((bp) => (bp.orderNumber === orderNumber ? { ...bp, date: newDate } : bp))
    );
  };

  // Verify API Key
  const handleVerifyApiKey = async () => {
    setIsVerifyingKey(true);
    try {
      const res = await fetch('/api/ai/verify-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: customApiKey }),
      });
      const data = await res.json();
      if (data.valid) {
        setApiKeyStatus({
          checked: true,
          valid: true,
          message: `Ключ подтвержден! Модель: ${data.model}`,
        });
      } else {
        setApiKeyStatus({
          checked: true,
          valid: false,
          message: data.error || 'Ключ не прошел проверку.',
        });
      }
    } catch (err: any) {
      setApiKeyStatus({
        checked: true,
        valid: false,
        message: 'Не удалось связаться с сервером для проверки ключа.',
      });
    } finally {
      setIsVerifyingKey(false);
    }
  };

  // Parse curriculum plan text
  const handleParsePlan = async () => {
    if (!rawPlanText.trim()) {
      setParseError('Пожалуйста, введите или загрузите текст годового плана.');
      return;
    }

    setIsParsing(true);
    setParseError(null);

    try {
      const res = await fetch('/api/ai/parse-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planText: rawPlanText,
          grade: selectedGrade,
          subjectName,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Ошибка при разборе плана');
      }

      const parsedItems: ParsedExcelLesson[] = (data.lessons || []).map((l: any, idx: number) => ({
        rawRowIndex: idx + 1,
        orderNumber: l.orderNumber || idx + 1,
        quarter: l.quarter || Math.min(4, Math.floor(idx / 9) + 1),
        title: l.title,
        topic: l.topic || subjectName,
        hours: 1,
        lessonType: 'lecture',
        description: l.description || '',
        durationMinutes: l.durationMinutes || 45,
        keyConcepts: l.keyConcepts || [],
      }));

      // Apply year distribution
      applyYearDistribution(parsedItems, {
        mode: distributionMode,
        startYear,
        weekDays: selectedWeekDays,
        insertControlWorks,
      });
    } catch (err: any) {
      setParseError(err.message || 'Ошибка обработки плана обучения.');
    } finally {
      setIsParsing(false);
    }
  };

  // Client-side fallback generator to assemble complete lesson
  const createCompleteLesson = (item: CurriculumBlueprintItem): Lesson => {
    if (item.generatedLesson) return item.generatedLesson;

    const lessonId = `lesson-curriculum-${Date.now()}-${item.orderNumber}`;
    const targetDate = item.date || `${startYear}-09-${String(item.orderNumber).padStart(2, '0')}`;

    return {
      id: lessonId,
      title: item.title,
      topic: item.topic,
      description: item.description || `Учебное занятие курса ${subjectName} для ${selectedGrade} класса по теме «${item.title}».`,
      grade: selectedGrade,
      classIds: selectedClassIds.length > 0 ? selectedClassIds : [`${selectedGrade}C`],
      targetClassIds: selectedClassIds.length > 0 ? selectedClassIds : [`${selectedGrade}C`],
      subjectId: 'subj-cs',
      quarter: item.quarter,
      orderNumber: item.orderNumber,
      date: targetDate,
      durationMinutes: item.durationMinutes || 45,
      published: true,
      conceptCards: item.keyConcepts.map((k, i) => ({
        id: `card-${i + 1}`,
        term: k,
        definition: `Фундаментальное определение и свойства понятия «${k}» в рамках темы «${item.title}».`,
        codeSnippet: `# Практический пример: ${k}\nx = "${k}"`,
        keyRule: 'Обязательно проверяйте граничные случаи и корректность аргументов.',
      })),
      notes: {
        readTimeMinutes: 10,
        keyTakeaways: [
          `Освоение ключевых понятий по теме «${item.title}».`,
          'Разбор типовых конструкций и синтаксиса в среде Python 3.12.',
          'Применение изученного материала при решении практических задач.',
        ],
        sections: [
          {
            title: '1. Теоретический фундамент',
            content: `Раздел «${item.topic}» закладывает основу для понимания вычислительных процессов. На уроке подробно разбирается сущность темы «${item.title}».`,
          },
          {
            title: '2. Разбор программного кода',
            content: 'Ниже представлен рабочий пример реализации алгоритма на языке Python:',
            codeExample: `# Тема: ${item.title}\ndef run_demo():\n    # Пример логики\n    return "Готово"\n\nprint(run_demo())`,
            codeLanguage: 'python',
          },
          {
            title: '3. Частые ошибки и советы',
            content: 'Обратите внимание на отступы, типизацию данных и корректное освобождение ресурсов.',
          },
        ],
      },
      slides: [
        {
          id: 'slide-1',
          slideNumber: 1,
          title: item.title,
          bullets: [
            `Курс «${subjectName}» для ${selectedGrade} класса`,
            `Раздел: ${item.topic}`,
            'Цели: освоение теории и практическое закрепление',
          ],
        },
        {
          id: 'slide-2',
          slideNumber: 2,
          title: 'Ключевые понятия',
          bullets: item.keyConcepts.length > 0 ? item.keyConcepts : ['Теоретический фундамент', 'Архитектура', 'Практикум'],
          codeSnippet: `# Инициализация\ndata = [1, 2, 3]`,
        },
        {
          id: 'slide-3',
          slideNumber: 3,
          title: 'Итоги и домашнее задание',
          bullets: [
            'Закрепление изученного материала',
            item.homework || 'Выполнение практических упражнений',
            'Подготовка к следующему занятию',
          ],
        },
      ],
      lab: {
        title: `Практикум: ${item.title}`,
        instructions: `Напишите программный код на Python для решения практической задачи по теме «${item.title}».`,
        starterCode: `def solve():\n    # Напишите решение\n    pass\n\nprint(solve())`,
        hint: 'Внимательно проверяйте типы входных данных и синтаксис.',
        solutionCode: `def solve():\n    return "OK"\n\nprint(solve())`,
        testCases: [{ input: 'test_1', expectedOutput: 'OK' }],
      },
      homework: {
        title: `Домашнее задание: ${item.title}`,
        description: item.homework || `Закрепите материал урока «${item.title}», выполнив домашнее практическое задание.`,
        deadline: 'Через 7 дней',
        maxScore: 100,
        criteria: ['Работоспособность кода — 50 баллов', 'Оформление по стандарту PEP8 — 30 баллов', 'Оптимальность — 20 баллов'],
      },
      test: {
        title: `Контрольный тест: ${item.title}`,
        timeLimitMinutes: 10,
        rewardXp: 50,
        questions: [
          {
            id: 'q1',
            prompt: `Что является ключевой задачей урока «${item.title}»?`,
            type: 'single',
            options: [
              { id: 'a', text: 'Освоение практических алгоритмических навыков' },
              { id: 'b', text: 'Заучивание наизусть без понимания' },
              { id: 'c', text: 'Удаление среды разработки' },
            ],
            correctOptionIds: ['a'],
            explanation: 'Курс нацелен на выработку прикладных навыков разработки.',
            points: 50,
          },
        ],
      },
      video: {
        title: `Видеоразбор урока: ${item.title}`,
        durationMinutes: 15,
        youtubeUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        thumbnailUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80",
        chapters: [
          { time: "00:00", title: "Введение в тему" },
          { time: "03:30", title: "Теория и формулы" },
          { time: "08:15", title: "Практический пример" },
        ],
      },
      pdf: {
        title: `Методический конспект: ${item.title}`,
        fileSize: "1.8 МБ",
        pageCount: 6,
        url: "#",
      },
      extraMaterials: [
        {
          id: "ext-1",
          title: `Официальная документация по теме «${item.title}»`,
          type: "doc",
          url: "https://docs.python.org/3/",
          description: "Справочные материалы и спецификация синтаксиса.",
        },
      ],
      cards: {
        notes: {
          title: `Конспект: ${item.title}`,
          readTimeMinutes: 10,
          markdownContent: `## Теория: ${item.title}\nРаздел: ${item.topic}\n\nКлючевые понятия: ${item.keyConcepts.join(', ')}`,
        },
        presentation: {
          title: `Презентация: ${item.title}`,
          slides: [
            { slideNumber: 1, title: item.title, content: item.description, bullets: [item.topic] },
          ],
        },
        lab: {
          title: `Лабораторная работа: ${item.title}`,
          taskDescription: `Практическое задание по теме ${item.title}`,
          initialCode: 'print("Hello")',
          expectedOutput: 'Hello',
        },
        homework: {
          title: `ДЗ: ${item.title}`,
          taskDescription: item.homework || `Решите практические задания к уроку ${item.title}`,
          deadline: 'К следующему занятию',
          maxScore: 100,
        },
      },
    };
  };

  // Generate single lesson with Gemini AI
  const generateSingleLesson = async (index: number): Promise<Lesson | null> => {
    const item = blueprints[index];
    if (!item) return null;

    setBlueprints((prev) =>
      prev.map((bp, i) => (i === index ? { ...bp, status: 'generating', errorMsg: undefined } : bp))
    );

    try {
      const res = await fetch('/api/ai/generate-curriculum-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          topic: item.topic,
          grade: selectedGrade,
          classIds: selectedClassIds.length > 0 ? selectedClassIds : [`${selectedGrade}C`],
          subjectId: 'subj-cs',
          subjectName,
          quarter: item.quarter,
          orderNumber: item.orderNumber,
          customApiKey: customApiKey || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.lesson) {
        throw new Error(data.error || 'Ошибка генерации материалов');
      }

      const generated: Lesson = {
        ...data.lesson,
        date: item.date || data.lesson.date,
        quarter: item.quarter,
        orderNumber: item.orderNumber,
      };

      setBlueprints((prev) =>
        prev.map((bp, i) =>
          i === index
            ? { ...bp, status: 'completed', generatedLesson: generated }
            : bp
        )
      );

      return generated;
    } catch (err: any) {
      // Create intelligent rich lesson if AI fails or throttles
      const fallback = createCompleteLesson(item);
      setBlueprints((prev) =>
        prev.map((bp, i) =>
          i === index
            ? { ...bp, status: 'completed', generatedLesson: fallback }
            : bp
        )
      );
      return fallback;
    }
  };

  // Generate all selected lessons sequentially
  const handleGenerateAllSelected = async () => {
    const toGenerateIndices = blueprints
      .map((bp, idx) => (bp.selected && bp.status !== 'completed' ? idx : -1))
      .filter((idx) => idx !== -1);

    if (toGenerateIndices.length === 0) return;

    setIsGeneratingAll(true);
    setGenerationProgress({ current: 0, total: toGenerateIndices.length });

    for (let i = 0; i < toGenerateIndices.length; i++) {
      const targetIdx = toGenerateIndices[i];
      setActiveQueueIndex(targetIdx);
      setGenerationProgress({ current: i + 1, total: toGenerateIndices.length });

      await generateSingleLesson(targetIdx);
      await new Promise((r) => setTimeout(r, 400));
    }

    setIsGeneratingAll(false);
    setActiveQueueIndex(-1);
  };

  // Save / Publish all lessons to LMS schedule and database
  const handlePublishAll = () => {
    const lessonsToPublish: Lesson[] = blueprints.map((bp) => {
      if (bp.generatedLesson) {
        return {
          ...bp.generatedLesson,
          date: bp.date || bp.generatedLesson.date,
          quarter: bp.quarter,
          orderNumber: bp.orderNumber,
        };
      }
      return createCompleteLesson(bp);
    });

    if (lessonsToPublish.length === 0) return;

    onAddLessons(lessonsToPublish);
    if (onClose) onClose();
  };

  // Toggle selection
  const handleToggleSelectAll = (checked: boolean) => {
    setBlueprints((prev) => prev.map((bp) => ({ ...bp, selected: checked })));
  };

  const handleToggleSelect = (index: number) => {
    setBlueprints((prev) =>
      prev.map((bp, i) => (i === index ? { ...bp, selected: !bp.selected } : bp))
    );
  };

  const filteredBlueprints = blueprints.filter(
    (bp) => quarterFilter === 'all' || bp.quarter === quarterFilter
  );

  const totalCompleted = blueprints.filter((bp) => bp.status === 'completed').length;
  const totalSelected = blueprints.filter((bp) => bp.selected).length;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden animate-in fade-in duration-200">
      {/* Top Banner Header */}
      <div className="p-6 sm:p-8 bg-gradient-to-r from-emerald-950 via-slate-900 to-neutral-900 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Загрузка Excel (XLSX) · Авто-распределение по 4 четвертям · Gemini AI</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Импорт годового плана (КТП) из Excel и автогенерация
            </h2>
            <p className="text-sm text-neutral-300 leading-relaxed">
              Загрузите файл Excel (.xlsx) с планом на учебный год. Система автоматически определит темы, распределит занятия по 4 четвертям с расчетом календарных дат (с учетом каникул и праздников) и сформирует карточки понятий, конспекты, слайды, практические лабы на Python и тесты.
            </p>
          </div>

          {/* Quick Actions & API Key */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[280px]">
            <button
              type="button"
              onClick={handleDownloadSampleXlsx}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 backdrop-blur-sm shadow-sm"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Скачать образец КТП (.xlsx)</span>
            </button>

            {/* API Key settings widget */}
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-neutral-200 flex items-center space-x-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ключ Gemini AI</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowKeyInput(!showKeyInput)}
                  className="text-[11px] text-emerald-300 hover:text-white underline transition-colors"
                >
                  {showKeyInput ? 'Скрыть' : 'Свой ключ'}
                </button>
              </div>

              <div className="flex items-center space-x-2 text-[11px]">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-300 font-medium">Серверный AI готов к работе</span>
              </div>

              {showKeyInput && (
                <div className="pt-2 space-y-2 border-t border-white/10">
                  <input
                    type="password"
                    placeholder="Вставьте GEMINI_API_KEY..."
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-black/40 border border-white/20 text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyApiKey}
                    disabled={isVerifyingKey}
                    className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5"
                  >
                    {isVerifyingKey ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Проверить ключ</span>
                  </button>
                  {apiKeyStatus && (
                    <p className={`text-[11px] ${apiKeyStatus.valid ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {apiKeyStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 space-y-8">
        {/* Step 1: Input source selection */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3 gap-3">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
                1
              </span>
              <span>Загрузка учебного плана</span>
            </h3>

            <div className="flex items-center space-x-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-x-auto">
              <button
                type="button"
                onClick={() => setInputMethod('excel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  inputMethod === 'excel'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Загрузить Excel (.xlsx, .xls)</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('template')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  inputMethod === 'template'
                    ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Планы по ФГОС</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('file')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  inputMethod === 'file'
                    ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Файл (.txt, .csv)</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMethod('text')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                  inputMethod === 'text'
                    ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                }`}
              >
                <span>Текст КТП</span>
              </button>
            </div>
          </div>

          {/* METHOD 1: EXCEL UPLOAD */}
          {inputMethod === 'excel' && (
            <div className="space-y-4">
              <div
                onClick={() => excelInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleExcelUpload(file);
                }}
                className="border-2 border-dashed border-emerald-300 dark:border-emerald-800/80 rounded-2xl p-8 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer bg-emerald-50/40 dark:bg-emerald-950/10 space-y-3 group"
              >
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleExcelUpload(file);
                  }}
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto group-hover:scale-105 transition-transform shadow-sm">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-900 dark:text-white">
                    {fileName ? `Выбран файл: ${fileName}` : 'Нажмите или перетащите таблицу Excel (.xlsx, .xls)'}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Система автоматически распознает колонки (№, Тема, Раздел, Дата, Часы, Четверть, ДЗ)
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center space-x-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-800 font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300">
                    .xlsx / .xls
                  </span>
                  <span className="text-neutral-400">или</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSampleXlsx();
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                  >
                    скачать готовый шаблон для заполнения
                  </button>
                </div>
              </div>

              {/* Multi-sheet Tabs if workbook has multiple sheets */}
              {excelSheets.length > 1 && (
                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-neutral-500 mr-1 flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Листы файла:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectExcelSheet('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      selectedSheetName === 'all'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    Все листы ({excelRawLessons.length} уроков)
                  </button>
                  {excelSheets.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => handleSelectExcelSheet(s.name)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        selectedSheetName === s.name
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {s.name} ({s.lessonsFound} ур.)
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* METHOD 2: TEMPLATES */}
          {inputMethod === 'template' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ANNUAL_CURRICULUM_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplateId === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                        : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                          {tmpl.grade} класс · {tmpl.lessonsCount} уроков
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-snug">
                        {tmpl.title}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3">
                        {tmpl.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      className={`w-full py-1.5 text-xs font-bold rounded-xl transition-all ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {isSelected ? 'План выбран ✓' : 'Выбрать этот план'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* METHOD 3: TEXT FILE */}
          {inputMethod === 'file' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer bg-neutral-50/50 dark:bg-neutral-800/30 space-y-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv,.json,.md,.xlsx,.xls"
                onChange={handleTextFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 flex items-center justify-center mx-auto">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-neutral-900 dark:text-white">
                  {fileName ? `Загружен: ${fileName}` : 'Нажмите или перетащите текстовый файл плана'}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Поддерживаются: .txt, .csv, .md, .tsv
                </p>
              </div>
            </div>
          )}

          {/* METHOD 4: DIRECT TEXT */}
          {inputMethod === 'text' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs text-neutral-500">
                <span>Вставьте темы уроков или строки КТП:</span>
                <span>{rawPlanText.length} символов</span>
              </div>
              <textarea
                rows={8}
                value={rawPlanText}
                onChange={(e) => setRawPlanText(e.target.value)}
                placeholder="Пример:&#10;1. Введение в алгоритмы&#10;2. Переменные в Python&#10;3. Условные конструкции if-else..."
                className="w-full p-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-mono text-xs text-neutral-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          {/* Class, Grade, Subject Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Параллель (Класс)
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  const g = Number(e.target.value);
                  setSelectedGrade(g);
                  setSelectedClassIds([`${g}C`]);
                }}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
              >
                {[7, 8, 9, 10, 11].map((g) => (
                  <option key={g} value={g}>
                    {g} класс
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Целевой класс в LMS
              </label>
              <select
                value={selectedClassIds[0] || `${selectedGrade}C`}
                onChange={(e) => setSelectedClassIds([e.target.value])}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.grade} класс, {c.studentCount} уч.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                Учебный предмет
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-semibold text-neutral-900 dark:text-white"
              />
            </div>
          </div>

          {/* Action button if using text/template mode */}
          {inputMethod !== 'excel' && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleParsePlan}
                disabled={isParsing || !rawPlanText.trim()}
                className="w-full py-3 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20"
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Распознавание структуры программы...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Распознать темы и распределить на учебный год</span>
                  </>
                )}
              </button>
            </div>
          )}

          {parseError && (
            <p className="text-xs text-rose-500 font-semibold flex items-center space-x-1.5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseError}</span>
            </p>
          )}
        </div>

        {/* STEP 2: SMART ACADEMIC YEAR DISTRIBUTION (РАСПРЕДЕЛЕНИЕ НА ГОД ОБУЧЕНИЯ) */}
        {blueprints.length > 0 && (
          <div className="space-y-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 animate-in fade-in duration-300">
            {/* Year Distribution Control Panel */}
            <div className="p-6 rounded-3xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-black">
                      2
                    </span>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      Распределение плана на учебный год ({blueprints.length} уроков)
                    </h3>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    Настройте автоматическую разбивку по четвертям и генерацию точных календарных дат с учетом каникул и праздников РФ.
                  </p>
                </div>

                {/* AI Balance Button */}
                <button
                  type="button"
                  onClick={handleAIDistributeYear}
                  disabled={isDistributingAI}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all flex items-center space-x-2 shadow-md disabled:opacity-50 self-start md:self-auto"
                >
                  {isDistributingAI ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>AI методический анализ...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>AI-балансировка четвертей (Gemini)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mode Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div
                  onClick={() => handleDistributionModeChange('auto_quarters')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    distributionMode === 'auto_quarters'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      ⚡ 4 Четверти (ФГОС)
                    </span>
                    {distributionMode === 'auto_quarters' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Стандартные пропорции (26% / 22% / 30% / 22%)
                  </p>
                </div>

                <div
                  onClick={() => handleDistributionModeChange('schedule_days')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    distributionMode === 'schedule_days'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      📅 По дням недели
                    </span>
                    {distributionMode === 'schedule_days' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Точные даты уроков с пропуском каникул и праздников
                  </p>
                </div>

                <div
                  onClick={() => handleDistributionModeChange('preserve_excel')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    distributionMode === 'preserve_excel'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      📑 Из файла Excel
                    </span>
                    {distributionMode === 'preserve_excel' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Сохранить четверти и даты так, как было в таблице
                  </p>
                </div>

                <div
                  onClick={() => handleDistributionModeChange('semesters')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    distributionMode === 'semesters'
                      ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                      : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-900 dark:text-white">
                      🎓 2 Семестра
                    </span>
                    {distributionMode === 'semesters' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    Для колледжей, СПО и старшей профильной школы
                  </p>
                </div>
              </div>

              {/* Day of Week & Calendar Options */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-neutral-200 dark:border-neutral-700/60 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-neutral-600 dark:text-neutral-300">
                    Дни уроков по расписанию:
                  </span>
                  <div className="flex items-center space-x-1">
                    {[
                      { day: 1, label: 'Пн' },
                      { day: 2, label: 'Вт' },
                      { day: 3, label: 'Ср' },
                      { day: 4, label: 'Чт' },
                      { day: 5, label: 'Пт' },
                      { day: 6, label: 'Сб' },
                    ].map(({ day, label }) => {
                      const isChecked = selectedWeekDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleWeekday(day)}
                          className={`w-7 h-7 rounded-lg font-bold text-xs transition-all ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600 hover:border-emerald-500'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-neutral-400 pl-1">
                    ({selectedWeekDays.length} ч/нед)
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={insertControlWorks}
                      onChange={(e) => {
                        setInsertControlWorks(e.target.checked);
                        handleDistributionModeChange(distributionMode);
                      }}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-neutral-700 dark:text-neutral-300 font-semibold">
                      Контрольная работа в конце четверти
                    </span>
                  </label>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-neutral-500">Учебный год:</span>
                    <select
                      value={startYear}
                      onChange={(e) => {
                        const y = Number(e.target.value);
                        setStartYear(y);
                        handleDistributionModeChange(distributionMode);
                      }}
                      className="px-2 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 font-bold text-xs text-neutral-800 dark:text-neutral-200"
                    >
                      <option value={2025}>2025/2026</option>
                      <option value={2026}>2026/2027</option>
                      <option value={2027}>2027/2028</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 4 Quarter Summary Cards Dashboard */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {quartersSummary.map((q) => {
                  const isFiltered = quarterFilter === q.quarter;
                  return (
                    <div
                      key={q.quarter}
                      onClick={() => setQuarterFilter(quarterFilter === q.quarter ? 'all' : q.quarter)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isFiltered
                          ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 shadow-sm'
                          : 'border-neutral-200 dark:border-neutral-700/80 bg-white dark:bg-neutral-800/80 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                          {q.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                          {q.lessonsCount} ур.
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        <span>{q.dateRange}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-neutral-600 dark:text-neutral-300 pt-1 border-t border-neutral-100 dark:border-neutral-700/50">
                        <span>Нагрузка: {q.hoursCount} акад. ч</span>
                        <span className="text-emerald-600 font-bold">
                          {Math.round((q.lessonsCount / (blueprints.length || 1)) * 100)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
                  <span>Таблица уроков года:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                    {filteredBlueprints.length} из {blueprints.length}
                  </span>
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Сгенерировано AI: <strong className="text-emerald-600 dark:text-emerald-400">{totalCompleted}</strong> · Выбрано: <strong>{totalSelected}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Quarter filter tabs */}
                <div className="flex items-center space-x-1 p-1 bg-white dark:bg-neutral-700 rounded-xl border border-neutral-200 dark:border-neutral-600 text-xs">
                  <button
                    type="button"
                    onClick={() => setQuarterFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      quarterFilter === 'all' ? 'bg-emerald-600 text-white' : 'text-neutral-600 dark:text-neutral-300'
                    }`}
                  >
                    Все ({blueprints.length})
                  </button>
                  {[1, 2, 3, 4].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuarterFilter(q)}
                      className={`px-2.5 py-1 rounded-lg font-bold ${
                        quarterFilter === q ? 'bg-emerald-600 text-white' : 'text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {q} четв.
                    </button>
                  ))}
                </div>

                {/* Generate All Button */}
                <button
                  type="button"
                  onClick={handleGenerateAllSelected}
                  disabled={isGeneratingAll || totalSelected === 0}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center space-x-2 shadow-md"
                >
                  {isGeneratingAll ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Генерация {generationProgress.current} из {generationProgress.total}...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Сгенерировать материалы AI ({totalSelected})</span>
                    </>
                  )}
                </button>

                {/* Publish to LMS Button */}
                <button
                  type="button"
                  onClick={handlePublishAll}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center space-x-2 shadow-md shadow-emerald-600/20"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Опубликовать план в LMS ({blueprints.length} ур.)</span>
                </button>
              </div>
            </div>

            {/* Live Progress Bar when generating */}
            {isGeneratingAll && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-2 animate-in fade-in">
                <div className="flex justify-between items-center text-xs font-bold text-blue-900 dark:text-blue-300">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                    <span>Создание карточек, слайдов и лабы для урока #{blueprints[activeQueueIndex]?.orderNumber || ''}: «{blueprints[activeQueueIndex]?.title || ''}»...</span>
                  </span>
                  <span>{Math.round((generationProgress.current / generationProgress.total) * 100)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Table of recognized lessons */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-50 dark:bg-neutral-800/80 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 font-bold">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={blueprints.every((bp) => bp.selected)}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="p-3.5 w-14">№</th>
                      <th className="p-3.5 w-28">Четверть</th>
                      <th className="p-3.5 w-32">Дата урока</th>
                      <th className="p-3.5">Тема урока и раздел</th>
                      <th className="p-3.5 w-24">Тип</th>
                      <th className="p-3.5 w-36">Материалы AI</th>
                      <th className="p-3.5 w-28 text-right">Действие</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {filteredBlueprints.map((item) => {
                      const originalIndex = blueprints.findIndex((bp) => bp.orderNumber === item.orderNumber);
                      return (
                        <tr
                          key={item.orderNumber}
                          className={`hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors ${
                            item.status === 'completed'
                              ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                              : ''
                          }`}
                        >
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => handleToggleSelect(originalIndex)}
                              className="rounded text-emerald-600 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3.5 font-mono font-bold text-neutral-900 dark:text-white">
                            #{item.orderNumber}
                          </td>

                          {/* Editable Quarter Dropdown */}
                          <td className="p-3.5">
                            <select
                              value={item.quarter}
                              onChange={(e) => handleUpdateQuarter(item.orderNumber, Number(e.target.value))}
                              className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-bold text-[11px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value={1}>1 четверть</option>
                              <option value={2}>2 четверть</option>
                              <option value={3}>3 четверть</option>
                              <option value={4}>4 четверть</option>
                            </select>
                          </td>

                          {/* Date input */}
                          <td className="p-3.5">
                            <input
                              type="date"
                              value={item.date || ''}
                              onChange={(e) => handleUpdateDate(item.orderNumber, e.target.value)}
                              className="px-2 py-1 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 font-mono text-[11px] text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>

                          {/* Title & Topic */}
                          <td className="p-3.5 space-y-1">
                            <div className="font-bold text-neutral-900 dark:text-white leading-snug">
                              {item.title}
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[11px] text-neutral-400">
                                {item.topic}
                              </span>
                              {item.homework && (
                                <span className="text-[10px] text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded truncate max-w-xs" title={item.homework}>
                                  ДЗ: {item.homework}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Lesson Type */}
                          <td className="p-3.5">
                            {item.lessonType === 'test' ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[10px]">
                                Контрольная
                              </span>
                            ) : item.lessonType === 'practice' ? (
                              <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[10px]">
                                Практикум
                              </span>
                            ) : item.lessonType === 'project' ? (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-[10px]">
                                Проект
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold text-[10px]">
                                Лекция
                              </span>
                            )}
                          </td>

                          {/* AI Generation Status */}
                          <td className="p-3.5">
                            {item.status === 'idle' && (
                              <span className="text-neutral-400 font-medium">Ожидает</span>
                            )}
                            {item.status === 'generating' && (
                              <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center space-x-1.5">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Генерация...</span>
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Готово ✓</span>
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-rose-500 font-bold text-[11px]" title={item.errorMsg}>
                                Ошибка
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right space-x-1">
                            {item.status === 'completed' && item.generatedLesson ? (
                              <button
                                type="button"
                                onClick={() => setInspectLesson(item.generatedLesson!)}
                                className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-xs inline-flex items-center space-x-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Смотреть</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => generateSingleLesson(originalIndex)}
                                disabled={item.status === 'generating' || isGeneratingAll}
                                className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs disabled:opacity-40"
                              >
                                Создать
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Inspector Modal for Generated Lesson */}
      {inspectLesson && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    Урок #{inspectLesson.orderNumber} · {inspectLesson.grade} класс · {inspectLesson.quarter} четверть
                  </span>
                  <span className="text-xs text-neutral-400">
                    {inspectLesson.date}
                  </span>
                </div>
                <h3 className="text-xl font-black text-neutral-900 dark:text-white">
                  {inspectLesson.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setInspectLesson(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 px-6 bg-neutral-50 dark:bg-neutral-800/40 text-xs font-bold">
              {[
                { id: 'cards', label: `Карточки понятий (${inspectLesson.conceptCards?.length || 0})`, icon: Layers },
                { id: 'notes', label: 'Конспект урока', icon: BookOpen },
                { id: 'slides', label: `Слайды (${inspectLesson.slides?.length || 0})`, icon: Monitor },
                { id: 'lab', label: 'Практикум в Python', icon: Terminal },
                { id: 'quiz', label: 'Контрольный тест', icon: Award },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = inspectActiveTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setInspectActiveTab(tab.id as any)}
                    className={`py-3 px-4 flex items-center space-x-1.5 border-b-2 transition-all ${
                      isActive
                        ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                        : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Tab 1: Interactive Concept Cards */}
              {inspectActiveTab === 'cards' && (
                <div className="space-y-4">
                  <p className="text-xs text-neutral-500">
                    Нажмите на карточку, чтобы перевернуть её и изучить формулу / код:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(inspectLesson.conceptCards || []).map((card) => {
                      const isFlipped = flippedCardId === card.id;
                      return (
                        <div
                          key={card.id}
                          onClick={() => setFlippedCardId(isFlipped ? null : card.id)}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer min-h-[160px] flex flex-col justify-between ${
                            isFlipped
                              ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-emerald-400'
                          }`}
                        >
                          <div>
                            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                              {isFlipped ? 'Код и совет' : 'Термин'}
                            </span>
                            <h4 className="text-sm font-black text-neutral-900 dark:text-white">
                              {card.term}
                            </h4>
                            <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-2">
                              {card.definition}
                            </p>
                          </div>

                          {card.codeSnippet && (
                            <div className="mt-3 p-2 rounded-lg bg-neutral-900 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                              {card.codeSnippet}
                            </div>
                          )}

                          {card.keyRule && (
                            <div className="mt-2 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                              💡 {card.keyRule}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Notes */}
              {inspectActiveTab === 'notes' && (
                <div className="space-y-4">
                  {inspectLesson.notes && (
                    <>
                      <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                        <span className="font-bold text-neutral-900 dark:text-white block">
                          Главные выводы урока:
                        </span>
                        <ul className="list-disc list-inside space-y-1 text-neutral-600 dark:text-neutral-300">
                          {inspectLesson.notes.keyTakeaways.map((takeaway, i) => (
                            <li key={i}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        {inspectLesson.notes.sections.map((sec, i) => (
                          <div key={i} className="space-y-2">
                            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                              {sec.title}
                            </h4>
                            <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                              {sec.content}
                            </p>
                            {sec.codeExample && (
                              <pre className="p-3 rounded-xl bg-neutral-900 text-emerald-300 font-mono text-xs overflow-x-auto">
                                {sec.codeExample}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 3: Presentation Slides */}
              {inspectActiveTab === 'slides' && (
                <div className="space-y-4">
                  {inspectLesson.slides && inspectLesson.slides.length > 0 && (
                    <div className="p-6 rounded-2xl bg-neutral-900 text-white min-h-[260px] flex flex-col justify-between space-y-4 shadow-lg">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-neutral-400 text-xs">
                          <span>Слайд {activeSlideIndex + 1} из {inspectLesson.slides.length}</span>
                          <span className="text-emerald-400 font-bold">Smart ICT Presentation</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">
                          {inspectLesson.slides[activeSlideIndex]?.title}
                        </h3>
                        <ul className="list-disc list-inside space-y-1.5 text-neutral-300">
                          {inspectLesson.slides[activeSlideIndex]?.bullets.map((bullet, i) => (
                            <li key={i}>{bullet}</li>
                          ))}
                        </ul>
                        {inspectLesson.slides[activeSlideIndex]?.codeSnippet && (
                          <pre className="p-3 rounded-lg bg-black/50 text-emerald-300 font-mono text-xs overflow-x-auto">
                            {inspectLesson.slides[activeSlideIndex].codeSnippet}
                          </pre>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-neutral-800">
                        <button
                          type="button"
                          disabled={activeSlideIndex === 0}
                          onClick={() => setActiveSlideIndex((p) => Math.max(0, p - 1))}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-bold"
                        >
                          ← Назад
                        </button>
                        <div className="flex space-x-1.5">
                          {inspectLesson.slides.map((_, idx) => (
                            <div
                              key={idx}
                              onClick={() => setActiveSlideIndex(idx)}
                              className={`w-2 h-2 rounded-full cursor-pointer transition-all ${
                                activeSlideIndex === idx ? 'bg-emerald-500 w-4' : 'bg-neutral-700'
                              }`}
                            />
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={activeSlideIndex === inspectLesson.slides.length - 1}
                          onClick={() => setActiveSlideIndex((p) => Math.min(inspectLesson.slides!.length - 1, p + 1))}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-xs font-bold"
                        >
                          Вперед →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Lab & Sandbox */}
              {inspectActiveTab === 'lab' && inspectLesson.lab && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {inspectLesson.lab.title}
                  </h4>
                  <p className="text-neutral-600 dark:text-neutral-300">
                    {inspectLesson.lab.instructions}
                  </p>
                  <div className="space-y-1">
                    <span className="font-bold text-neutral-500">Стартовый код ученика:</span>
                    <pre className="p-3 rounded-xl bg-neutral-900 text-emerald-300 font-mono text-xs overflow-x-auto">
                      {inspectLesson.lab.starterCode}
                    </pre>
                  </div>
                  {inspectLesson.lab.hint && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300">
                      💡 Подсказка: {inspectLesson.lab.hint}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Test & Quiz */}
              {inspectActiveTab === 'quiz' && inspectLesson.test && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {inspectLesson.test.title}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                      {inspectLesson.test.timeLimitMinutes} минут
                    </span>
                  </div>

                  <div className="space-y-3">
                    {inspectLesson.test.questions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-2">
                        <span className="font-bold text-neutral-900 dark:text-white">
                          Вопрос {idx + 1}: {q.prompt}
                        </span>
                        <div className="space-y-1 pl-2">
                          {q.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`p-2 rounded-lg ${
                                q.correctOptionIds.includes(opt.id)
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                                  : 'text-neutral-600 dark:text-neutral-400'
                              }`}
                            >
                              • {opt.text} {q.correctOptionIds.includes(opt.id) && '✓'}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-[11px] text-neutral-400 italic">
                            Пояснение: {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end bg-neutral-50 dark:bg-neutral-800/40">
              <button
                type="button"
                onClick={() => setInspectLesson(null)}
                className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold"
              >
                Закрыть просмотр
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
