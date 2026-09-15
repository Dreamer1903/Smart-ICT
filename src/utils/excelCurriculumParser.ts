import * as XLSX from 'xlsx';

export interface ParsedExcelLesson {
  rawRowIndex: number;
  orderNumber: number;
  quarter: number;
  date?: string;
  title: string;
  topic: string;
  hours: number;
  lessonType?: 'lecture' | 'practice' | 'test' | 'exam' | 'project';
  keyConcepts: string[];
  description: string;
  notes?: string;
  homework?: string;
}

export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  lessonsFound: number;
  columnsDetected: string[];
}

export interface YearDistributionOptions {
  mode: 'auto_quarters' | 'schedule_days' | 'preserve_excel' | 'semesters';
  startYear?: number; // e.g. 2026
  weekDays?: number[]; // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  hoursPerWeek?: number;
  insertControlWorks?: boolean;
}

export interface QuarterSummary {
  quarter: number;
  name: string;
  dateRange: string;
  lessonsCount: number;
  hoursCount: number;
}

// Standard vacation & holiday ranges for a school year starting Sept 1 of startYear
export function getSchoolCalendar(startYear: number = 2026) {
  const nextYear = startYear + 1;
  return {
    q1: {
      start: new Date(startYear, 8, 1), // 1 Sept
      end: new Date(startYear, 9, 31), // 31 Oct
      name: '1 четверть (Осень)',
    },
    autumnVacation: {
      start: new Date(startYear, 10, 1), // 1 Nov
      end: new Date(startYear, 10, 8), // 8 Nov
    },
    q2: {
      start: new Date(startYear, 10, 9), // 9 Nov
      end: new Date(startYear, 11, 29), // 29 Dec
      name: '2 четверть (Зима I)',
    },
    winterVacation: {
      start: new Date(startYear, 11, 30), // 30 Dec
      end: new Date(nextYear, 0, 10), // 10 Jan
    },
    q3: {
      start: new Date(nextYear, 0, 11), // 11 Jan
      end: new Date(nextYear, 2, 23), // 23 Mar
      name: '3 четверть (Зима II / Весна I)',
    },
    springVacation: {
      start: new Date(nextYear, 2, 24), // 24 Mar
      end: new Date(nextYear, 2, 31), // 31 Mar
    },
    q4: {
      start: new Date(nextYear, 3, 1), // 1 Apr
      end: new Date(nextYear, 4, 25), // 25 May
      name: '4 четверть (Весна II)',
    },
  };
}

/**
 * Parses an Excel (.xlsx / .xls) workbook into lessons and sheet metadata.
 */
export function parseExcelWorkbook(
  data: ArrayBuffer | Uint8Array,
  subjectName: string = 'Информатика и ИКТ',
  grade: number = 10
): {
  sheets: ExcelSheetInfo[];
  lessonsBySheet: Record<string, ParsedExcelLesson[]>;
  allLessons: ParsedExcelLesson[];
} {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheets: ExcelSheetInfo[] = [];
  const lessonsBySheet: Record<string, ParsedExcelLesson[]> = {};
  const allLessons: ParsedExcelLesson[] = [];

  let globalOrderCounter = 1;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Convert to 2D array of rows
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    if (rawRows.length === 0) continue;

    // Detect header row (within first 15 rows)
    let headerRowIndex = -1;
    let colIndices = {
      order: -1,
      quarter: -1,
      date: -1,
      title: -1,
      topic: -1,
      hours: -1,
      type: -1,
      homework: -1,
      notes: -1,
    };

    const headerKeywords = {
      order: ['№', '№ п/п', 'номер', 'порядок', '№ урока', 'урок №', 'id'],
      quarter: ['четверть', 'четв', 'полугодие', 'семестр', 'модуль', 'период', 'триместр'],
      date: ['дата', 'сроки', 'число', 'дата урока', 'план', 'период'],
      title: ['тема', 'тема урока', 'наименование', 'содержание', 'название', 'тематика', 'раздел/тема'],
      topic: ['раздел', 'глава', 'блок', 'модуль программы', 'раздел программы', 'тема раздела'],
      hours: ['часы', 'кол-во часов', 'количество часов', 'акад. ч', 'час', 'час.'],
      type: ['тип', 'тип урока', 'форма', 'вид урока', 'контроль', 'форма контроля'],
      homework: ['дз', 'домашнее задание', 'домашняя работа', 'задание'],
      notes: ['примечание', 'заметки', 'оборудование', 'понятия', 'комментарий'],
    };

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
      const row = rawRows[r];
      if (!Array.isArray(row)) continue;

      let matchCount = 0;
      const detected = { ...colIndices };

      for (let c = 0; c < row.length; c++) {
        const cellStr = String(row[c] || '').trim().toLowerCase();
        if (!cellStr) continue;

        for (const [key, words] of Object.entries(headerKeywords)) {
          if (words.some((w) => cellStr === w || (cellStr.includes(w) && cellStr.length < 30))) {
            (detected as any)[key] = c;
            matchCount++;
            break;
          }
        }
      }

      // If we found a title column or at least 2 relevant columns, consider this the header
      if (detected.title !== -1 || (detected.order !== -1 && matchCount >= 2) || matchCount >= 3) {
        headerRowIndex = r;
        colIndices = detected;
        break;
      }
    }

    // Fallback: if no header row detected, find column with most descriptive text as title
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      // Heuristic: inspect first 10 rows to determine columns
      let bestTitleCol = 0;
      let maxAvgLength = 0;

      const numCols = Math.max(...rawRows.slice(0, 10).map((r) => r.length));
      for (let c = 0; c < numCols; c++) {
        let totalLen = 0;
        let count = 0;
        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const val = String(rawRows[r]?.[c] || '').trim();
          if (val && isNaN(Number(val))) {
            totalLen += val.length;
            count++;
          }
        }
        const avg = count > 0 ? totalLen / count : 0;
        if (avg > maxAvgLength) {
          maxAvgLength = avg;
          bestTitleCol = c;
        }
      }
      colIndices.title = bestTitleCol;
      if (bestTitleCol > 0) colIndices.order = 0;
    }

    // Parse data rows
    const parsedLessons: ParsedExcelLesson[] = [];
    let currentQuarter = 1;
    let currentTopic = subjectName;

    // Check if sheetName itself indicates a quarter (e.g. "1 четверть", "Quarter 2")
    const sheetQuarterMatch = sheetName.match(/(?:(\d)|(I{1,3}|IV))\s*(?:четверть|quarter|семестр|модуль)/i);
    if (sheetQuarterMatch) {
      if (sheetQuarterMatch[1]) {
        currentQuarter = Math.min(4, Math.max(1, parseInt(sheetQuarterMatch[1], 10)));
      }
    }

    for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!Array.isArray(row) || row.every((c) => !c || String(c).trim() === '')) {
        continue;
      }

      const rowText = row.join(' ').trim();
      if (!rowText || rowText.length < 3) continue;

      // Detect if row is a section header like "Раздел 1. Основы программирования"
      const sectionMatch = rowText.match(/^(?:Раздел|Тема|Глава|Модуль|Блок)\s*[\d\.\:\-]+\s*(.+)$/i);
      if (sectionMatch && row.filter(Boolean).length <= 2) {
        currentTopic = sectionMatch[1].trim() || rowText;
        continue;
      }

      // Check for inline quarter indicator
      const inlineQuarterMatch = rowText.match(/(?:(\d)|(I{1,3}|IV))\s*(?:четверть|модуль|триместр)/i);
      if (inlineQuarterMatch && row.filter(Boolean).length <= 2) {
        if (inlineQuarterMatch[1]) {
          currentQuarter = Math.min(4, Math.max(1, parseInt(inlineQuarterMatch[1], 10)));
        }
        continue;
      }

      // Extract raw cell values
      let rawOrder = colIndices.order !== -1 ? String(row[colIndices.order] || '').trim() : '';
      let rawQuarter = colIndices.quarter !== -1 ? String(row[colIndices.quarter] || '').trim() : '';
      let rawDate = colIndices.date !== -1 ? String(row[colIndices.date] || '').trim() : '';
      let rawTitle = colIndices.title !== -1 ? String(row[colIndices.title] || '').trim() : '';
      let rawTopic = colIndices.topic !== -1 ? String(row[colIndices.topic] || '').trim() : '';
      let rawHours = colIndices.hours !== -1 ? String(row[colIndices.hours] || '').trim() : '1';
      let rawType = colIndices.type !== -1 ? String(row[colIndices.type] || '').trim() : '';
      let rawHw = colIndices.homework !== -1 ? String(row[colIndices.homework] || '').trim() : '';
      let rawNotes = colIndices.notes !== -1 ? String(row[colIndices.notes] || '').trim() : '';

      // If title is missing or too short, look for longest cell in the row
      if (!rawTitle || rawTitle.length < 3) {
        const textCells = row
          .map((c) => String(c || '').trim())
          .filter((c) => c.length > 3 && isNaN(Number(c)));
        if (textCells.length > 0) {
          rawTitle = textCells.reduce((a, b) => (a.length >= b.length ? a : b));
        }
      }

      // Skip lines that look like table subheaders or totals
      if (
        !rawTitle ||
        rawTitle.length < 3 ||
        rawTitle.toLowerCase().includes('итого') ||
        rawTitle.toLowerCase().includes('всего часов') ||
        rawTitle.toLowerCase().includes('резерв')
      ) {
        continue;
      }

      // Clean title from leading numbers like "1. ", "12) "
      const cleanTitle = rawTitle.replace(/^[\d]+[\.\)\:\-]\s*/, '').trim();
      if (cleanTitle.length < 2) continue;

      // Extract quarter if present in quarter cell
      if (rawQuarter) {
        const qNum = parseInt(rawQuarter.replace(/\D/g, ''), 10);
        if (qNum >= 1 && qNum <= 4) {
          currentQuarter = qNum;
        }
      }

      // Extract section/topic
      if (rawTopic && rawTopic.length > 2) {
        currentTopic = rawTopic.trim();
      }

      // Extract hours
      const parsedHours = parseFloat(rawHours.replace(',', '.')) || 1;

      // Detect lesson type
      let lessonType: 'lecture' | 'practice' | 'test' | 'exam' | 'project' = 'lecture';
      const typeLower = (rawType + ' ' + cleanTitle).toLowerCase();
      if (typeLower.includes('контрольн') || typeLower.includes('к/р') || typeLower.includes('зачет') || typeLower.includes('тест')) {
        lessonType = 'test';
      } else if (typeLower.includes('практик') || typeLower.includes('лаборатор') || typeLower.includes('л/р') || typeLower.includes('п/р')) {
        lessonType = 'practice';
      } else if (typeLower.includes('проект')) {
        lessonType = 'project';
      }

      // Parse date if present
      let formattedDate: string | undefined = undefined;
      if (rawDate) {
        formattedDate = cleanDateString(rawDate);
      }

      // Extract key concepts
      const concepts = extractKeywords(cleanTitle, currentTopic);

      const parsedLesson: ParsedExcelLesson = {
        rawRowIndex: r,
        orderNumber: parseInt(rawOrder, 10) || globalOrderCounter,
        quarter: currentQuarter,
        date: formattedDate,
        title: cleanTitle,
        topic: currentTopic || subjectName,
        hours: parsedHours,
        lessonType,
        keyConcepts: concepts,
        description: `Учебный модуль ${grade} класса: изучение теоретических основ и практических навыков по теме «${cleanTitle}».`,
        homework: rawHw || undefined,
        notes: rawNotes || undefined,
      };

      parsedLessons.push(parsedLesson);
      allLessons.push(parsedLesson);
      globalOrderCounter++;
    }

    const detectedColumnsList = Object.entries(colIndices)
      .filter(([_, idx]) => idx !== -1)
      .map(([k]) => k);

    sheets.push({
      name: sheetName,
      rowCount: rawRows.length,
      lessonsFound: parsedLessons.length,
      columnsDetected: detectedColumnsList,
    });

    lessonsBySheet[sheetName] = parsedLessons;
  }

  return { sheets, lessonsBySheet, allLessons };
}

/**
 * Distributes a list of lessons across the academic year according to chosen rules.
 */
export function distributeLessonsAcrossYear(
  lessons: ParsedExcelLesson[],
  options: YearDistributionOptions = { mode: 'auto_quarters' }
): {
  distributedLessons: ParsedExcelLesson[];
  quartersSummary: QuarterSummary[];
} {
  const startYear = options.startYear || 2026;
  const calendar = getSchoolCalendar(startYear);
  const total = lessons.length;

  if (total === 0) {
    return { distributedLessons: [], quartersSummary: [] };
  }

  // Clone lessons to avoid mutation
  let updatedLessons: ParsedExcelLesson[] = lessons.map((l, idx) => ({
    ...l,
    orderNumber: idx + 1,
  }));

  // 1. Calculate quarters distribution
  if (options.mode === 'preserve_excel') {
    // Keep quarter as parsed from Excel, but validate 1..4
    updatedLessons = updatedLessons.map((l, idx) => ({
      ...l,
      quarter: l.quarter >= 1 && l.quarter <= 4 ? l.quarter : Math.min(4, Math.floor((idx / total) * 4) + 1),
    }));
  } else if (options.mode === 'semesters') {
    // 2 Semesters: 1-st half, 2-nd half
    const half = Math.ceil(total / 2);
    updatedLessons = updatedLessons.map((l, idx) => ({
      ...l,
      quarter: idx < half ? 1 : 2,
    }));
  } else {
    // Standard 4 quarters school distribution in Russia/CIS:
    // Proportion: Q1 ~ 26%, Q2 ~ 22%, Q3 ~ 30%, Q4 ~ 22%
    const q1Count = Math.max(1, Math.round(total * 0.26));
    const q2Count = Math.max(1, Math.round(total * 0.22));
    const q3Count = Math.max(1, Math.round(total * 0.30));
    // Remaining in Q4
    const q4Count = Math.max(1, total - (q1Count + q2Count + q3Count));

    const q1Limit = q1Count;
    const q2Limit = q1Limit + q2Count;
    const q3Limit = q2Limit + q3Count;

    updatedLessons = updatedLessons.map((l, idx) => {
      let q = 1;
      if (idx < q1Limit) q = 1;
      else if (idx < q2Limit) q = 2;
      else if (idx < q3Limit) q = 3;
      else q = 4;

      return {
        ...l,
        quarter: q,
      };
    });
  }

  // 2. Distribute dates if requested or mode is schedule_days
  if (options.mode === 'schedule_days' || options.weekDays?.length) {
    const weekDays = options.weekDays && options.weekDays.length > 0 ? options.weekDays : [1, 4]; // Default: Mon, Thu
    const calculatedDates = generateAcademicDates(startYear, weekDays, total);

    updatedLessons = updatedLessons.map((l, idx) => {
      const dateInfo = calculatedDates[idx];
      return {
        ...l,
        date: dateInfo ? dateInfo.dateStr : l.date,
        quarter: dateInfo ? dateInfo.quarter : l.quarter,
      };
    });
  } else {
    // If no specific schedule days provided, distribute approximate dates based on quarter start/end
    updatedLessons = assignApproximateDates(updatedLessons, startYear);
  }

  // 3. Mark control work at the end of each quarter if requested
  if (options.insertControlWorks) {
    for (let q = 1; q <= 4; q++) {
      const qLessons = updatedLessons.filter((l) => l.quarter === q);
      if (qLessons.length > 0) {
        const lastLesson = qLessons[qLessons.length - 1];
        if (lastLesson.lessonType !== 'test') {
          lastLesson.lessonType = 'test';
          if (!lastLesson.title.toLowerCase().includes('контрольн') && !lastLesson.title.toLowerCase().includes('зачет')) {
            lastLesson.title += ` (Итоговая контрольная работа ${q} четверти)`;
          }
        }
      }
    }
  }

  // 4. Build Quarters Summary
  const quartersSummary: QuarterSummary[] = [1, 2, 3, 4].map((q) => {
    const qLessons = updatedLessons.filter((l) => l.quarter === q);
    const hours = qLessons.reduce((sum, l) => sum + (l.hours || 1), 0);
    const dates = qLessons.map((l) => l.date).filter(Boolean).sort() as string[];

    let dateRange = 'Сроки не указаны';
    if (dates.length > 0) {
      dateRange = `${formatRuDate(dates[0])} — ${formatRuDate(dates[dates.length - 1])}`;
    } else {
      const qInfo = (calendar as any)[`q${q}`];
      if (qInfo) {
        dateRange = `${formatRuDate(qInfo.start.toISOString())} — ${formatRuDate(qInfo.end.toISOString())}`;
      }
    }

    const quarterNames = [
      '',
      '1 Четверть (Осень)',
      '2 Четверть (Зима I)',
      '3 Четверть (Зима II / Весна)',
      '4 Четверть (Весна)',
    ];

    return {
      quarter: q,
      name: quarterNames[q] || `${q} Четверть`,
      dateRange,
      lessonsCount: qLessons.length,
      hoursCount: hours,
    };
  });

  return {
    distributedLessons: updatedLessons,
    quartersSummary,
  };
}

/**
 * Generates exact calendar dates according to school year holidays and chosen weekdays.
 */
function generateAcademicDates(
  startYear: number,
  weekDays: number[], // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
  totalLessons: number
): { dateStr: string; quarter: number }[] {
  const calendar = getSchoolCalendar(startYear);
  const results: { dateStr: string; quarter: number }[] = [];

  // Start from Sept 1 (or next matching weekday)
  let cur = new Date(startYear, 8, 1);
  const endDate = new Date(startYear + 1, 4, 31); // 31 May

  // Russian national holidays during school year (month is 0-indexed)
  const holidays = [
    `${startYear}-11-04`, // День народного единства
    `${startYear + 1}-01-01`,
    `${startYear + 1}-01-02`,
    `${startYear + 1}-01-03`,
    `${startYear + 1}-01-04`,
    `${startYear + 1}-01-05`,
    `${startYear + 1}-01-06`,
    `${startYear + 1}-01-07`,
    `${startYear + 1}-01-08`,
    `${startYear + 1}-02-23`, // 23 февраля
    `${startYear + 1}-03-08`, // 8 марта
    `${startYear + 1}-05-01`, // 1 мая
    `${startYear + 1}-05-09`, // 9 мая
  ];

  while (cur <= endDate && results.length < totalLessons) {
    const dayOfWeek = cur.getDay(); // 0=Sun, 1=Mon...
    const isoDate = cur.toISOString().split('T')[0];

    // Check if day matches selected weekdays
    if (weekDays.includes(dayOfWeek)) {
      // Check if vacation or holiday
      const inAutumnVac = cur >= calendar.autumnVacation.start && cur <= calendar.autumnVacation.end;
      const inWinterVac = cur >= calendar.winterVacation.start && cur <= calendar.winterVacation.end;
      const inSpringVac = cur >= calendar.springVacation.start && cur <= calendar.springVacation.end;
      const isHoliday = holidays.includes(isoDate);

      if (!inAutumnVac && !inWinterVac && !inSpringVac && !isHoliday) {
        // Determine quarter
        let q = 1;
        if (cur <= calendar.q1.end) q = 1;
        else if (cur <= calendar.q2.end) q = 2;
        else if (cur <= calendar.q3.end) q = 3;
        else q = 4;

        results.push({ dateStr: isoDate, quarter: q });
      }
    }

    // Step to next day
    cur.setDate(cur.getDate() + 1);
  }

  return results;
}

/**
 * Assigns realistic approximate dates across the 4 quarters if none exist.
 */
function assignApproximateDates(lessons: ParsedExcelLesson[], startYear: number): ParsedExcelLesson[] {
  const calendar = getSchoolCalendar(startYear);

  return lessons.map((l) => {
    if (l.date && l.date.includes('-')) {
      return l;
    }

    // Pick a date in the quarter
    const qInfo = (calendar as any)[`q${l.quarter}`] || calendar.q1;
    const startMs = qInfo.start.getTime();
    const endMs = qInfo.end.getTime();

    // Group lessons in this quarter to interpolate
    const qLessons = lessons.filter((x) => x.quarter === l.quarter);
    const indexInQuarter = qLessons.findIndex((x) => x.orderNumber === l.orderNumber);
    const progress = qLessons.length > 1 ? indexInQuarter / (qLessons.length - 1) : 0.5;

    const targetDate = new Date(startMs + progress * (endMs - startMs));
    // Make sure it's a weekday
    if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);
    if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);

    return {
      ...l,
      date: targetDate.toISOString().split('T')[0],
    };
  });
}

function cleanDateString(raw: string): string | undefined {
  const clean = raw.trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  // DD.MM.YYYY or DD.MM
  const parts = clean.split(/[\.\-\/]/);
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2] ? parseInt(parts[2], 10) : 2026;
    const fullYear = year < 100 ? 2000 + year : year;

    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return undefined;
}

function formatRuDate(isoDateStr: string): string {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return isoDateStr;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function extractKeywords(title: string, topic: string): string[] {
  const stopWords = ['урок', 'тема', 'введение', 'основы', 'понятие', 'класс', 'работа', 'для', 'при', 'или', 'как', 'что'];
  const words = title
    .replace(/[^\wа-яёА-ЯЁ\s]/gi, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !stopWords.includes(w.toLowerCase()));

  const res = Array.from(new Set(words)).slice(0, 4);
  if (res.length < 2 && topic) {
    res.push(topic);
  }
  return res;
}

/**
 * Creates a downloadable standard sample Excel (.xlsx) file with curriculum for teachers.
 */
export function generateSampleKtpXlsx(grade: number = 10, subjectName: string = 'Информатика и ИКТ'): Uint8Array {
  const sampleData = [
    // Header
    ['№ п/п', 'Четверть', 'Дата', 'Раздел программы', 'Тема урока', 'Кол-во часов', 'Тип урока', 'Домашнее задание'],
    // 1 четверть (Python basics & data structures)
    [1, 1, '2026-09-03', 'Введение в программирование', 'Техника безопасности. Среда разработки Python 3.12 и IDE', 1, 'Лекция', 'Установка VS Code и запуск скрипта hello.py'],
    [2, 1, '2026-09-08', 'Введение в программирование', 'Переменные, типизация данных (int, float, str, bool) и оператор input()', 1, 'Практикум', 'Задачи 1-5 на преобразование типов данных'],
    [3, 1, '2026-09-10', 'Базовые алгоритмические конструкции', 'Условные конструкции if, elif, else и логические операторы and, or, not', 1, 'Практикум', 'Решение задач на определение четверти координатной плоскости'],
    [4, 1, '2026-09-15', 'Базовые алгоритмические конструкции', 'Цикл while с предусловием: бесконечные циклы и операторы break, continue', 1, 'Практикум', 'Подсчет суммы цифр натурального числа'],
    [5, 1, '2026-09-17', 'Базовые алгоритмические конструкции', 'Цикл со счетчиком for и функция генерации последовательностей range()', 1, 'Практикум', 'Таблица умножения и вложенные циклы'],
    [6, 1, '2026-09-22', 'Строки и форматирование', 'Методы строк: срезы, find(), replace(), split(), join() и f-строки', 1, 'Практикум', 'Проверка палиндрома и подсчет слов в предложении'],
    [7, 1, '2026-09-24', 'Коллекции в Python', 'Списки (list): индексация, методы append(), pop(), sort() и срезы', 1, 'Практикум', 'Поиск максимума и минимума в массиве за один проход'],
    [8, 1, '2026-09-29', 'Коллекции в Python', 'Генераторы списков (List Comprehensions) и многомерные массивы', 1, 'Практикум', 'Создание и вывод матрицы N x M'],
    [9, 1, '2026-10-01', 'Контроль знаний', 'Контрольная работа №1: Базовый синтаксис Python и списки', 1, 'Контрольная работа', 'Повторить синтаксис функций и словарей'],

    // 2 четверть (Functions, Dictionaries, Algorithms)
    [10, 2, '2026-11-10', 'Функции и модульность', 'Пользовательские функции def, позиционные и именованные аргументы, return', 1, 'Практикум', 'Написание модуля с математическими функциями'],
    [11, 2, '2026-11-12', 'Функции и модульность', 'Область видимости переменных (LEGB) и рекурсивные функции', 1, 'Практикум', 'Рекурсивное вычисление факториала и чисел Фибоначчи'],
    [12, 2, '2026-11-17', 'Ассоциативные структуры', 'Словари (dict): ключи, значения, методы get(), items() и подсчет частот', 1, 'Практикум', 'Частотный анализ текста литературного произведения'],
    [13, 2, '2026-11-19', 'Ассоциативные структуры', 'Множества (set): операции объединения, пересечения и разности', 1, 'Практикум', 'Поиск уникальных элементов в двух списках'],
    [14, 2, '2026-11-24', 'Анализ сложности алгоритмов', 'Асимптотическая сложность Big-O (O(1), O(N), O(N²), O(log N))', 1, 'Лекция', 'Сравнение скорости выполнения линейного и вложенного циклов'],
    [15, 2, '2026-11-26', 'Алгоритмы поиска', 'Линейный и бинарный (двоичный) поиск в отсортированном массиве', 1, 'Практикум', 'Реализация бинарного поиска с подсчетом шагов'],
    [16, 2, '2026-12-01', 'Алгоритмы сортировки', 'Квадратичные сортировки: пузырьком, выбором и вставками', 1, 'Практикум', 'Сортировка списка учеников по среднему баллу'],
    [17, 2, '2026-12-03', 'Контроль знаний', 'Контрольная работа №2: Функции, словари и алгоритмы поиска', 1, 'Контрольная работа', 'Подготовка к изучению файловых операций'],

    // 3 четверть (Files, Data Structures, OOP, Web)
    [18, 3, '2026-01-14', 'Работа с файловой системой', 'Чтение и запись текстовых файлов: менеджер контекста with open()', 1, 'Практикум', 'Фильтрация строк лог-файла сервера'],
    [19, 3, '2026-01-19', 'Работа с данными', 'Форматы сериализации JSON и CSV: парсинг и структурирование данных', 1, 'Практикум', 'Обработка открытого набора данных о погоде'],
    [20, 3, '2026-01-21', 'Абстрактные структуры данных', 'Стек (LIFO): реализация, проверка правильности скобочных последовательностей', 1, 'Практикум', 'Алгоритм проверки парных скобок () [] {}'],
    [21, 3, '2026-01-26', 'Абстрактные структуры данных', 'Очередь (FIFO) и двусторонняя очередь collections.deque', 1, 'Практикум', 'Симуляция очереди обслуживания клиентов банка'],
    [22, 3, '2026-01-28', 'Теория графов', 'Представление графов в коде: матрицы смежности и списки смежности', 1, 'Практикум', 'Построение графа маршрутов школьного автобуса'],
    [23, 3, '2026-02-02', 'Теория графов', 'Обход графа в глубину (DFS) и поиск компонент связности', 1, 'Практикум', 'Поиск пути в лабиринте алгоритмом DFS'],
    [24, 3, '2026-02-04', 'Теория графов', 'Обход графа в ширину (BFS) и поиск кратчайшего пути', 1, 'Практикум', 'Расчет минимального числа пересадок на метро'],
    [25, 3, '2026-02-09', 'Основы ООП', 'Классы, объекты, конструктор __init__ и методы экземпляра', 1, 'Практикум', 'Проектирование класса БанковскийАккаунт'],
    [26, 3, '2026-02-11', 'Основы ООП', 'Инкапсуляция, наследование и полиморфизм на практике', 1, 'Практикум', 'Иерархия игровых персонажей в RPG игре'],
    [27, 3, '2026-02-16', 'Контроль знаний', 'Контрольная работа №3: Структуры данных, графы и ООП', 1, 'Контрольная работа', 'Повторение реляционных моделей баз данных'],

    // 4 четверть (Databases, SQL, Networks, Final Project)
    [28, 4, '2026-04-02', 'Базы данных и SQL', 'Реляционная модель, первичные и внешние ключи. СУБД SQLite', 1, 'Лекция', 'Проектирование схемы БД "Школьная библиотека"'],
    [29, 4, '2026-04-07', 'Базы данных и SQL', 'Запросы выборки SELECT, WHERE, ORDER BY, LIMIT и функции агрегации', 1, 'Практикум', 'Выборка отличников по параллели из базы данных'],
    [30, 4, '2026-04-09', 'Базы данных и SQL', 'Связи таблиц и операторы JOIN: объединение данных учеников и оценок', 1, 'Практикум', 'Формирование сводной ведомости успеваемости'],
    [31, 4, '2026-04-14', 'Компьютерные сети', 'Сетевой стек TCP/IP, IP-адресация, DNS и протоколы HTTP/HTTPS', 1, 'Лекция', 'Отправка GET-запроса через библиотеку requests'],
    [32, 4, '2026-04-16', 'Информационная безопасность', 'Основы криптографии: шифр Цезаря, хеширование SHA-256 и безопасные пароли', 1, 'Практикум', 'Написание программы для хеширования паролей'],
    [33, 4, '2026-04-21', 'Итоговый практикум', 'Защита курсовых практических проектов по программированию на Python', 1, 'Проект', 'Подготовка презентации и демонстрация кода'],
    [34, 4, '2026-04-23', 'Итоговая аттестация', 'Годовая контрольная работа по курсу информатики 10 класса', 1, 'Контрольная работа', 'Подведение итогов учебного года и летнее чтение'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);

  // Set column widths for comfortable viewing in Excel
  ws['!cols'] = [
    { wch: 8 }, // №
    { wch: 10 }, // Четверть
    { wch: 14 }, // Дата
    { wch: 32 }, // Раздел
    { wch: 65 }, // Тема
    { wch: 14 }, // Часы
    { wch: 20 }, // Тип
    { wch: 50 }, // ДЗ
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `КТП_${grade}_класс`);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(wbout);
}
