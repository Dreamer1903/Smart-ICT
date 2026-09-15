export type UserRole = 'admin' | 'teacher' | 'student';

export interface User {
  id: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  classId?: string; // e.g. "10C", "7A", "11B"
  avatarUrl?: string;
  xp: number;
  level: number;
  streakDays: number;
  completedLessons: string[];
  badges: string[];
  bio?: string;
  registeredAt: string;
}

export interface SchoolClass {
  id: string;
  name: string; // "10-C", "7-A", "11-B", etc.
  grade: number; // 5 to 11
  letter?: string;
  academicYear?: string;
  studentCount: number;
  description?: string;
}

export interface Subject {
  id: string;
  name: string; // "Информатика", "Крафтинг", "Web-технологии"
  slug: string;
  icon?: string;
  description: string;
  color: string;
  lessonCount: number;
}

export type LessonCardType = 
  | 'notes'
  | 'slides'
  | 'video'
  | 'pdf'
  | 'lab'
  | 'homework'
  | 'extra'
  | 'test'
  | 'ai';

export interface LessonNotesSection {
  title: string;
  content: string;
  codeExample?: string;
  codeLanguage?: string;
}

export interface LessonNotes {
  sections: LessonNotesSection[];
  keyTakeaways?: string[];
  readTimeMinutes?: number;
}

export interface LessonSlide {
  id: string;
  title: string;
  bullets: string[];
  codeSnippet?: string;
  slideNumber?: number;
}

export interface LessonVideo {
  title: string;
  durationMinutes: number;
  youtubeUrl: string;
  thumbnailUrl: string;
  chapters?: { time: string; title: string }[];
}

export interface LessonPdf {
  title: string;
  fileSize: string;
  pageCount: number;
  url: string;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
}

export interface LessonLab {
  title: string;
  instructions: string;
  starterCode: string;
  testCases: TestCase[];
  hint?: string;
  solutionCode?: string;
}

export interface LessonHomework {
  title: string;
  description: string;
  deadline: string;
  maxScore: number;
  criteria?: string[];
  allowedFormats?: string[];
}

export interface LessonExtraMaterial {
  id: string;
  title: string;
  type: 'book' | 'article' | 'cheat_sheet' | 'doc' | string;
  url: string;
  description: string;
}

export type QuestionType = 
  | 'single_choice'
  | 'multiple_choice'
  | 'code_output'
  | 'fill_in_the_blank'
  | 'single'
  | 'multiple'
  | 'code'
  | 'matching'
  | 'open'
  | 'ordering';

export interface TestQuestion {
  id: string;
  text?: string;
  prompt?: string;
  type: QuestionType | string;
  codeSnippet?: string;
  options?: string[] | { id: string; text: string }[];
  correctAnswer?: any;
  correctOptionIds?: string[];
  explanation?: string;
  points: number;
}

export interface LessonTest {
  id?: string;
  lessonId?: string;
  title: string;
  timeLimitMinutes: number;
  rewardXp: number;
  questions: TestQuestion[];
}

export interface Test {
  id: string;
  lessonId: string;
  title: string;
  timeLimitMinutes: number;
  totalPoints: number;
  passingScore: number;
  questions: any[];
}

export interface ConceptCard {
  id: string;
  term: string;
  definition: string;
  codeSnippet?: string;
  keyRule?: string;
}

export interface Lesson {
  id: string;
  title: string;
  slug?: string;
  topic: string;
  description: string;
  subjectId: string;
  grade: number; // 5..11
  classIds: string[]; // ["10C", "7A", etc.]
  targetClassIds?: string[];
  quarter: number;
  orderNumber: number;
  date: string;
  durationMinutes: number;
  published?: boolean;
  notes: LessonNotes;
  slides: LessonSlide[];
  conceptCards?: ConceptCard[];
  video: LessonVideo;
  pdf: LessonPdf;
  lab: LessonLab;
  homework: LessonHomework;
  extraMaterials: LessonExtraMaterial[];
  test: LessonTest;
  cards?: any;
}

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  lessonId: string;
  lessonTitle: string;
  studentId: string;
  studentName: string;
  studentAvatar?: string;
  classId: string;
  submittedAt: string;
  status: 'submitted' | 'graded' | 'needs_revision';
  score?: number;
  maxScore: number;
  teacherFeedback?: string;
  gradedAt?: string;
  files: {
    name: string;
    size: string;
    type?: string;
    content?: string;
  }[];
  studentComment?: string;
}

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  category?: string;
  xpReward: number;
  unlocked: boolean;
  progressPercent: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'homework' | 'test' | 'achievement' | 'announcement' | 'system';
  date: string;
  read: boolean;
  link?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  authorName: string;
  date: string;
  targetClassIds: string[];
  pinned?: boolean;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface AttendanceRecord {
  id: string;
  lessonId: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatus;
  minutesLate?: number;
  note?: string;
}

export interface LessonGradeRecord {
  id: string;
  lessonId: string;
  studentId: string;
  classId: string;
  date: string;
  grade: number; // 2, 3, 4, 5
  score?: number; // 0..100
  type: 'classwork' | 'homework' | 'test' | 'lab' | 'quarter';
  comment?: string;
}

export interface ClassReportSummary {
  classId: string;
  className: string;
  totalStudents: number;
  lessonsCount: number;
  averageGrade: number;
  qualityPercent: number; // % of 4 and 5
  passingPercent: number; // % without 2
  attendancePercent: number;
  totalAbsences: number;
  excusedAbsences: number;
  unexcusedAbsences: number;
}
