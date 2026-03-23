import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff, AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { useVault } from '../stores/vaultStore';
import { useNavigate } from 'react-router-dom';

interface LoginPageProps {
  onUnlockSuccess?: () => void;
  onCreateVault?: () => void;
}

export function LoginPage({ onUnlockSuccess, onCreateVault }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { unlockVault } = useVault();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError(t('auth.enterPassword'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await unlockVault(password);
      setError(null);
      onUnlockSuccess?.();
      navigate('/vault');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Map specific backend errors to localized strings if needed, 
      // but showing the actual message is better for debugging.
      setError(errorMessage === 'invalid master password' ? t('auth.invalidPassword') : errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateVault = () => {
    onCreateVault?.();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Card className="shadow-xl border-0 relative">          
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Lock className="h-10 w-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center text-foreground">
              {t('common.appName')}
            </CardTitle>
            <CardDescription className="text-muted-foreground mt-2">
              {t('auth.appDescription')}
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
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.masterPasswordPlaceholder')}
                      className="pr-10 h-12"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium"
                  disabled={isLoading || !password.trim()}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.unlocking')}
                    </span>
                  ) : (
                    t('auth.unlockVault')
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground pt-2">
                  <p className="text-sm text-muted-foreground">
                    {t('auth.isItFirstTime')}{' '}
                    <button
                      type="button"
                      onClick={handleCreateVault}
                      className="text-primary hover:text-primary/80 font-medium hover:underline"
                    >
                      {t('auth.createNewVault')}
                    </button>
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}