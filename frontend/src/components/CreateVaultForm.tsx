import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Check, 
  X,
  Loader2
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

import { useVault } from '../stores/vaultStore';
import { useNavigate } from 'react-router-dom';

interface PasswordStrength {
  score: number;
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

interface CreateVaultFormProps {
  vaultExists?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CreateVaultForm({ vaultExists, onSuccess, onCancel }: CreateVaultFormProps) {
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength>({
    score: 0,
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false
  });

  const { createVault } = useVault();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Calculate password strength
  useEffect(() => {
    if (!masterPassword) {
      setPasswordStrength({
        score: 0,
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false
      });
      return;
    }

    const hasMinLength = masterPassword.length >= 8;
    const hasUppercase = /[A-Z]/.test(masterPassword);
    const hasLowercase = /[a-z]/.test(masterPassword);
    const hasNumber = /\d/.test(masterPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(masterPassword);

    let score = 0;
    if (hasMinLength) score += 2;
    if (hasUppercase) score += 1;
    if (hasLowercase) score += 1;
    if (hasNumber) score += 1;
    if (hasSpecialChar) score += 1;

    setPasswordStrength({
      score,
      hasMinLength,
      hasUppercase,
      hasLowercase,
      hasNumber,
      hasSpecialChar
    });
  }, [masterPassword]);

  // Show warning immediately if vault exists
  useEffect(() => {
    if (vaultExists) {
      setIsWarningOpen(true);
    }
  }, [vaultExists]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validation
    if (masterPassword.length < 8) {
      setError(t('vault.minLengthError'));
      setIsLoading(false);
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError(t('vault.passwordMismatch'));
      setIsLoading(false);
      return;
    }

    if (passwordStrength.score < 3) {
      setError(t('vault.weakPasswordError'));
      setIsLoading(false);
      return;
    }

    await performCreation();
  };

  const performCreation = async () => {
    try {
      setIsLoading(true);
      await createVault(masterPassword);
      onSuccess?.();
      navigate('/vault');
    } catch (err) {
      setError(t('vault.createError'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthText = () => {
    if (passwordStrength.score >= 5) return t('vault.strength.veryStrong');
    if (passwordStrength.score >= 3) return t('vault.strength.strong');
    if (passwordStrength.score >= 2) return t('vault.strength.medium');
    return t('vault.strength.weak');
  };

  const getStrengthColor = () => {
    if (passwordStrength.score >= 5) return 'text-green-600';
    if (passwordStrength.score >= 3) return 'text-green-500';
    if (passwordStrength.score >= 2) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStrengthBarColor = () => {
    if (passwordStrength.score >= 5) return 'bg-green-500';
    if (passwordStrength.score >= 3) return 'bg-green-400';
    if (passwordStrength.score >= 2) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStrengthBarWidth = () => {
    const maxScore = 6; // hasMinLength(2) + hasUppercase(1) + hasLowercase(1) + hasNumber(1) + hasSpecialChar(1)
    return `${(passwordStrength.score / maxScore) * 100}%`;
  };

  return (
    <>
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-center text-foreground">
            {t('common.appName')}
          </CardTitle>
          <CardDescription className="text-center mt-2">
            {t('vault.createDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                  {t('auth.masterPassword')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder={t('vault.passwordPlaceholder')}
                    className="pr-10 h-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                  {t('vault.passwordConfirm')}
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('vault.passwordConfirmPlaceholder')}
                    className="pr-10 h-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {masterPassword && (
                <div className="space-y-3 p-4 bg-muted rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t('vault.strength.label')}</span>
                    <span className={`text-sm font-medium ${getStrengthColor()}`}>
                      {getStrengthText()}
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getStrengthBarColor()}`}
                      style={{ width: getStrengthBarWidth() }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center">
                      {passwordStrength.hasMinLength ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                      )}
                      <span>{t('vault.strength.min8Chars')}</span>
                    </div>
                    <div className="flex items-center">
                      {passwordStrength.hasUppercase ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                      )}
                      <span>{t('vault.strength.uppercase')}</span>
                    </div>
                    <div className="flex items-center">
                      {passwordStrength.hasLowercase ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                      )}
                      <span>{t('vault.strength.lowercase')}</span>
                    </div>
                    <div className="flex items-center">
                      {passwordStrength.hasNumber ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                      )}
                      <span>{t('vault.strength.number')}</span>
                    </div>
                    <div className="flex items-center">
                      {passwordStrength.hasSpecialChar ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mr-1.5" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-red-500 mr-1.5" />
                      )}
                      <span>{t('vault.strength.specialChar')}</span>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-4 space-x-3">
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="flex-1 h-12"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel')}
                  </Button>
                )}
                <Button
                  type="submit"
                  className="flex-1 h-12"
                  disabled={isLoading || !masterPassword || !confirmPassword}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('vault.creating')}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {t('vault.createVault')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={isWarningOpen} onOpenChange={setIsWarningOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('vault.createWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2 text-foreground font-medium">
              {t('vault.createWarningDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isLoading}
              onClick={() => onCancel?.()}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isLoading}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}