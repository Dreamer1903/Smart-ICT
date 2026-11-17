export interface TTEntry {
  id: number;
  class_id: number;
  class_name: string;
  subject_id: number;
  subject_name: string;
  subject_short: string | null;
  teacher_id: number;
  teacher_name: string;
  room_id: number | null;
  room_name: string | null;
  day: number;
  slot: number;
  locked: boolean;
}

export interface Bells {
  days: number[];
  day_names: Record<string, string>;
  slots: { number: number; start_time: string; end_time: string }[];
}

export interface TTReport {
  lessons_placed: number;
  lessons_planned: number;
  conflicts: string[];
  wishes_violated: string[];
  class_gaps: string[];
  teacher_windows: Record<string, number>;
  teacher_load: Record<string, number>;
  class_days: Record<string, Record<string, number>>;
  ok: boolean;
  solver?: { status: string; seconds: number };
}

export interface TTVersion {
  id: number;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  created_at: string;
  published_at: string | null;
  summary: { lessons_placed: number; lessons_planned: number; conflicts: number; wishes_violated: number; class_gaps: number; ok: boolean };
  report?: TTReport;
  entries?: TTEntry[];
}
