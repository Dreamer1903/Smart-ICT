import React, { useState } from 'react';
import { X, Send, Bot, Sparkles, Code, HelpCircle, RefreshCw, Terminal } from 'lucide-react';
import { Lesson } from '../../../types';

interface AiAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lesson?: Lesson;
  studentCode?: string;
  studentClass?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  isOpen,
  onClose,
  lesson,
  studentCode,
  studentClass
}) => {
  if (!isOpen) return null;

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Привет! Я интеллектуальный AI-помощник преподавателя информатики и ИКТ Абдугафорова М.Р. 
Я знаю методические материалы урока **«${lesson?.title || 'Информатика и алгоритмы'}»** и готов помочь разобраться со сложными понятиями, объяснить ошибку в Python или привести жизненную аналогию! 

*Помните: я не даю готовых решений ДЗ «под ключ», но подскажу логику и направлю к правильному ответу.*`,
      source: 'knowledge-base'
    }
  ]);

  const quickPrompts = [
    'Объясни эту тему простыми словами с жизненным примером',
    'В чем разница между стеком и очередью?',
    'Помоги найти ошибку в синтаксисе моей программы',
    'Какая асимптотическая сложность у этой операции?'
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: query };
    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/cs-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          lessonTitle: lesson?.title,
          lessonTopic: lesson?.topic,
          curriculumContext: lesson?.notes.sections.map(s => `${s.title}: ${s.content}`).join('\n\n'),
          studentCode: studentCode || undefined,
          studentClass: studentClass || '10-C'
        })
      });

      const data = await res.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply || 'Не удалось получить ответ. Попробуйте еще раз.',
        source: data.source
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Произошла ошибка связи с сервером ассистента. Проверьте подключение.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-neutral-900 shadow-2xl border-l border-neutral-200 dark:border-neutral-800 flex flex-col animate-in slide-in-from-right duration-300">
      
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                AI Тьютор по информатике
              </h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                RAG Учителя
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 line-clamp-1">
              Урок: {lesson?.title || 'Общий курс информатики'}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none shadow-md shadow-blue-500/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-bl-none border border-neutral-200/60 dark:border-neutral-700/60'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>

            {msg.role === 'assistant' && msg.source && (
              <span className="text-[9px] text-neutral-400 mt-1 pl-1 font-mono">
                {msg.source === 'gemini-3.8-flash' ? '🧠 Gemini 3.8 Flash (Server)' : '📚 Методическая база учителя'}
              </span>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-neutral-400 p-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
            <span>AI тьютор анализирует материалы урока...</span>
          </div>
        )}
      </div>

      {/* Quick suggestions pills */}
      <div className="px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 flex space-x-2 overflow-x-auto">
        {quickPrompts.map((qp, i) => (
          <button
            key={i}
            onClick={() => handleSend(qp)}
            className="px-2.5 py-1 rounded-full text-[11px] whitespace-nowrap bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            {qp}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            placeholder="Спросить о коде, структурах данных или задаче..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!inputPrompt.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition-colors shadow-md shadow-indigo-500/20"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-neutral-400 text-center mt-1.5">
          Ассистент придерживается строгой педагогической этики и направляет к самостоятельному решению.
        </p>
      </div>

    </div>
  );
};
