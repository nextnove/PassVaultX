import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Key, RefreshCw, Check, X, Copy as CopyIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Checkbox } from './ui/checkbox';
import { usePasswordGenerator } from '../hooks/usePasswordGenerator';
import { PasswordOptions } from '../types';

interface PasswordGeneratorProps {
  onPasswordGenerated?: (password: string) => void;
  onClose?: () => void;
}

export function PasswordGenerator({ onPasswordGenerated, onClose }: PasswordGeneratorProps) {
  const [password, setPassword] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [options, setOptions] = useState<PasswordOptions>({
    length: 16,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
  });
  const { t } = useTranslation();

  const { generatePassword, strength, strengthLabel, strengthColor } = usePasswordGenerator();

  const handleOptionChange = (key: keyof PasswordOptions, value: boolean | number) => {
    setOptions(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleGenerate = () => {
    const newPassword = generatePassword(options);
    setPassword(newPassword);
    onPasswordGenerated?.(newPassword);
  };

  const handleCopy = async () => {
    if (password) {
      await navigator.clipboard.writeText(password);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleUsePassword = () => {
    if (password) {
      onPasswordGenerated?.(password);
      onClose?.();
    }
  };

  useEffect(() => {
    handleGenerate();
  }, []);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {t('generator.title')}
        </CardTitle>
        <CardDescription>
          {t('generator.description')}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Generated Password */}
        <div className="space-y-2">
          <Label>{t('generator.generatedPassword')}</Label>
          <div className="flex items-center gap-2">
            <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-lg border">
              {password || t('generator.clickGenerate')}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={handleCopy}
              className="h-10 w-10"
            >
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <CopyIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
          {password && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>{t('generator.strength', { strength })}</span>
                </div>
                <span className="text-muted-foreground">•</span>
                <span className={strengthColor}>{t(`generator.${strengthLabel.toLowerCase()}`, { defaultValue: strengthLabel })}</span>
              </div>
            </div>
          )}
        </div>

        {/* Length Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t('generator.length', { length: options.length })}</Label>
            <span className="text-sm text-muted-foreground">
              {options.length >= 12 ? t('generator.strong') : t('generator.weak')}
            </span>
          </div>
          <Slider
            min={8}
            max={32}
            step={1}
            value={[options.length]}
            onValueChange={([value]) => 
              handleOptionChange('length', value)
            }
          />
        </div>

        {/* Character Options */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="uppercase"
              checked={options.includeUppercase}
              onCheckedChange={(checked) => 
                handleOptionChange('includeUppercase', checked as boolean)
              }
            />
            <Label htmlFor="uppercase">{t('generator.uppercase')}</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="lowercase"
              checked={options.includeLowercase}
              onCheckedChange={(checked) => 
                handleOptionChange('includeLowercase', checked as boolean)
              }
            />
            <Label htmlFor="lowercase">{t('generator.lowercase')}</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="numbers"
              checked={options.includeNumbers}
              onCheckedChange={(checked) => 
                handleOptionChange('includeNumbers', checked as boolean)
              }
            />
            <Label htmlFor="numbers">{t('generator.numbers')}</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="symbols"
              checked={options.includeSymbols}
              onCheckedChange={(checked) => 
                handleOptionChange('includeSymbols', checked as boolean)
              }
            />
            <Label htmlFor="symbols">{t('generator.symbols')}</Label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            <X className="mr-2 h-4 w-4" />
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleGenerate}
            className="flex-1"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('generator.regenerate')}
          </Button>
          <Button
            onClick={handleUsePassword}
            className="flex-1"
            disabled={!password}
          >
            <Check className="mr-2 h-4 w-4" />
            {t('generator.usePassword')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}