import { useState, useCallback } from 'react';
import { PasswordOptions } from '../types';

const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
const NUMBERS = '0123456789';
const SYMBOLS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

export const usePasswordGenerator = () => {
  const [password, setPassword] = useState<string>('');
  const [strength, setStrength] = useState<number>(0);
  const [strengthLabel, setStrengthLabel] = useState<string>('');
  const [strengthColor, setStrengthColor] = useState<string>('');

  const calculateStrength = (pwd: string): number => {
    let score = 0;
    
    // Length score
    if (pwd.length >= 8) score += 20;
    if (pwd.length >= 12) score += 10;
    if (pwd.length >= 16) score += 10;
    
    // Character variety
    if (/[A-Z]/.test(pwd)) score += 20;
    if (/[a-z]/.test(pwd)) score += 20;
    if (/[0-9]/.test(pwd)) score += 20;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 20;
    
    // Penalize for common patterns
    if (/12345|password|qwerty|admin|123456/i.test(pwd)) {
      score = Math.max(0, score - 30);
    }
    
    return Math.min(100, Math.max(0, score));
  };

  const getStrengthLabel = (score: number): string => {
    if (score < 30) return 'Very Weak';
    if (score < 50) return 'Weak';
    if (score < 70) return 'Fair';
    if (score < 90) return 'Good';
    return 'Strong';
  };

  const getStrengthColor = (score: number): string => {
    if (score < 30) return 'text-red-500';
    if (score < 50) return 'text-orange-500';
    if (score < 70) return 'text-yellow-500';
    if (score < 90) return 'text-blue-500';
    return 'text-green-500';
  };

  const hasRequiredChars = (password: string, options: PasswordOptions): boolean => {
    if (options.includeUppercase && !/[A-Z]/.test(password)) return false;
    if (options.includeLowercase && !/[a-z]/.test(password)) return false;
    if (options.includeNumbers && !/[0-9]/.test(password)) return false;
    if (options.includeSymbols && !/[^A-Za-z0-9]/.test(password)) return false;
    return true;
  };

  const generatePasswordInternal = useCallback((options: PasswordOptions): string => {
    let charset = '';
    let password = '';
    
    if (options.includeUppercase) charset += UPPERCASE;
    if (options.includeLowercase) charset += LOWERCASE;
    if (options.includeNumbers) charset += NUMBERS;
    if (options.includeSymbols) charset += SYMBOLS;
    
    if (charset.length === 0) {
      charset = UPPERCASE + LOWERCASE + NUMBERS;
    }
    
    const array = new Uint8Array(options.length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < options.length; i++) {
      const randomIndex = array[i] % charset.length;
      password += charset[randomIndex];
    }
    
    // Ensure at least one character from each selected character set
    let attempts = 0;
    const maxAttempts = 100;
    
    while (!hasRequiredChars(password, options) && attempts < maxAttempts) {
      attempts++;
      // Regenerate password if it doesn't meet requirements
      for (let i = 0; i < options.length; i++) {
        const randomIndex = crypto.getRandomValues(new Uint8Array(1))[0] % charset.length;
        password = password.substring(0, i) + charset[randomIndex] + password.substring(i + 1);
      }
    }
    
    return password;
  }, []);

  const generatePassword = (options: PasswordOptions): string => {
    const newPassword = generatePasswordInternal(options);
    setPassword(newPassword);
    
    const strengthScore = calculateStrength(newPassword);
    setStrength(strengthScore);
    setStrengthLabel(getStrengthLabel(strengthScore));
    setStrengthColor(getStrengthColor(strengthScore));
    
    return newPassword;
  };

  return {
    password,
    strength,
    strengthLabel,
    strengthColor,
    generatePassword,
  };
};