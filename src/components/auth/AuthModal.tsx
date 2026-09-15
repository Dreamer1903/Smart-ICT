import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  School,
  Shield,
  ArrowRight,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  KeyRound,
  LogIn,
  ArrowLeft,
  RefreshCw,
  Send,
  Check,
  ShieldCheck
} from 'lucide-react';
import { SchoolClass, User, UserRole } from '../../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClass[];
  onRegister: (newUser: Omit<User, 'id' | 'xp' | 'level' | 'streakDays' | 'completedLessons' | 'badges' | 'registeredAt'>) => void;
  onLoginAs: (user: User) => void;
  availableUsers: User[];
  onUpdatePassword?: (userId: string, newPassword: string) => void;
}

// Official Google "G" logo SVG
const GoogleGLogo = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  classes,
  onRegister,
  onLoginAs,
  availableUsers,
  onUpdatePassword
}) => {
  // Main view mode
  const [mode, setMode] = useState<
    'login' | 'register' | 'demo' | 'email-verify' | 'forgot-password' | 'google-auth'
  >('login');
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [pendingUserForVerification, setPendingUserForVerification] = useState<User | null>(null);

  // Email Verification (2FA on login)
  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [resendTimer, setResendTimer] = useState(45);
  const [rememberDevice, setRememberDevice] = useState(true);

  // Password Recovery State
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'enter-email' | 'enter-code' | 'new-password' | 'done'>('enter-email');
  const [resetCodeInput, setResetCodeInput] = useState('');
  const [generatedResetCode, setGeneratedResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);

  // Google Login State
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [googleSelectedRole, setGoogleSelectedRole] = useState<UserRole>('student');
  const [googleSelectedClass, setGoogleSelectedClass] = useState<string>('10C');
  const [showCustomGoogleInput, setShowCustomGoogleInput] = useState(false);
  
  // Register form state
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [registerRole, setRegisterRole] = useState<UserRole>('student');
  const [registerClassId, setRegisterClassId] = useState<string>('10C');

  // Status feedback
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Countdown timer for email resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if ((mode === 'email-verify' || (mode === 'forgot-password' && resetStep === 'enter-code')) && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [mode, resetStep, resendTimer]);

  if (!isOpen) return null;

  // Demo auto-filler
  const handleSelectDemoUser = (user: User, autoLogin: boolean = true) => {
    setErrorMessage('');
    if (autoLogin) {
      onLoginAs(user);
      onClose();
    } else {
      setMode('login');
      setLoginEmail(user.email);
      setLoginPassword(user.password || 'student123');
      setSuccessMessage(`Логин и пароль для «${user.name}» подставлены в форму. Нажмите «Войти в аккаунт».`);
    }
  };

  // STEP 1: Handle Initial Login Submit (triggers Email Verification)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedEmail = loginEmail.trim().toLowerCase();
    const trimmedPassword = loginPassword.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Пожалуйста, введите корректный адрес электронной почты.');
      return;
    }

    if (!trimmedPassword) {
      setErrorMessage('Пожалуйста, введите пароль от вашей учетной записи.');
      return;
    }

    // Find matching user by email
    const foundUser = availableUsers.find(
      u => u.email.trim().toLowerCase() === trimmedEmail
    );

    if (!foundUser) {
      setErrorMessage('Пользователь с таким email не найден. Проверьте адрес или перейдите на вкладку «Регистрация».');
      return;
    }

    // Check password
    const expectedPassword = foundUser.password || 'student123';
    if (trimmedPassword !== expectedPassword) {
      setErrorMessage(`Неверный пароль. Подсказка: для демо-аккаунта пароль «${expectedPassword}» или воспользуйтесь восстановлением пароля через почту.`);
      return;
    }

    // Generate 6-digit confirmation code for email verification
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setVerificationCode('');
    setPendingUserForVerification(foundUser);
    setResendTimer(45);
    setMode('email-verify');
  };

  // STEP 2: Verify confirmation code received via email
  const handleVerifyCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!verificationCode.trim()) {
      setErrorMessage('Введите 6-значный код подтверждения.');
      return;
    }

    if (verificationCode.trim() !== generatedCode) {
      setErrorMessage('Неверный код подтверждения. Проверьте код из письма или запросите новый.');
      return;
    }

    if (pendingUserForVerification) {
      onLoginAs(pendingUserForVerification);
      onClose();
    }
  };

  // Resend code handler
  const handleResendCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setResendTimer(45);
    setSuccessMessage(`Новый код подтверждения отправлен на ${loginEmail}`);
  };

  // FORGOT PASSWORD FLOW
  const handleStartForgotPassword = () => {
    setResetEmail(loginEmail || '');
    setResetStep('enter-email');
    setResetCodeInput('');
    setNewPassword('');
    setConfirmNewPassword('');
    setErrorMessage('');
    setSuccessMessage('');
    setMode('forgot-password');
  };

  const handleSendResetEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMessage('Введите корректный email адрес.');
      return;
    }

    const found = availableUsers.find(u => u.email.trim().toLowerCase() === targetEmail);
    if (!found) {
      setErrorMessage('Аккаунт с таким email не найден. Проверьте адрес.');
      return;
    }

    setUserToReset(found);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedResetCode(code);
    setResendTimer(45);
    setResetStep('enter-code');
  };

  const handleVerifyResetCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (resetCodeInput.trim() !== generatedResetCode) {
      setErrorMessage('Неверный код сброса пароля.');
      return;
    }

    setResetStep('new-password');
  };

  const handleSaveNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 4) {
      setErrorMessage('Пароль должен быть не менее 4 символов.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage('Введенные пароли не совпадают.');
      return;
    }

    if (userToReset && onUpdatePassword) {
      onUpdatePassword(userToReset.id, newPassword);
    }

    setResetStep('done');
  };

  // GOOGLE SIGN IN FLOW
  const handleGoogleLogin = (targetEmail: string, targetName: string) => {
    setErrorMessage('');
    const emailNorm = targetEmail.trim().toLowerCase();

    // Check if user already exists
    const existing = availableUsers.find(u => u.email.trim().toLowerCase() === emailNorm);
    if (existing) {
      onLoginAs(existing);
      onClose();
      return;
    }

    // Create new account with Google details
    const targetClass = classes.find(c => c.id === googleSelectedClass);
    onRegister({
      name: targetName,
      email: emailNorm,
      password: 'google_auth_secure',
      role: googleSelectedRole,
      classId: googleSelectedRole === 'student' ? googleSelectedClass : undefined,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(targetName)}`,
      bio: googleSelectedRole === 'student'
        ? `Ученик ${targetClass?.name || '10-C'} класса (Вход выполнен через Google).`
        : 'Преподаватель курса информатики и ИКТ (Вход выполнен через Google).'
    });

    onClose();
  };

  // Registration handler
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!registerName.trim()) {
      setErrorMessage('Пожалуйста, введите полное имя и фамилию.');
      return;
    }

    const trimmedEmail = registerEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Пожалуйста, введите корректный email адрес.');
      return;
    }

    if (availableUsers.some(u => u.email.trim().toLowerCase() === trimmedEmail)) {
      setErrorMessage('Пользователь с таким email уже зарегистрирован. Перейдите во вкладку «Вход по паролю».');
      return;
    }

    if (registerPassword.length < 4) {
      setErrorMessage('Пароль должен содержать минимум 4 символа.');
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      setErrorMessage('Введенные пароли не совпадают.');
      return;
    }

    const targetClass = classes.find(c => c.id === registerClassId);

    onRegister({
      name: registerName.trim(),
      email: trimmedEmail,
      password: registerPassword,
      role: registerRole,
      classId: registerRole === 'student' ? registerClassId : undefined,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(registerName.trim())}`,
      bio: registerRole === 'student' 
        ? `Ученик ${targetClass?.name || '10-C'} класса платформы Smart ICT.`
        : registerRole === 'teacher'
        ? 'Преподаватель курса информатики и цифровых технологий.'
        : 'Администратор образовательной системы.'
    });

    onClose();
  };

  // Demo users references
  const demoStudent = availableUsers.find(u => u.role === 'student') || availableUsers[0];
  const demoTeacher = availableUsers.find(u => u.role === 'teacher') || availableUsers[3];
  const demoAdmin = availableUsers.find(u => u.role === 'admin') || availableUsers[4];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl shadow-2xl border p-6 sm:p-8 backdrop-blur-2xl bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 max-h-[94vh] overflow-y-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title="Закрыть"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 mb-3">
            {mode === 'email-verify' ? (
              <Mail className="w-6 h-6" />
            ) : mode === 'forgot-password' ? (
              <KeyRound className="w-6 h-6" />
            ) : mode === 'google-auth' ? (
              <ShieldCheck className="w-6 h-6" />
            ) : (
              <KeyRound className="w-6 h-6" />
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {mode === 'email-verify'
              ? 'Подтверждение через почту'
              : mode === 'forgot-password'
              ? 'Восстановление пароля'
              : mode === 'google-auth'
              ? 'Вход через Google'
              : 'Авторизация в Smart ICT'}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {mode === 'email-verify'
              ? 'Безопасная двухфакторная верификация входа'
              : mode === 'forgot-password'
              ? 'Сброс и обновление пароля через проверочный email-код'
              : mode === 'google-auth'
              ? 'Мгновенный защищенный вход в один клик'
              : 'Вход с подтверждением по почте, восстановление пароля и Google аккаунт'}
          </p>
        </div>

        {/* Navigation Tabs (visible in login, demo, register) */}
        {(mode === 'login' || mode === 'demo' || mode === 'register') && (
          <div className="flex rounded-2xl bg-neutral-100 dark:bg-neutral-800 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'login'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Вход по паролю</span>
            </button>
            
            <button
              type="button"
              onClick={() => { setMode('demo'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'demo'
                  ? 'bg-white dark:bg-neutral-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Демо-аккаунты</span>
            </button>

            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'register'
                  ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Регистрация</span>
            </button>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs flex items-start space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>{successMessage}</div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 1: LOGIN FORM WITH GOOGLE BUTTON & FORGOT PASSWORD LINK */}
        {/* =================================================================== */}
        {mode === 'login' && (
          <div className="space-y-4">
            
            {/* GOOGLE SIGN IN BUTTON */}
            <button
              type="button"
              onClick={() => {
                setErrorMessage('');
                setMode('google-auth');
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-100 shadow-sm transition-all flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              <GoogleGLogo />
              <span>Войти через аккаунт Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
              <span className="bg-white dark:bg-neutral-900 px-3 text-[11px] font-semibold text-neutral-400 shrink-0">
                или с подтверждением по email
              </span>
              <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Электронная почта (Email)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    placeholder="Например, chemist0319@gmail.com или muhammad@school.edu"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Пароль
                  </label>
                  <button
                    type="button"
                    onClick={handleStartForgotPassword}
                    className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Забыли пароль? Восстановить через почту
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Введите ваш пароль"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                    title={showLoginPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <b>Двухфакторная защита:</b> При входе на вашу почту будет отправлен одноразовый 6-значный проверочный код.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Войти и запросить код на почту</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Hint */}
            <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800 text-xs flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">
                Хотите протестировать без ввода?
              </span>
              <button
                type="button"
                onClick={() => setMode('demo')}
                className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
              >
                <span>Открыть демо-аккаунты</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: EMAIL CONFIRMATION (2FA DURING LOGIN) */}
        {/* =================================================================== */}
        {mode === 'email-verify' && (
          <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
            
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs space-y-2">
              <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center space-x-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <span>Проверьте ваш почтовый ящик</span>
              </div>
              <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                Мы отправили 6-значный одноразовый код подтверждения на адрес: <b className="text-neutral-900 dark:text-white">{loginEmail}</b>
              </p>
            </div>

            {/* Simulated Email Gateway Card */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-amber-700 dark:text-amber-400">
                  Почтовый шлюз Smart ICT (Симуляция доставки)
                </span>
                <span className="text-[10px] text-neutral-400">Только что</span>
              </div>
              <div className="text-xs font-bold text-neutral-900 dark:text-white">
                Тема: Код подтверждения для входа в кабинет Smart ICT
              </div>
              <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-neutral-400">Код безопасности:</div>
                  <div className="text-xl font-mono font-black tracking-widest text-blue-600 dark:text-blue-400">
                    {generatedCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVerificationCode(generatedCode)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  Вставить код
                </button>
              </div>
            </div>

            {/* Code Input */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 text-center">
                Введите 6-значный код из письма:
              </label>
              <input
                type="text"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                placeholder="XXXXXX"
                autoFocus
                className="w-full py-3 text-center text-2xl font-mono font-black tracking-widest rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Remember Device Checkbox */}
            <label className="flex items-center space-x-2 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>Запомнить это устройство на 30 дней</span>
            </label>

            {/* Verification Button */}
            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Подтвердить код и войти в систему</span>
            </button>

            {/* Resend Timer / Button */}
            <div className="flex items-center justify-between text-xs pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Изменить email или пароль</span>
              </button>

              {resendTimer > 0 ? (
                <span className="text-neutral-400">
                  Повторный код через {resendTimer}с
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Отправить повторно</span>
                </button>
              )}
            </div>

          </form>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: PASSWORD RECOVERY VIA EMAIL */}
        {/* =================================================================== */}
        {mode === 'forgot-password' && (
          <div className="space-y-4">
            
            {/* Step 1: Input Email */}
            {resetStep === 'enter-email' && (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300 space-y-1">
                  <div className="font-bold text-neutral-900 dark:text-white">
                    Шаг 1: Введите ваш адрес электронной почты
                  </div>
                  <p className="text-[11px]">
                    Мы отправим вам безопасный код для подтверждения сброса пароля.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Email аккаунта
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Например, chemist0319@gmail.com"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Отправить код восстановления на почту</span>
                  <Send className="w-4 h-4" />
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center space-x-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Вернуться к форме входа</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Input Reset Code */}
            {resetStep === 'enter-code' && (
              <form onSubmit={handleVerifyResetCode} className="space-y-4">
                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200">
                  <div className="font-bold">Шаг 2: Введите код сброса</div>
                  <div className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">
                    Код отправлен на почту <b>{resetEmail}</b>.
                  </div>
                </div>

                {/* Simulated Reset Email Box */}
                <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-black tracking-wider text-amber-700 dark:text-amber-400">
                      Входящее письмо (Сброс пароля)
                    </span>
                    <span className="text-[10px] text-neutral-400">Только что</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-amber-300 dark:border-amber-800 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-neutral-400">Код для сброса:</div>
                      <div className="text-xl font-mono font-black tracking-widest text-blue-600 dark:text-blue-400">
                        {generatedResetCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResetCodeInput(generatedResetCode)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Вставить
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5 text-center">
                    6-значный код из письма:
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={resetCodeInput}
                    onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="XXXXXX"
                    autoFocus
                    className="w-full py-3 text-center text-2xl font-mono font-black tracking-widest rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center space-x-2"
                >
                  <span>Подтвердить код и задать пароль</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 3: New Password */}
            {resetStep === 'new-password' && (
              <form onSubmit={handleSaveNewPassword} className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="font-bold">Шаг 3: Придумайте новый пароль</div>
                  <div className="text-[11px]">
                    Личность подтверждена. Введите новый пароль для учетной записи {userToReset?.name}.
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Новый пароль (от 4 символов)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 p-1 text-neutral-400 hover:text-neutral-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Повторите новый пароль
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 transition-all flex items-center justify-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Сохранить новый пароль</span>
                </button>
              </form>
            )}

            {/* Step 4: Done */}
            {resetStep === 'done' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  Пароль успешно обновлен!
                </h3>
                <p className="text-xs text-neutral-500">
                  Теперь вы можете войти в систему Smart ICT, используя новый установленный пароль.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (userToReset) {
                      onLoginAs({ ...userToReset, password: newPassword });
                      onClose();
                    } else {
                      setMode('login');
                    }
                  }}
                  className="w-full py-3 rounded-xl font-bold text-xs text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all flex items-center justify-center space-x-2"
                >
                  <span>Войти с новым паролем</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 4: GOOGLE SIGN IN CHOOSER / MODAL */}
        {/* =================================================================== */}
        {mode === 'google-auth' && (
          <div className="space-y-4">
            
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 space-y-3">
              <div className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Выберите аккаунт Google для входа в Smart ICT:
              </div>

              {/* Primary User Account from Session (chemist0319@gmail.com) */}
              <button
                type="button"
                onClick={() => handleGoogleLogin('chemist0319@gmail.com', 'Преподаватель (chemist0319)')}
                className="w-full p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border border-blue-200 dark:border-blue-800 hover:border-blue-500 hover:shadow-md transition-all text-left flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt=""
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500"
                    />
                    <div className="absolute -bottom-1 -right-1 p-0.5 bg-white dark:bg-neutral-900 rounded-full">
                      <GoogleGLogo />
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-xs text-neutral-900 dark:text-white flex items-center space-x-2">
                      <span>chemist0319</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                        Активный Google аккаунт
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      chemist0319@gmail.com
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-blue-500 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Toggle Custom Google Email Input */}
              {!showCustomGoogleInput ? (
                <button
                  type="button"
                  onClick={() => setShowCustomGoogleInput(true)}
                  className="w-full py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center justify-center space-x-1.5"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Использовать другой аккаунт Google</span>
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-3">
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Введите любой адрес Google (@gmail.com):
                  </div>
                  <input
                    type="email"
                    placeholder="user@gmail.com"
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={!customGoogleEmail.includes('@')}
                      onClick={() => handleGoogleLogin(customGoogleEmail, customGoogleEmail.split('@')[0])}
                      className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                    >
                      Продолжить с этим email
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCustomGoogleInput(false)}
                      className="px-3 py-1.5 rounded-xl text-xs text-neutral-500 hover:text-neutral-700"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Role Assignment for Google Account */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Роль в системе при создании профиля:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleSelectedRole('student')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    googleSelectedRole === 'student'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  Ученик (10-C)
                </button>
                <button
                  type="button"
                  onClick={() => setGoogleSelectedRole('teacher')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-all ${
                    googleSelectedRole === 'teacher'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  Учитель ИКТ
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 inline-flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Вернуться к обычному входу</span>
              </button>
            </div>

          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 5: DEMO ACCOUNTS PREVIEW & 1-CLICK LOGIN */}
        {/* =================================================================== */}
        {mode === 'demo' && (
          <div className="space-y-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Выберите готовую учетную запись с предустановленными ролями, материалами и паролями. Вы можете войти в один клик или подставить данные в форму для проверки входа:
            </p>

            <div className="space-y-3">
              
              {/* Demo Student */}
              {demoStudent && (
                <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 transition-all hover:border-blue-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={demoStudent.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-blue-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                            {demoStudent.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300">
                            Роль: Ученик (10-C)
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          Email: <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{demoStudent.email}</span> · Пароль: <span className="text-blue-600 dark:text-blue-400 font-bold">{demoStudent.password || 'student123'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/40 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoStudent, false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100"
                    >
                      Подставить логин и пароль
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoStudent, true)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-all flex items-center space-x-1"
                    >
                      <span>Войти как Ученик</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Demo Teacher */}
              {demoTeacher && (
                <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 transition-all hover:border-emerald-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={demoTeacher.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                            {demoTeacher.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300">
                            Роль: Учитель
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          Email: <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{demoTeacher.email}</span> · Пароль: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{demoTeacher.password || 'teacher123'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoTeacher, false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100"
                    >
                      Подставить логин и пароль
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoTeacher, true)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center space-x-1"
                    >
                      <span>Войти как Учитель</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Demo Admin */}
              {demoAdmin && (
                <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 transition-all hover:border-purple-400">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <img
                        src={demoAdmin.avatarUrl}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-purple-500"
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-neutral-900 dark:text-white">
                            {demoAdmin.name}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-900/80 text-purple-700 dark:text-purple-300">
                            Роль: Администратор
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          Email: <span className="text-neutral-800 dark:text-neutral-200 font-semibold">{demoAdmin.email}</span> · Пароль: <span className="text-purple-600 dark:text-purple-400 font-bold">{demoAdmin.password || 'admin123'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-900/40 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoAdmin, false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100"
                    >
                      Подставить логин и пароль
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDemoUser(demoAdmin, true)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-all flex items-center space-x-1"
                    >
                      <span>Войти как Администратор</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* VIEW 6: REGISTRATION WITH ROLE & PASSWORD */}
        {/* =================================================================== */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            
            {/* Quick Google Sign In */}
            <button
              type="button"
              onClick={() => {
                setErrorMessage('');
                setMode('google-auth');
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-750 text-neutral-800 dark:text-neutral-100 shadow-sm transition-all flex items-center justify-center space-x-2.5 cursor-pointer"
            >
              <GoogleGLogo />
              <span>Быстрая регистрация через Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
              <span className="bg-white dark:bg-neutral-900 px-3 text-[11px] font-semibold text-neutral-400 shrink-0">
                или заполните данные формы
              </span>
              <div className="border-t border-neutral-200 dark:border-neutral-800 w-full" />
            </div>

            {/* Choose Role */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                Выберите роль в образовательной системе
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRegisterRole('student')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    registerRole === 'student'
                      ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-600 text-blue-700 dark:text-blue-300 font-bold'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-xs">Ученик</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegisterRole('teacher')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    registerRole === 'teacher'
                      ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-600 text-emerald-700 dark:text-emerald-300 font-bold'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                  }`}
                >
                  <School className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-xs">Учитель</div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegisterRole('admin')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    registerRole === 'admin'
                      ? 'bg-purple-50 dark:bg-purple-900/40 border-purple-600 text-purple-700 dark:text-purple-300 font-bold'
                      : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-neutral-400'
                  }`}
                >
                  <Shield className="w-4 h-4 mx-auto mb-1" />
                  <div className="text-xs">Админ</div>
                </button>
              </div>
            </div>

            {/* If Student: Select Class */}
            {registerRole === 'student' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Учебный класс (доступ к материалам)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {classes.map((cls) => {
                    const isSelected = registerClassId === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => setRegisterClassId(cls.id)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold text-center border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-blue-400'
                        }`}
                      >
                        {cls.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                ФИО пользователя
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Например, Александр Иванов"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Электронная почта
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  placeholder="alexander@school.edu"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Пароль (от 4 символов)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-2.5 top-2.5 p-0.5 text-neutral-400 hover:text-neutral-600"
                  >
                    {showRegisterPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Подтверждение пароля
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                  <input
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>Зарегистрироваться и войти</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
