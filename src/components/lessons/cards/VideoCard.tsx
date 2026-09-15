import React, { useState } from 'react';
import { Play, Clock, ListChecks, ExternalLink, Video } from 'lucide-react';
import { LessonVideo } from '../../../types';

interface VideoCardProps {
  video: LessonVideo;
  lessonTitle: string;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, lessonTitle }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  return (
    <div className="space-y-6">
      
      {/* Video Container (16:9) */}
      <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-950 shadow-xl group">
        
        {isPlaying ? (
          <iframe
            src={`${video.youtubeUrl}?autoplay=1`}
            title={video.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="relative w-full h-full">
            <img
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent" />
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <button
                onClick={() => setIsPlaying(true)}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-2xl shadow-blue-500/50 hover:scale-110 transition-all cursor-pointer"
              >
                <Play className="w-8 h-8 fill-white ml-1" />
              </button>
              <div className="mt-3 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold">
                Смотреть видеоурок ({video.durationMinutes} минут)
              </div>
            </div>

            {/* Bottom Title Bar */}
            <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-white">
              <div>
                <h3 className="text-base sm:text-lg font-bold">{video.title}</h3>
                <p className="text-xs text-neutral-300 mt-0.5">Преподаватель ИКТ М.Р. Абдугафоров</p>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Chapters & Timestamps */}
      <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center space-x-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            <span>Таймкоды и главы видеоурока</span>
          </h4>
          <span className="text-xs text-neutral-400">
            {video.chapters.length} ключевых фрагментов
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {video.chapters.map((chap, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveChapterIndex(idx);
                setIsPlaying(true);
              }}
              className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                activeChapterIndex === idx
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'bg-neutral-50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100'
              }`}
            >
              <span className="text-xs">{chap.title}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold">
                {chap.time}
              </span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
