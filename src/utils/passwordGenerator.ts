/**
 * Утилита генерации надежных и удобных школьных паролей для учащихся
 * Специально для кабинета информатики и ИКТ (Учитель: Абдугафоров Мухаммадрахим Равшанович)
 */

export type PasswordFormat = 'school' | 'mnemonic' | 'pin' | 'secure';

export interface GeneratedCredential {
  userId: string;
  userName: string;
  userEmail: string;
  classId?: string;
  password: string;
}

// Префиксы для легкого школьного ввода на клавиатуре
const SCHOOL_PREFIXES = ['ict', 'code', 'py', 'algo', 'edu', 'comp', 'net'];
const MNEMONIC_WORDS = ['learn', 'smart', 'future', 'cyber', 'robot', 'logic', 'vector', 'byte', 'pixel'];

/**
 * Генерация одиночного пароля по выбранному формату
 */
export function generatePassword(format: PasswordFormat = 'school'): string {
  if (format === 'pin') {
    // 6-значный цифровой PIN
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  if (format === 'mnemonic') {
    const word = MNEMONIC_WORDS[Math.floor(Math.random() * MNEMONIC_WORDS.length)];
    const num = Math.floor(10 + Math.random() * 90);
    const char = 'abcdefhjkmnpqrstuvwxyz'[Math.floor(Math.random() * 22)];
    return `${word}-${num}${char}`;
  }

  if (format === 'secure') {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const specials = '!@#$%&*';
    
    let pass = '';
    pass += upper[Math.floor(Math.random() * upper.length)];
    pass += lower[Math.floor(Math.random() * lower.length)];
    pass += digits[Math.floor(Math.random() * digits.length)];
    pass += specials[Math.floor(Math.random() * specials.length)];
    
    const allChars = upper + lower + digits + specials;
    for (let i = 0; i < 4; i++) {
      pass += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Перемешиваем
    return pass.split('').sort(() => Math.random() - 0.5).join('');
  }

  // По умолчанию: 'school' (Префикс ИКТ + 4 цифры, например: ict-4829, py-9183)
  const prefix = SCHOOL_PREFIXES[Math.floor(Math.random() * SCHOOL_PREFIXES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

/**
 * Генерация карточек доступа для списка учеников
 */
export function generateClassCredentials(
  students: { id: string; name: string; email: string; classId?: string }[],
  format: PasswordFormat = 'school'
): GeneratedCredential[] {
  return students.map(student => ({
    userId: student.id,
    userName: student.name,
    userEmail: student.email,
    classId: student.classId,
    password: generatePassword(format)
  }));
}

/**
 * Форматирование списка учетных записей для копирования в буфер обмена
 */
export function formatCredentialsForClipboard(
  credentials: GeneratedCredential[],
  className?: string
): string {
  const dateStr = new Date().toLocaleDateString('ru-RU');
  let result = `ВЕДОМОСТЬ ДОСТУПА В КАБИНЕТ ИКТ (${className ? `Класс ${className}` : 'Платформа Smart ICT'})\n`;
  result += `Преподаватель ИКТ: Абдугафоров Мухаммадрахим Равшанович\n`;
  result += `Дата генерации: ${dateStr}\n`;
  result += `===========================================================\n`;
  result += `ФИО Ученика\tКласс\tEmail / Логин\tПароль для входа\n`;
  result += `-----------------------------------------------------------\n`;

  credentials.forEach(cred => {
    result += `${cred.userName}\t${cred.classId || '—'}\t${cred.userEmail}\t${cred.password}\n`;
  });

  result += `===========================================================\n`;
  result += `Памятка: Вход осуществляется на платформе Smart ICT по связке Email + Пароль.\n`;
  return result;
}
