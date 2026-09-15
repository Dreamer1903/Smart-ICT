import { AttendanceRecord, LessonGradeRecord, AttendanceStatus, ClassReportSummary, User, Lesson, SchoolClass } from '../types';
import * as XLSX from 'xlsx';

// Seed Attendance Records for students across available lessons
export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  // Student 1 (Muhammad Salikhov, 10-C)
  { id: 'att-1-1', lessonId: 'lesson-10c-1', studentId: 'student-1', classId: '10C', date: '2026-09-03', status: 'present' },
  { id: 'att-1-2', lessonId: 'lesson-10c-2', studentId: 'student-1', classId: '10C', date: '2026-09-07', status: 'present' },
  { id: 'att-1-3', lessonId: 'lesson-10c-3', studentId: 'student-1', classId: '10C', date: '2026-09-10', status: 'late', minutesLate: 7, note: 'Задержка в библиотеке' },
  { id: 'att-1-4', lessonId: 'lesson-10c-4', studentId: 'student-1', classId: '10C', date: '2026-09-14', status: 'present' },

  // Student 2 (Anna Smirnova, 7-A)
  { id: 'att-2-1', lessonId: 'lesson-7a-1', studentId: 'student-2', classId: '7A', date: '2026-09-02', status: 'present' },
  { id: 'att-2-2', lessonId: 'lesson-7a-2', studentId: 'student-2', classId: '7A', date: '2026-09-05', status: 'excused', note: 'Справка от врача' },
  { id: 'att-2-3', lessonId: 'lesson-7a-3', studentId: 'student-2', classId: '7A', date: '2026-09-09', status: 'present' },

  // Student 3 (Daniil Volkov, 11-B)
  { id: 'att-3-1', lessonId: 'lesson-11b-1', studentId: 'student-3', classId: '11B', date: '2026-09-04', status: 'present' },
  { id: 'att-3-2', lessonId: 'lesson-11b-2', studentId: 'student-3', classId: '11B', date: '2026-09-08', status: 'present' },
  { id: 'att-3-3', lessonId: 'lesson-11b-3', studentId: 'student-3', classId: '11B', date: '2026-09-11', status: 'present' },
];

// Seed Grades for students across available lessons
export const INITIAL_GRADE_RECORDS: LessonGradeRecord[] = [
  // Student 1 (10-C)
  { id: 'gr-1-1', lessonId: 'lesson-10c-1', studentId: 'student-1', classId: '10C', date: '2026-09-03', grade: 5, score: 96, type: 'classwork', comment: 'Отличный разбор алгоритмов' },
  { id: 'gr-1-2', lessonId: 'lesson-10c-2', studentId: 'student-1', classId: '10C', date: '2026-09-07', grade: 5, score: 98, type: 'homework', comment: 'Чистый код на Python' },
  { id: 'gr-1-3', lessonId: 'lesson-10c-3', studentId: 'student-1', classId: '10C', date: '2026-09-10', grade: 4, score: 85, type: 'lab', comment: 'Хорошая работа со стеком' },
  { id: 'gr-1-4', lessonId: 'lesson-10c-4', studentId: 'student-1', classId: '10C', date: '2026-09-14', grade: 5, score: 92, type: 'test', comment: 'Тестирование пройдено' },

  // Student 2 (7-A)
  { id: 'gr-2-1', lessonId: 'lesson-7a-1', studentId: 'student-2', classId: '7A', date: '2026-09-02', grade: 5, score: 95, type: 'classwork' },
  { id: 'gr-2-2', lessonId: 'lesson-7a-2', studentId: 'student-2', classId: '7A', date: '2026-09-05', grade: 4, score: 80, type: 'homework' },
  { id: 'gr-2-3', lessonId: 'lesson-7a-3', studentId: 'student-2', classId: '7A', date: '2026-09-09', grade: 5, score: 90, type: 'test' },

  // Student 3 (11-B)
  { id: 'gr-3-1', lessonId: 'lesson-11b-1', studentId: 'student-3', classId: '11B', date: '2026-09-04', grade: 5, score: 100, type: 'classwork', comment: 'Решил задачу повышенной сложности' },
  { id: 'gr-3-2', lessonId: 'lesson-11b-2', studentId: 'student-3', classId: '11B', date: '2026-09-08', grade: 5, score: 95, type: 'homework' },
  { id: 'gr-3-3', lessonId: 'lesson-11b-3', studentId: 'student-3', classId: '11B', date: '2026-09-11', grade: 5, score: 97, type: 'lab' },
];

/**
 * Generate synthetic roster & records for all students in a class if none exist
 */
export function ensureClassAttendanceAndGrades(
  students: User[],
  lessons: Lesson[],
  existingAttendance: AttendanceRecord[],
  existingGrades: LessonGradeRecord[]
): { attendance: AttendanceRecord[]; grades: LessonGradeRecord[] } {
  const attMap = new Map<string, AttendanceRecord>();
  const grMap = new Map<string, LessonGradeRecord>();

  existingAttendance.forEach(a => attMap.set(`${a.studentId}_${a.lessonId}`, a));
  existingGrades.forEach(g => grMap.set(`${g.studentId}_${g.lessonId}`, g));

  const newAttendance = [...existingAttendance];
  const newGrades = [...existingGrades];

  students.forEach(student => {
    const studentLessons = lessons.filter(l => 
      !l.classIds || l.classIds.length === 0 || (student.classId && l.classIds.includes(student.classId))
    );

    studentLessons.forEach((lesson, lIdx) => {
      const attKey = `${student.id}_${lesson.id}`;
      if (!attMap.has(attKey)) {
        // Deterministic realistic synthetic status based on student name hash
        const hash = (student.name.charCodeAt(0) + lIdx * 7) % 20;
        let status: AttendanceStatus = 'present';
        let minutesLate: number | undefined = undefined;
        let note: string | undefined = undefined;

        if (hash === 17) {
          status = 'absent';
          note = 'Пропуск без уважительной причины';
        } else if (hash === 18) {
          status = 'excused';
          note = 'По заявлению родителей';
        } else if (hash === 19) {
          status = 'late';
          minutesLate = 10;
        }

        const rec: AttendanceRecord = {
          id: `att-${student.id}-${lesson.id}`,
          lessonId: lesson.id,
          studentId: student.id,
          classId: student.classId || '10C',
          date: lesson.date || '2026-09-15',
          status,
          minutesLate,
          note
        };
        newAttendance.push(rec);
        attMap.set(attKey, rec);
      }

      const grKey = `${student.id}_${lesson.id}`;
      if (!grMap.has(grKey)) {
        const hash = (student.name.charCodeAt(student.name.length - 1) + lIdx * 3) % 10;
        let grade = 5;
        let score = 95;
        if (hash <= 2) {
          grade = 4;
          score = 82;
        } else if (hash === 3) {
          grade = 3;
          score = 68;
        } else {
          grade = 5;
          score = 94;
        }

        const gRec: LessonGradeRecord = {
          id: `gr-${student.id}-${lesson.id}`,
          lessonId: lesson.id,
          studentId: student.id,
          classId: student.classId || '10C',
          date: lesson.date || '2026-09-15',
          grade,
          score,
          type: lIdx % 2 === 0 ? 'classwork' : 'homework'
        };
        newGrades.push(gRec);
        grMap.set(grKey, gRec);
      }
    });
  });

  return { attendance: newAttendance, grades: newGrades };
}

/**
 * Calculates summary metrics for a class based on attendance & grades
 */
export function calculateClassMetrics(
  classId: string,
  className: string,
  students: User[],
  lessons: Lesson[],
  attendance: AttendanceRecord[],
  grades: LessonGradeRecord[]
): ClassReportSummary {
  const classStudents = students.filter(s => s.role === 'student' && (!classId || classId === 'all' || s.classId === classId));
  const studentIds = new Set(classStudents.map(s => s.id));
  const lessonIds = new Set(lessons.map(l => l.id));

  const relevantAttendance = attendance.filter(a => studentIds.has(a.studentId) && (lessons.length === 0 || lessonIds.has(a.lessonId)));
  const relevantGrades = grades.filter(g => studentIds.has(g.studentId) && (lessons.length === 0 || lessonIds.has(g.lessonId)));

  const totalPossibleSessions = relevantAttendance.length;
  const presentCount = relevantAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const excusedCount = relevantAttendance.filter(a => a.status === 'excused').length;
  const unexcusedCount = relevantAttendance.filter(a => a.status === 'absent').length;
  const totalAbsences = excusedCount + unexcusedCount;

  const attendancePercent = totalPossibleSessions > 0
    ? Math.round((presentCount / totalPossibleSessions) * 1000) / 10
    : 100;

  const validGrades = relevantGrades.map(g => g.grade).filter(g => typeof g === 'number' && g >= 2 && g <= 5);
  const avgGrade = validGrades.length > 0
    ? Math.round((validGrades.reduce((a, b) => a + b, 0) / validGrades.length) * 100) / 100
    : 4.5;

  const goodOrExcellent = validGrades.filter(g => g >= 4).length;
  const qualityPercent = validGrades.length > 0
    ? Math.round((goodOrExcellent / validGrades.length) * 100)
    : 85;

  const passing = validGrades.filter(g => g >= 3).length;
  const passingPercent = validGrades.length > 0
    ? Math.round((passing / validGrades.length) * 100)
    : 100;

  return {
    classId,
    className,
    totalStudents: classStudents.length,
    lessonsCount: lessons.length,
    averageGrade: avgGrade,
    qualityPercent,
    passingPercent,
    attendancePercent,
    totalAbsences,
    excusedAbsences: excusedCount,
    unexcusedAbsences: unexcusedCount
  };
}

/**
 * Export Class Report to Excel (.xlsx) file
 */
export function exportClassReportToExcel(params: {
  schoolClass?: SchoolClass;
  students: User[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  grades: LessonGradeRecord[];
  teacherName: string;
  quarter?: number | string;
}) {
  const { schoolClass, students, lessons, attendance, grades, teacherName, quarter } = params;

  const className = schoolClass?.name || 'Класс';
  const attMap = new Map<string, AttendanceRecord>();
  const grMap = new Map<string, LessonGradeRecord>();
  attendance.forEach(a => attMap.set(`${a.studentId}_${a.lessonId}`, a));
  grades.forEach(g => grMap.set(`${g.studentId}_${g.lessonId}`, g));

  // Build Table Data
  const headers = [
    '№',
    'ФИО Ученика',
    'Класс',
    ...lessons.map((l, i) => `Урок ${i + 1}: ${l.title.slice(0, 25)}`),
    'Средний балл',
    'Посещаемость (%)',
    'Пропусков (всего)',
    'Уважительных',
    'Неуважительных',
    'Итоговая оценка'
  ];

  const rows: any[][] = [];

  students.forEach((student, sIdx) => {
    let studentGradesSum = 0;
    let studentGradesCount = 0;
    let presentCount = 0;
    let totalLessonsCount = lessons.length;
    let excusedCount = 0;
    let absentCount = 0;

    const lessonCells = lessons.map(lesson => {
      const att = attMap.get(`${student.id}_${lesson.id}`);
      const gr = grMap.get(`${student.id}_${lesson.id}`);

      let attSymbol = '';
      if (att) {
        if (att.status === 'present') {
          attSymbol = 'П';
          presentCount++;
        } else if (att.status === 'late') {
          attSymbol = `О (${att.minutesLate || 5}м)`;
          presentCount++;
        } else if (att.status === 'excused') {
          attSymbol = 'У';
          excusedCount++;
        } else if (att.status === 'absent') {
          attSymbol = 'Н';
          absentCount++;
        }
      } else {
        attSymbol = 'П';
        presentCount++;
      }

      if (gr && typeof gr.grade === 'number') {
        studentGradesSum += gr.grade;
        studentGradesCount++;
        return `${gr.grade} [${attSymbol}]`;
      }

      return attSymbol || 'П';
    });

    const studentAvg = studentGradesCount > 0 ? (studentGradesSum / studentGradesCount).toFixed(2) : '5.00';
    const studentAttPercent = totalLessonsCount > 0 ? Math.round((presentCount / totalLessonsCount) * 100) : 100;
    const finalGrade = Math.round(Number(studentAvg));

    rows.push([
      sIdx + 1,
      student.name,
      className,
      ...lessonCells,
      studentAvg,
      `${studentAttPercent}%`,
      excusedCount + absentCount,
      excusedCount,
      absentCount,
      finalGrade
    ]);
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create worksheet
  const wsData = [
    ['ВЕДОМОСТЬ УСПЕВАЕМОСТИ И ПОСЕЩАЕМОСТИ УРОКОВ ИНФОРМАТИКИ И ИКТ'],
    [`Образовательное учреждение: Smart ICT School | Кабинет №304`],
    [`Класс: ${className} | Четверть: ${quarter || '1 четверть'} | Учебный год: 2026-2027`],
    [`Преподаватель: ${teacherName}`],
    [`Дата формирования отчета: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`],
    [], // empty row
    headers,
    ...rows,
    [],
    ['Условные обозначения:'],
    ['П — Присутствовал на уроке | О — Опоздание (мин) | У — Пропуск по уважительной причине | Н — Неявка без уважительной причины'],
    ['Формат ячейки урока: Оценка [Посещаемость] (например, 5 [П])']
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 10 },
    ...lessons.map(() => ({ wch: 18 })),
    { wch: 14 },
    { wch: 18 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, `Отчет_${className}`);

  // Trigger download
  const fileName = `Otchet_Uspevaemost_${className.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Export Student Performance Data and Grades to CSV file for record keeping
 */
export function exportStudentPerformanceToCSV(params: {
  schoolClass?: SchoolClass;
  students: User[];
  lessons: Lesson[];
  attendance: AttendanceRecord[];
  grades: LessonGradeRecord[];
  teacherName: string;
  quarter?: number | string;
}) {
  const { schoolClass, students, lessons, attendance, grades, teacherName, quarter } = params;
  const className = schoolClass?.name || '10-C';

  const attMap = new Map<string, AttendanceRecord>();
  const grMap = new Map<string, LessonGradeRecord>();
  attendance.forEach(a => attMap.set(`${a.studentId}_${a.lessonId}`, a));
  grades.forEach(g => grMap.set(`${g.studentId}_${g.lessonId}`, g));

  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines: string[] = [];

  // Metadata headers for official record keeping
  lines.push([escapeCsv('ВЕДОМОСТЬ УСПЕВАЕМОСТИ И ОЦЕНОК ПО ИНФОРМАТИКЕ И ИКТ')].join(';'));
  lines.push([escapeCsv(`Образовательное учреждение: Smart ICT School | Кабинет №304 | Преподаватель: ${teacherName}`)].join(';'));
  lines.push([escapeCsv(`Класс: ${className} | Отчетный период: ${quarter || 'Годовая ведомость'} | Учебный год: 2026-2027`)].join(';'));
  lines.push([escapeCsv(`Дата формирования архива: ${new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`)].join(';'));
  lines.push(''); // Empty row

  // Column headers
  const headerCols = [
    '№ п/п',
    'ФИО Учащегося',
    'Класс',
    'Email / ID',
    'Уровень',
    'Опыт (XP)',
    ...lessons.map((l, i) => `Урок ${i + 1}: ${l.title}`),
    'Средний балл',
    'Итоговая оценка',
    'Посещаемость (%)',
    'Всего пропусков',
    'Уважительных',
    'Неуважительных',
    'Статус успеваемости'
  ];
  lines.push(headerCols.map(escapeCsv).join(';'));

  // Rows
  students.forEach((student, sIdx) => {
    let studentGradesSum = 0;
    let studentGradesCount = 0;
    let presentCount = 0;
    const totalLessonsCount = lessons.length;
    let excusedCount = 0;
    let absentCount = 0;

    const lessonCols = lessons.map(lesson => {
      const att = attMap.get(`${student.id}_${lesson.id}`);
      const gr = grMap.get(`${student.id}_${lesson.id}`);

      let attCode = 'П';
      if (att) {
        if (att.status === 'present') {
          attCode = 'П';
          presentCount++;
        } else if (att.status === 'late') {
          attCode = `О (${att.minutesLate || 5}м)`;
          presentCount++;
        } else if (att.status === 'excused') {
          attCode = 'У';
          excusedCount++;
        } else if (att.status === 'absent') {
          attCode = 'Н';
          absentCount++;
        }
      } else {
        presentCount++;
      }

      if (gr && typeof gr.grade === 'number') {
        studentGradesSum += gr.grade;
        studentGradesCount++;
        return `${gr.grade} [${attCode}]`;
      }
      return attCode;
    });

    const avgNum = studentGradesCount > 0 ? studentGradesSum / studentGradesCount : 5;
    const studentAvg = avgNum.toFixed(2);
    const finalGrade = Math.round(avgNum);
    const attPercent = totalLessonsCount > 0 ? Math.round((presentCount / totalLessonsCount) * 100) : 100;
    const totalAbsences = excusedCount + absentCount;

    let performanceStatus = 'Успевает';
    if (avgNum >= 4.7) {
      performanceStatus = 'Отличник (высокий уровень)';
    } else if (avgNum >= 3.8) {
      performanceStatus = 'Хорошист (достаточный уровень)';
    } else if (avgNum >= 2.8) {
      performanceStatus = 'Удовлетворительно';
    } else {
      performanceStatus = 'Группа педагогического внимания';
    }

    const row = [
      sIdx + 1,
      student.name,
      className,
      student.email || student.id,
      student.level || 1,
      student.xp || 0,
      ...lessonCols,
      studentAvg,
      finalGrade,
      `${attPercent}%`,
      totalAbsences,
      excusedCount,
      absentCount,
      performanceStatus
    ];

    lines.push(row.map(escapeCsv).join(';'));
  });

  // Footer notes and legend
  lines.push('');
  lines.push([escapeCsv('УСЛОВНЫЕ ОБОЗНАЧЕНИЯ И СТРУКТУРА ЗАПИСИ:')].join(';'));
  lines.push([escapeCsv('Формат ячейки урока: Оценка [Посещаемость] (например: 5 [П] - оценка 5, присутствовал; 4 [О (5м)] - оценка 4, опоздал на 5 минут)')].join(';'));
  lines.push([escapeCsv('Коды посещаемости: П — Присутствовал; О — Опоздал; У — Пропуск по уважительной причине; Н — Неявка')].join(';'));
  lines.push([escapeCsv('Файл сформирован для архивного учета и ведения классного журнала по предмету Информатика и ИКТ')].join(';'));

  // UTF-8 BOM for flawless Excel and spreadsheet import across all platforms
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const cleanClassName = className.replace(/[^a-zA-Z0-9а-яА-Я]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('href', url);
  link.setAttribute('download', `Uspevaemost_${cleanClassName}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
