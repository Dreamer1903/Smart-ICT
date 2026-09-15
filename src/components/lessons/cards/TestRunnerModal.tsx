import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Award,
  ArrowRight,
  Code,
  RotateCcw,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { LessonTest, TestQuestion } from '../../../types';

interface TestRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: LessonTest;
  lessonTitle: string;
  onCompleteTest: (score: number, maxScore: number, xpEarned: number) => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({
  isOpen,
  onClose,
  test,
  lessonTitle,
  onCompleteTest
}) => {
  if (!isOpen) return null;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, any>>({});
  const [timeLeft, setTimeLeft] = useState(test.timeLimitMinutes * 60);
  const [isFinished, setIsFinished] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; maxScore: number; xpEarned: number; correctCount: number } | null>(null);

  const currentQuestion: TestQuestion = test.questions[currentIndex];

  // Timer effect
  useEffect(() => {
    if (isFinished) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isFinished]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSelectOption = (questionId: string, optionIdx: number, isMulti: boolean) => {
    if (isFinished) return;

    if (isMulti) {
      const currentList: number[] = selectedAnswers[questionId] || [];
      const updated = currentList.includes(optionIdx)
        ? currentList.filter(i => i !== optionIdx)
        : [...currentList, optionIdx];
      setSelectedAnswers({ ...selectedAnswers, [questionId]: updated });
    } else {
      setSelectedAnswers({ ...selectedAnswers, [questionId]: optionIdx });
    }
  };

  const handleInputAnswer = (questionId: string, value: string) => {
    if (isFinished) return;
    setSelectedAnswers({ ...selectedAnswers, [questionId]: value });
  };

  const finishTest = () => {
    let totalScore = 0;
    let maxPossible = 0;
    let correct = 0;

    test.questions.forEach((q) => {
      maxPossible += q.points;
      const userAns = selectedAnswers[q.id];

      if (q.type === 'single_choice') {
        if (userAns === q.correctAnswer) {
          totalScore += q.points;
          correct++;
        }
      } else if (q.type === 'multiple_choice') {
        const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
        const userArr = Array.isArray(userAns) ? userAns : [];
        const isMatch = correctArr.length === userArr.length && correctArr.every((v: number) => userArr.includes(v));
        if (isMatch) {
          totalScore += q.points;
          correct++;
        }
      } else if (q.type === 'code_output' || q.type === 'fill_in_the_blank') {
        if (String(userAns || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase()) {
          totalScore += q.points;
          correct++;
        }
      }
    });

    const percent = maxPossible > 0 ? totalScore / maxPossible : 0;
    const xpEarned = Math.round(test.rewardXp * Math.max(0.4, percent));

    setScoreResult({
      score: totalScore,
      maxScore: maxPossible,
      xpEarned,
      correctCount: correct
    });

    setIsFinished(true);

    if (percent >= 0.7) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    onCompleteTest(totalScore, maxPossible, xpEarned);
  };

  const handleRestart = () => {
    setSelectedAnswers({});
    setCurrentIndex(0);
    setTimeLeft(test.timeLimitMinutes * 60);
    setIsFinished(false);
    setScoreResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-3xl shadow-2xl border p-6 sm:p-8 backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                Онлайн-тестирование
              </span>
              <span className="text-xs text-neutral-400">+{test.rewardXp} XP</span>
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mt-1">
              {test.title}
            </h3>
          </div>

          <div className="flex items-center space-x-3">
            {/* Timer */}
            {!isFinished && (
              <div className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-mono font-bold text-xs ${
                timeLeft < 120 
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 animate-pulse'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeLeft)}</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Test Body */}
        {!isFinished ? (
          <div className="flex-1 overflow-y-auto py-6 space-y-6">
            
            {/* Progress Bar & Question Step */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-neutral-500">
                <span>Вопрос {currentIndex + 1} из {test.questions.length}</span>
                <span>{currentQuestion.points} баллов</span>
              </div>
              <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / test.questions.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Question Card */}
            <div className="space-y-4">
              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-relaxed">
                {currentQuestion.text}
              </h4>

              {/* Code Snippet if question has code */}
              {currentQuestion.codeSnippet && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs overflow-x-auto text-emerald-300 shadow-inner">
                  <div className="text-[10px] text-neutral-500 mb-2 border-b border-neutral-800 pb-1 flex items-center space-x-1">
                    <Code className="w-3.5 h-3.5 text-blue-400" />
                    <span>Фрагмент программы на Python:</span>
                  </div>
                  <pre className="text-xs leading-relaxed">
                    <code>{currentQuestion.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {/* Options list for single/multiple choice */}
              {(currentQuestion.type === 'single_choice' || currentQuestion.type === 'multiple_choice') && (
                <div className="space-y-2.5 pt-2">
                  {currentQuestion.options?.map((option, oIdx) => {
                    const isMulti = currentQuestion.type === 'multiple_choice';
                    const isSelected = isMulti
                      ? (selectedAnswers[currentQuestion.id] || []).includes(oIdx)
                      : selectedAnswers[currentQuestion.id] === oIdx;

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.id, oIdx, isMulti)}
                        className={`w-full p-4 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-600 text-blue-900 dark:text-blue-100 shadow-sm'
                            : 'bg-neutral-50/60 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:border-blue-400'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-bold border transition-colors ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-neutral-300 dark:border-neutral-600 text-neutral-400'
                        }`}>
                          {String.fromCharCode(65 + oIdx)}
                        </div>
                        <span className="text-xs font-medium flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Text input for code_output or fill_in_the_blank */}
              {(currentQuestion.type === 'code_output' || currentQuestion.type === 'fill_in_the_blank') && (
                <div className="pt-2">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Ваш точный ответ:
                  </label>
                  <input
                    type="text"
                    placeholder="Введите число, строку или вывод консоли..."
                    value={selectedAnswers[currentQuestion.id] || ''}
                    onChange={(e) => handleInputAnswer(currentQuestion.id, e.target.value)}
                    className="w-full px-4 py-3 text-xs rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>
              )}
            </div>

            {/* Bottom Nav inside Test */}
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 disabled:opacity-30 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Назад
              </button>

              {currentIndex < test.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(currentIndex + 1)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center space-x-1.5"
                >
                  <span>Следующий вопрос</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={finishTest}
                  className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Завершить тест</span>
                </button>
              )}
            </div>

          </div>
        ) : (
          /* Results View with Detailed Explanations */
          <div className="flex-1 overflow-y-auto py-6 space-y-6">
            
            {/* Score Showcase Banner */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-center space-y-3 shadow-xl">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mb-1">
                <Award className="w-6 h-6 text-amber-300" />
              </div>
              <h3 className="text-xl font-extrabold">Тестирование успешно завершено!</h3>
              <div className="text-3xl sm:text-4xl font-black">
                {scoreResult?.score} / {scoreResult?.maxScore} баллов
              </div>
              <p className="text-xs text-blue-100">
                Правильно отвечено: {scoreResult?.correctCount} из {test.questions.length} вопросов · Получено: <strong>+{scoreResult?.xpEarned} XP</strong>
              </p>
            </div>

            {/* Questions Breakdown */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                Разбор вопросов и правильные ответы:
              </h4>

              {test.questions.map((q, idx) => {
                const userAns = selectedAnswers[q.id];
                let isCorrect = false;

                if (q.type === 'single_choice') {
                  isCorrect = userAns === q.correctAnswer;
                } else if (q.type === 'multiple_choice') {
                  const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
                  const userArr = Array.isArray(userAns) ? userAns : [];
                  isCorrect = correctArr.length === userArr.length && correctArr.every((v: number) => userArr.includes(v));
                } else {
                  isCorrect = String(userAns || '').trim().toLowerCase() === String(q.correctAnswer || '').trim().toLowerCase();
                }

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border text-xs space-y-2 ${
                      isCorrect
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                        : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 font-bold">
                        {isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span>Вопрос #{idx + 1}: {q.text}</span>
                      </div>
                      <span className="font-bold">{isCorrect ? `+${q.points}` : '0'} б.</span>
                    </div>

                    {q.explanation && (
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300">
                        <strong>💡 Объяснение:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-between items-center pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={handleRestart}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Пройти еще раз</span>
              </button>

              <button
                onClick={onClose}
                className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
              >
                Вернуться к уроку
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
