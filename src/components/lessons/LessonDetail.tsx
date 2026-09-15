import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Monitor,
  Video,
  FileText,
  Terminal,
  Home,
  Bookmark,
  CheckCircle2,
  Bot,
  Award,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Lesson, User, HomeworkSubmission } from '../../types';
import { NotesCard } from './cards/NotesCard';
import { PresentationCard } from './cards/PresentationCard';
import { ConceptCardsView } from './cards/ConceptCardsView';
import { VideoCard } from './cards/VideoCard';
import { PdfCard } from './cards/PdfCard';
import { LabCard } from './cards/LabCard';
import { HomeworkCard } from './cards/HomeworkCard';
import { ExtraCard } from './cards/ExtraCard';
import { TestRunnerModal } from './cards/TestRunnerModal';
import { AiAssistantDrawer } from './cards/AiAssistantDrawer';
import { Breadcrumbs } from '../layout/Breadcrumbs';
import { Link } from '../../router/RouterContext';

interface LessonDetailProps {
  lesson: Lesson;
  currentUser: User;
  submission?: HomeworkSubmission;
  onBack: () => void;
  onMarkCompleted: (lessonId: string) => void;
  onSubmitHomework: (files: { name: string; size: string; content?: string }[], studentComment: string) => void;
  onCompleteTest: (score: number, maxScore: number, xpEarned: number) => void;
}

export type LessonCardType = 
  | 'cards'
  | 'notes'
  | 'slides'
  | 'video'
  | 'pdf'
  | 'lab'
  | 'homework'
  | 'extra'
  | 'test'
  | 'ai';

export const LessonDetail: React.FC<LessonDetailProps> = ({
  lesson,
  currentUser,
  submission,
  onBack,
  onMarkCompleted,
  onSubmitHomework,
  onCompleteTest
}) => {
  const [activeCard, setActiveCard] = useState<LessonCardType>('notes');
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [codeForAi, setCodeForAi] = useState<string | undefined>(undefined);

  const isCompleted = currentUser.completedLessons.includes(lesson.id);

  const handleComplete = () => {
    if (!isCompleted) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
      onMarkCompleted(lesson.id);
    }
  };

  const cardsList: { id: LessonCardType; label: string; icon: any; count?: string }[] = [
    { id: 'cards', label: '0. Карточки', icon: Sparkles, count: `${lesson.conceptCards?.length || 3}` },
    { id: 'notes', label: '1. Конспект', icon: BookOpen },
    { id: 'slides', label: '2. Слайды', icon: Monitor, count: `${lesson.slides.length}` },
    { id: 'video', label: '3. Видеоурок', icon: Video, count: `${lesson.video.durationMinutes}м` },
    { id: 'pdf', label: '4. PDF Пособие', icon: FileText },
    { id: 'lab', label: '5. Python Лаба', icon: Terminal },
    { id: 'homework', label: '6. Домашка', icon: Home, count: submission ? 'Сдано' : 'Не сдано' },
    { id: 'extra', label: '7. Допматериалы', icon: Bookmark, count: `${lesson.extraMaterials.length}` },
    { id: 'test', label: '8. Тест', icon: CheckCircle2, count: `+${lesson.test.rewardXp}XP` },
    { id: 'ai', label: '9. AI Тьютор', icon: Bot },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 animate-in fade-in duration-300">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Каталог уроков', to: '/lessons' },
          { label: `${lesson.grade} класс` },
          { label: lesson.title, current: true }
        ]}
      />

      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="space-y-1.5">
          <Link
            to="/lessons"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Вернуться ко всем урокам</span>
          </Link>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {lesson.grade} класс · Урок #{lesson.orderNumber}
            </span>
            <span className="text-xs text-neutral-400">{lesson.topic}</span>
            <span className="text-xs text-neutral-400">· {lesson.durationMinutes} мин</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900 dark:text-white">
            {lesson.title}
          </h1>
        </div>

        {/* Complete Lesson Action & XP */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setAiDrawerOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors flex items-center space-x-1.5"
          >
            <Bot className="w-4 h-4" />
            <span>AI Помощник</span>
          </button>

          <button
            onClick={handleComplete}
            disabled={isCompleted}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
              isCompleted
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'Урок завершен (+50 XP)' : 'Отметить как изученный'}</span>
          </button>
        </div>
      </div>

      {/* 9 Cards Pill Navigation Bar */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 border-b border-neutral-200 dark:border-neutral-800">
        {cardsList.map((card) => {
          const Icon = card.icon;
          const isActive = activeCard === card.id;
          return (
            <button
              key={card.id}
              onClick={() => {
                if (card.id === 'test') {
                  setTestModalOpen(true);
                } else if (card.id === 'ai') {
                  setAiDrawerOpen(true);
                } else {
                  setActiveCard(card.id);
                }
              }}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center space-x-2 transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{card.label}</span>
              {card.count && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  isActive ? 'bg-white/20 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                }`}>
                  {card.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Card Body */}
      <div className="pt-2">
        {activeCard === 'cards' && (
          <ConceptCardsView cards={lesson.conceptCards} lessonTitle={lesson.title} />
        )}

        {activeCard === 'notes' && (
          <NotesCard notes={lesson.notes} lessonTitle={lesson.title} />
        )}

        {activeCard === 'slides' && (
          <PresentationCard slides={lesson.slides} lessonTitle={lesson.title} />
        )}

        {activeCard === 'video' && (
          <VideoCard video={lesson.video} lessonTitle={lesson.title} />
        )}

        {activeCard === 'pdf' && (
          <PdfCard pdf={lesson.pdf} lessonTitle={lesson.title} />
        )}

        {activeCard === 'lab' && (
          <LabCard
            lab={lesson.lab}
            onOpenAiWithCode={(code) => {
              setCodeForAi(code);
              setAiDrawerOpen(true);
            }}
          />
        )}

        {activeCard === 'homework' && (
          <HomeworkCard
            homework={lesson.homework}
            lessonTitle={lesson.title}
            currentUser={currentUser}
            submission={submission}
            onSubmitHomework={onSubmitHomework}
          />
        )}

        {activeCard === 'extra' && (
          <ExtraCard materials={lesson.extraMaterials} lessonTitle={lesson.title} />
        )}
      </div>

      {/* Test Runner Modal */}
      <TestRunnerModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        test={lesson.test}
        lessonTitle={lesson.title}
        onCompleteTest={onCompleteTest}
      />

      {/* AI Assistant Drawer */}
      <AiAssistantDrawer
        isOpen={aiDrawerOpen}
        onClose={() => {
          setAiDrawerOpen(false);
          setCodeForAi(undefined);
        }}
        lesson={lesson}
        studentCode={codeForAi}
        studentClass={currentUser.classId}
      />

    </div>
  );
};
