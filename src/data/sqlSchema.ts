export const POSTGRESQL_DDL_SCHEMA = `-- ==============================================================================
-- Smart ICT Educational Platform — Full PostgreSQL & Supabase Database Architecture
-- Production Schema with Row Level Security (RLS), Triggers, and Foreign Keys
-- Designed for Computer Science Teacher LMS (Google Classroom + Notion + Moodle)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Full-text & trigram search

-- 2. ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE question_type AS ENUM ('single', 'multiple', 'code', 'matching', 'open', 'ordering');
CREATE TYPE submission_status AS ENUM ('draft', 'submitted', 'graded', 'needs_revision');
CREATE TYPE notification_type AS ENUM ('homework', 'test', 'achievement', 'announcement', 'system');

-- ==============================================================================
-- 3. CORE ENTITIES
-- ==============================================================================

-- Classes (e.g. 7A, 10C, 11B)
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(20) NOT NULL UNIQUE,
    grade INT NOT NULL CHECK (grade BETWEEN 1 AND 11),
    curator_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (Linked with Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    avatar_url TEXT,
    bio TEXT,
    xp_points INT NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    streak_days INT NOT NULL DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects (Информатика, Крафтинг & Робототехника)
CREATE TABLE public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) DEFAULT 'code',
    description TEXT,
    color_hex VARCHAR(20) DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons
CREATE TABLE public.lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    grade INT NOT NULL CHECK (grade BETWEEN 1 AND 11),
    order_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT DEFAULT 45,
    is_published BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_grade_order UNIQUE (subject_id, grade, order_number)
);

-- Lesson to Class Mapping (Many-to-Many access control)
CREATE TABLE public.lesson_classes (
    lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, class_id)
);

-- Lesson Cards Content (JSONB + Normalized payload for 9 Cards)
CREATE TABLE public.lesson_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
    card_type VARCHAR(50) NOT NULL, -- notes, presentation, video, pdf, lab, homework, extra, test, ai
    title VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. TESTS & ASSESSMENTS
-- ==============================================================================

CREATE TABLE public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    time_limit_minutes INT DEFAULT 20,
    passing_score INT DEFAULT 70,
    total_points INT DEFAULT 100,
    shuffle_questions BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.test_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    type question_type NOT NULL DEFAULT 'single',
    prompt TEXT NOT NULL,
    code_snippet TEXT,
    options JSONB, -- list of { id, text }
    correct_answers JSONB NOT NULL, -- correct option ids or text or matching pairs
    explanation TEXT,
    points INT DEFAULT 10,
    order_index INT NOT NULL DEFAULT 0
);

CREATE TABLE public.test_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    score INT NOT NULL,
    max_score INT NOT NULL,
    passed BOOLEAN NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    time_spent_seconds INT,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. HOMEWORK & SUBMISSIONS
-- ==============================================================================

CREATE TABLE public.homework_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID UNIQUE REFERENCES public.lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    max_score INT DEFAULT 100,
    allowed_formats TEXT[] DEFAULT ARRAY['pdf', 'docx', 'pptx', 'py', 'zip', 'png', 'mp4'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    homework_id UUID NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status submission_status DEFAULT 'submitted',
    score INT CHECK (score >= 0),
    teacher_feedback TEXT,
    graded_by UUID REFERENCES public.profiles(id),
    student_comment TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    CONSTRAINT unique_homework_student UNIQUE (homework_id, student_id)
);

CREATE TABLE public.homework_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. GAMIFICATION & SOCIAL
-- ==============================================================================

CREATE TABLE public.badges (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    xp_reward INT NOT NULL DEFAULT 50
);

CREATE TABLE public.user_badges (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    badge_id VARCHAR(50) REFERENCES public.badges(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type notification_type DEFAULT 'system',
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE, -- NULL = all classes
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. PERFORMANCE INDEXES
-- ==============================================================================

CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_class ON public.profiles(class_id);
CREATE INDEX idx_lessons_subject_grade ON public.lessons(subject_id, grade);
CREATE INDEX idx_lesson_cards_lesson ON public.lesson_cards(lesson_id);
CREATE INDEX idx_homework_submissions_hw_student ON public.homework_submissions(homework_id, student_id);
CREATE INDEX idx_test_submissions_test_student ON public.test_submissions(test_id, student_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = FALSE;

-- Full-text GIN search index for lessons and notes
CREATE INDEX idx_lessons_title_trgm ON public.lessons USING gin (title gin_trgm_ops);
CREATE INDEX idx_lessons_topic_trgm ON public.lessons USING gin (topic gin_trgm_ops);

-- ==============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to check current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: Anyone authenticated can read user names/avatars; only self or admin can update
CREATE POLICY "Public profiles are readable" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Lessons: Students can ONLY select lessons mapped to their class
CREATE POLICY "Students see class lessons only" ON public.lessons
    FOR SELECT TO authenticated USING (
        public.get_user_role() IN ('admin', 'teacher')
        OR EXISTS (
            SELECT 1 FROM public.lesson_classes lc
            JOIN public.profiles p ON p.class_id = lc.class_id
            WHERE lc.lesson_id = lessons.id AND p.id = auth.uid()
        )
    );

CREATE POLICY "Teachers and admins can manage lessons" ON public.lessons
    FOR ALL TO authenticated USING (
        public.get_user_role() IN ('admin', 'teacher')
    );

-- Homework Submissions: Students see and submit their own; teachers see all
CREATE POLICY "Students see own submissions" ON public.homework_submissions
    FOR SELECT TO authenticated USING (
        student_id = auth.uid() OR public.get_user_role() IN ('teacher', 'admin')
    );

CREATE POLICY "Students can insert own submissions" ON public.homework_submissions
    FOR INSERT TO authenticated WITH CHECK (
        student_id = auth.uid()
    );

CREATE POLICY "Teachers can grade submissions" ON public.homework_submissions
    FOR UPDATE TO authenticated USING (
        public.get_user_role() IN ('teacher', 'admin')
    );

-- Notifications: User can only see their own
CREATE POLICY "User notifications private" ON public.notifications
    FOR ALL TO authenticated USING (user_id = auth.uid());
`;

export const ER_DIAGRAM_MERMAID = `erDiagram
    PROFILES ||--o{ CLASSES : "belongs to (students)"
    CLASSES ||--o{ LESSON_CLASSES : "has access to"
    LESSONS ||--o{ LESSON_CLASSES : "assigned to"
    SUBJECTS ||--o{ LESSONS : "contains"
    LESSONS ||--o{ LESSON_CARDS : "consists of (9 types)"
    LESSONS ||--o| TESTS : "assesses"
    TESTS ||--o{ TEST_QUESTIONS : "has questions"
    TESTS ||--o{ TEST_SUBMISSIONS : "taken by students"
    PROFILES ||--o{ TEST_SUBMISSIONS : "scores"
    LESSONS ||--o| HOMEWORK_ASSIGNMENTS : "tasks"
    HOMEWORK_ASSIGNMENTS ||--o{ HOMEWORK_SUBMISSIONS : "completed by"
    PROFILES ||--o{ HOMEWORK_SUBMISSIONS : "submits"
    HOMEWORK_SUBMISSIONS ||--o{ HOMEWORK_FILES : "attaches (.py, pdf, docx, zip)"
    PROFILES ||--o{ USER_BADGES : "earns"
    BADGES ||--o{ USER_BADGES : "awarded to"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    PROFILES ||--o{ ANNOUNCEMENTS : "posts / views"
`;

export interface ErdTable {
  name: string;
  description: string;
  columns: { name: string; type: string }[];
  relations?: string[];
}

export const DATABASE_ERD_TABLES: ErdTable[] = [
  {
    name: 'classes',
    description: 'Учебные классы (параллели 7-11: 7-A, 10-C, 11-B) со связью с куратором',
    columns: [
      { name: 'id', type: 'UUID (PK)' },
      { name: 'name', type: 'VARCHAR(20) UNIQUE' },
      { name: 'grade', type: 'INT (1..11)' },
      { name: 'curator_id', type: 'UUID (FK -> profiles)' },
      { name: 'student_count', type: 'INT' }
    ],
    relations: ['profiles (1:N)', 'lesson_classes (1:N)']
  },
  {
    name: 'profiles',
    description: 'Профили пользователей (учителя, ученики, админы) с интеграцией Supabase Auth',
    columns: [
      { name: 'id', type: 'UUID (PK -> auth.users)' },
      { name: 'email', type: 'VARCHAR(255) UNIQUE' },
      { name: 'full_name', type: 'VARCHAR(150)' },
      { name: 'role', type: 'user_role (ENUM)' },
      { name: 'class_id', type: 'UUID (FK -> classes)' },
      { name: 'xp_points', type: 'INT' },
      { name: 'level', type: 'INT' },
      { name: 'streak_days', type: 'INT' }
    ],
    relations: ['classes (N:1)', 'homework_submissions (1:N)', 'user_badges (1:N)']
  },
  {
    name: 'subjects',
    description: 'Учебные предметы и факультативы (Информатика, Крафтинг, Робототехника)',
    columns: [
      { name: 'id', type: 'UUID (PK)' },
      { name: 'name', type: 'VARCHAR(100)' },
      { name: 'slug', type: 'VARCHAR(100) UNIQUE' },
      { name: 'color_hex', type: 'VARCHAR(20)' }
    ],
    relations: ['lessons (1:N)']
  },
  {
    name: 'lessons',
    description: 'Интерактивные уроки с метаданными и доступом по классам',
    columns: [
      { name: 'id', type: 'UUID (PK)' },
      { name: 'subject_id', type: 'UUID (FK -> subjects)' },
      { name: 'grade', type: 'INT' },
      { name: 'title', type: 'VARCHAR(255)' },
      { name: 'topic', type: 'VARCHAR(255)' },
      { name: 'order_number', type: 'INT' },
      { name: 'quarter', type: 'INT' }
    ],
    relations: ['lesson_classes (1:N)', 'lesson_cards (1:N)', 'homework_submissions (1:N)']
  },
  {
    name: 'homework_submissions',
    description: 'Сданные домашние работы учеников с прикрепленными файлами и рецензией учителя',
    columns: [
      { name: 'id', type: 'UUID (PK)' },
      { name: 'lesson_id', type: 'UUID (FK -> lessons)' },
      { name: 'student_id', type: 'UUID (FK -> profiles)' },
      { name: 'score', type: 'INT' },
      { name: 'max_score', type: 'INT' },
      { name: 'teacher_feedback', type: 'TEXT' },
      { name: 'status', type: 'submission_status (ENUM)' }
    ],
    relations: ['lessons (N:1)', 'profiles (N:1)', 'homework_files (1:N)']
  },
  {
    name: 'tests',
    description: 'Онлайн-тестирование с таймером, случайным перемешиванием и автопроверкой',
    columns: [
      { name: 'id', type: 'UUID (PK)' },
      { name: 'lesson_id', type: 'UUID (FK -> lessons)' },
      { name: 'title', type: 'VARCHAR(255)' },
      { name: 'time_limit_minutes', type: 'INT' },
      { name: 'total_points', type: 'INT' }
    ],
    relations: ['test_questions (1:N)', 'test_submissions (1:N)']
  }
];

export interface ArchLayer {
  name: string;
  responsibility: string;
  modules: string[];
}

export const SYSTEM_ARCHITECTURE_LAYERS: ArchLayer[] = [
  {
    name: '1. Presentation Layer (UI / UX)',
    responsibility: 'Пользовательский интерфейс Next.js/React, Tailwind CSS, shadcn, motion',
    modules: ['StudentDashboard', 'TeacherDashboard', 'LessonCards (9 cards)', 'TestRunnerModal', 'SpotlightSearch']
  },
  {
    name: '2. Application / Service Layer',
    responsibility: 'Бизнес-логика, проверка решений на Python, RAG ассистент, геймификация',
    modules: ['PythonEvalService', 'GeminiAiService', 'GamificationEngine', 'HomeworkReviewService']
  },
  {
    name: '3. Domain Layer',
    responsibility: 'Сущности предметной области, валидация Zod, права доступа RBAC',
    modules: ['User & Profile Entities', 'Class & Grade Models', 'Lesson Aggregate', 'Test Evaluation Spec']
  },
  {
    name: '4. Infrastructure & Persistence Layer',
    responsibility: 'Supabase PostgreSQL, RLS политики, Express API, Storage Buckets',
    modules: ['PostgreSQL 16 Engine', 'Row Level Security Rules', 'Supabase Storage (.py, .pdf)', 'Express Server API']
  }
];

