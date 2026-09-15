import React, { useState } from 'react';
import {
  Award,
  Flame,
  Trophy,
  Medal,
  Star,
  Sparkles,
  Zap,
  TrendingUp,
  CheckCircle2,
  Lock,
  ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { User, GamificationBadge, SchoolClass } from '../../types';

interface GamificationViewProps {
  currentUser: User;
  allUsers: User[];
  badges: GamificationBadge[];
  classes: SchoolClass[];
}

export const GamificationView: React.FC<GamificationViewProps> = ({
  currentUser,
  allUsers = [],
  badges = [],
  classes = []
}) => {
  const [leaderboardScope, setLeaderboardScope] = useState<'class' | 'school'>('class');

  const safeUsers = allUsers || [];
  const safeBadges = badges || [];
  const safeClasses = classes || [];

  const currentClass = safeClasses.find(c => c.id === currentUser?.classId);

  // Filter and sort students for leaderboard
  const students = safeUsers.filter(u => u.role === 'student');
  const classStudents = currentClass 
    ? students.filter(u => u.classId === currentClass.id) 
    : students;

  const activeLeaderboard = (leaderboardScope === 'class' ? classStudents : students)
    .sort((a, b) => (b.xp || 0) - (a.xp || 0));

  const handleConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.5 }
    });
  };

  const unlockedBadgesCount = safeBadges.filter(b => b.unlocked).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white p-6 sm:p-8 shadow-xl shadow-orange-500/15">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-black/20 backdrop-blur-md text-xs font-semibold">
              <Trophy className="w-3.5 h-3.5 text-amber-200" />
              <span>Геймификация и рейтинг успеваемости</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Зал славы юных программистов 🏆
            </h1>

            <p className="text-xs sm:text-sm text-orange-100 max-w-xl leading-relaxed">
              Зарабатывайте опыт (XP) за просмотр уроков, решение практических задач на Python, своевременную сдачу домашних заданий и идеальные тесты.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleConfetti}
              className="px-5 py-3 rounded-2xl bg-white text-orange-600 hover:bg-orange-50 font-bold text-xs shadow-lg transition-all flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Салют победителю!</span>
            </button>
          </div>
        </div>

        {/* User stats capsule inside banner */}
        <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div>
            <div className="text-[11px] text-orange-200 uppercase font-bold">Ваш текущий ранг</div>
            <div className="text-2xl font-black text-white mt-0.5">Уровень {currentUser.level}</div>
          </div>
          <div>
            <div className="text-[11px] text-orange-200 uppercase font-bold">Накоплено XP</div>
            <div className="text-2xl font-black text-amber-200 mt-0.5">{currentUser.xp} XP</div>
          </div>
          <div>
            <div className="text-[11px] text-orange-200 uppercase font-bold">Серия непрерывных дней</div>
            <div className="text-2xl font-black text-white mt-0.5 flex items-center space-x-1">
              <Flame className="w-6 h-6 fill-white" />
              <span>{currentUser.streakDays} дней</span>
            </div>
          </div>
          <div>
            <div className="text-[11px] text-orange-200 uppercase font-bold">Открыто значков</div>
            <div className="text-2xl font-black text-white mt-0.5">
              {unlockedBadgesCount} / {badges.length}
            </div>
          </div>
        </div>
      </div>

      {/* Streak Calendar Tracker */}
      <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Серия активности на этой неделе
            </h3>
          </div>
          <span className="text-xs text-neutral-400">
            Занимайтесь каждый день для сохранения множителя XP
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {[
            { day: 'Пн', date: '7 окт', active: true },
            { day: 'Вт', date: '8 окт', active: true },
            { day: 'Ср', date: '9 окт', active: true },
            { day: 'Чт', date: '10 окт', active: true },
            { day: 'Пт', date: '11 окт', active: true },
            { day: 'Сб', date: '12 окт', active: true },
            { day: 'Вс', date: '13 окт', active: false },
          ].map((slot, i) => (
            <div
              key={i}
              className={`p-3 rounded-2xl text-center border transition-all ${
                slot.active
                  ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/80 text-orange-700 dark:text-orange-300 shadow-sm'
                  : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800 text-neutral-400'
              }`}
            >
              <div className="text-[11px] font-bold">{slot.day}</div>
              <div className="my-1 text-lg">
                {slot.active ? '🔥' : '⚪'}
              </div>
              <div className="text-[10px]">{slot.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Badges (2 cols) & Leaderboard (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Badges Collection (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Коллекция значков и ачивок ({unlockedBadgesCount} из {badges.length})</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-5 rounded-3xl border transition-all flex items-start space-x-4 ${
                  badge.unlocked
                    ? 'bg-white dark:bg-neutral-900 border-amber-300/80 dark:border-amber-800/60 shadow-sm'
                    : 'bg-neutral-50/50 dark:bg-neutral-900/40 border-neutral-200 dark:border-neutral-800 opacity-60'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  badge.unlocked
                    ? 'bg-amber-100 dark:bg-amber-950/60 ring-2 ring-amber-400/40'
                    : 'bg-neutral-200 dark:bg-neutral-800'
                }`}>
                  {badge.icon}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                      {badge.title}
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                      +{badge.xpReward} XP
                    </span>
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    {badge.description}
                  </p>

                  <div className="pt-1 flex items-center space-x-1.5 text-[10px] font-semibold">
                    {badge.unlocked ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Разблокировано</span>
                      </span>
                    ) : (
                      <span className="text-neutral-400 flex items-center space-x-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>В процессе выполнения</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Лидерборд</span>
            </h3>

            {/* Scope toggle */}
            <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-0.5 text-xs font-semibold">
              <button
                onClick={() => setLeaderboardScope('class')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  leaderboardScope === 'class'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-neutral-500'
                }`}
              >
                Мой класс
              </button>
              <button
                onClick={() => setLeaderboardScope('school')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  leaderboardScope === 'school'
                    ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-neutral-500'
                }`}
              >
                Вся школа
              </button>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
            {activeLeaderboard.map((student, idx) => {
              const isCurrentUser = student.id === currentUser.id;
              return (
                <div
                  key={student.id}
                  className={`p-3 rounded-2xl flex items-center justify-between transition-all ${
                    isCurrentUser
                      ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Rank medal */}
                    <div className="w-6 text-center font-bold text-xs">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
                    </div>

                    <img
                      src={student.avatarUrl}
                      alt=""
                      className="w-8 h-8 rounded-xl object-cover ring-1 ring-neutral-200 dark:ring-neutral-700"
                    />

                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-white line-clamp-1">
                        {student.name} {isCurrentUser && '(Вы)'}
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        {classes.find(c => c.id === student.classId)?.name || 'Класс'} · Ур. {student.level}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-amber-500">
                      {student.xp} XP
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      🔥 {student.streakDays} дн.
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
