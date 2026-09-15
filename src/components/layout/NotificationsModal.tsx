import React from 'react';
import { X, Bell, CheckCircle2, Award, BookOpen, AlertCircle } from 'lucide-react';
import { AppNotification } from '../../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAllRead: () => void;
  onSelectLink: (link?: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications = [],
  onMarkAllRead,
  onSelectLink
}) => {
  if (!isOpen) return null;

  const safeNotifications = notifications || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl shadow-2xl border p-6 backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base">Уведомления</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Оценки, новые уроки и достижения
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action toolbar */}
        <div className="flex justify-between items-center py-2.5">
          <span className="text-xs text-neutral-500">
            Всего: {safeNotifications.length} (непрочитанных: {safeNotifications.filter(n => !n.read).length})
          </span>
          <button
            onClick={onMarkAllRead}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Отметить все как прочитанные
          </button>
        </div>

        {/* List */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {safeNotifications.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 text-sm">
              У вас пока нет новых уведомлений
            </div>
          ) : (
            notifications.map((notif) => {
              const getIcon = () => {
                switch (notif.type) {
                  case 'homework':
                    return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                  case 'achievement':
                    return <Award className="w-4 h-4 text-amber-500" />;
                  case 'announcement':
                    return <BookOpen className="w-4 h-4 text-blue-500" />;
                  default:
                    return <AlertCircle className="w-4 h-4 text-neutral-400" />;
                }
              };

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (notif.link) {
                      onSelectLink(notif.link);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    !notif.read
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                      : 'bg-neutral-50/50 dark:bg-neutral-800/30 border-neutral-100 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="mt-0.5">{getIcon()}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-neutral-400">{notif.date}</span>
                      </div>
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            Закрыть
          </button>
        </div>

      </div>
    </div>
  );
};
