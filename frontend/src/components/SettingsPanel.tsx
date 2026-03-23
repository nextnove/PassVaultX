import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

import { Settings, Lock, Clipboard, Moon, Sun, Monitor, X, Save, RotateCcw, Download, Upload, Database, FolderOpen, FileSpreadsheet, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { useToast } from './ui/use-toast';
import { Input } from './ui/input';
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
import { useTheme } from '../hooks';
import { useModals } from '../stores/vaultStore';
import { AppConfig } from '../types';
import { GetConfig, UpdateConfig, SyncConfig, ResetConfig, ExportBackup, ImportBackup, ExportToExcel, ChangeMasterPassword } from '../../wailsjs/go/main/App';

interface SettingsPanelProps {
  onClose?: () => void;
  onSave?: (config: AppConfig) => void;
}

export function SettingsPanel({ onClose, onSave }: SettingsPanelProps) {
  const [config, setConfig] = useState<AppConfig>({
    autoLockMinutes: 5,
    clipboardAutoDeleteSeconds: 30,
    keyDerivationAlgorithm: 'pbkdf2',
    theme: 'system',
    language: 'ko',
    lockOnDeactivate: false,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportPasswordDialogOpen, setIsImportPasswordDialogOpen] = useState(false);
  const [importPassword, setImportPassword] = useState('');
  const [importPasswordError, setImportPasswordError] = useState<string | null>(null);
  const [isExcelWarningOpen, setIsExcelWarningOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { changeTheme } = useTheme();
  const { toggleCategoryManager } = useModals();
  const { t } = useTranslation();

  // Load saved config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const savedConfig = await GetConfig();
        setConfig(savedConfig as unknown as AppConfig);
        log('[SettingsPanel] 설정 로드 완료:', savedConfig);
      } catch (error) {
        logError('Failed to load config:', error);
      }
    };
    
    loadConfig();
  }, []);

  // Real-time password validation
  useEffect(() => {
    if (passwordForm.new && passwordForm.confirm) {
      if (passwordForm.new !== passwordForm.confirm) {
        setPasswordError(t('vault.passwordMismatch'));
      } else if (passwordForm.new.length < 8) {
        setPasswordError(t('vault.minLengthError'));
      } else {
        setPasswordError(null);
      }
    } else {
      setPasswordError(null);
    }
  }, [passwordForm.new, passwordForm.confirm, t]);

  // Reset password form when dialog closes
  useEffect(() => {
    if (!isChangePasswordOpen) {
      setPasswordForm({ current: '', new: '', confirm: '' });
      setPasswordError(null);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isChangePasswordOpen]);

  const handleConfigChange = (key: keyof AppConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    
    // Apply theme immediately when changed
    if (key === 'theme') {
      changeTheme(value as 'light' | 'dark' | 'system');
    }
  };

  const handleSave = async () => {
    try {
      const updatedConfig = await SyncConfig(config as any);
      setConfig(updatedConfig as unknown as AppConfig);
      setIsDirty(false);
      onSave?.(updatedConfig as unknown as AppConfig);
      log('[SettingsPanel] 설정 저장 완료:', updatedConfig);
    } catch (error) {
      logError('Failed to save config:', error);
    }
  };

  const handleReset = async () => {
    try {
      const defaultConfig = await ResetConfig();
      setConfig(defaultConfig as unknown as AppConfig);
      setIsDirty(false);
      log('[SettingsPanel] 설정 초기화 완료:', defaultConfig);
    } catch (error) {
      logError('Failed to reset config:', error);
    }
  };

  // 백업 내보내기 핸들러
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      // 파일 대화상자를 통해 백업 내보내기
      await ExportBackup();
      
      toast({
        title: t('settings.backupSuccessTitle'),
        description: t('settings.backupSuccessDescription'),
      });
      
      log('[SettingsPanel] 백업 내보내기 완료');
    } catch (error) {
      // Wails는 Go 에러를 Error 객체가 아닌 문자열로 전달하므로 String(error)로 변환
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('취소') || errorMessage.includes('cancel')) {
        log('[SettingsPanel] 백업 내보내기 취소됨');
        return;
      }
      
      logError('백업 내보내기 실패:', error);
      
      toast({
        title: t('settings.backupFailedTitle'),
        description: errorMessage || t('vault.createError'),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 백업 가져오기 시작 (비밀번호 입력 창 열기)
  const handleImportBackup = () => {
    setImportPassword('');
    setImportPasswordError(null);
    setIsImportPasswordDialogOpen(true);
  };

  // 백업 가져오기 실행 (비밀번호 검증 포함)
  const confirmImport = async () => {
    if (!importPassword) return;
    
    setIsImporting(true);
    setImportPasswordError(null);
    try {
      await ImportBackup(importPassword);
      
      toast({
        title: t('settings.restoreSuccessTitle'),
        description: t('settings.restoreSuccessDescription'),
      });
      
      log('[SettingsPanel] 백업 가져오기 완료');
      setIsImportPasswordDialogOpen(false);
    } catch (error) {
      const errorMessage = String(error);
      if (errorMessage.includes('cancel')) {
        setIsImportPasswordDialogOpen(false);
        return;
      }
      
      logError('백업 가져오기 실패:', error);
      
      if (errorMessage.includes('invalid backup password')) {
        setImportPasswordError(t('settings.invalidBackupPassword'));
      } else {
        setImportPasswordError(errorMessage || t('vault.createError'));
      }
    } finally {
      setIsImporting(false);
    }
  };

  // 엑셀 내보내기 핸들러
  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      await ExportToExcel();
      
      toast({
        title: t('settings.excelSuccessTitle'),
        description: t('settings.excelSuccessDescription'),
      });
      
      log('[SettingsPanel] 엑셀 내보내기 완료');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('취소') || errorMessage.includes('cancel')) {
        log('[SettingsPanel] 엑셀 내보내기 취소됨');
        return;
      }
      
      logError('엑셀 내보내기 실패:', error);
      
      toast({
        title: t('settings.excelFailedTitle'),
        description: errorMessage || t('vault.createError'),
        variant: 'destructive',
      });
    } finally {
      setIsExportingExcel(false);
      setIsExcelWarningOpen(false);
    }
  };

  // 마스터 비밀번호 변경 핸들러
  const handleChangeMasterPassword = async () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) {
      return;
    }

    if (passwordError) {
      return;
    }

    setIsChangingPassword(true);
    try {
      await ChangeMasterPassword(passwordForm.current, passwordForm.new);

      toast({
        title: t('common.success'),
        description: t('settings.passwordChangedSuccess'),
      });

      log('[SettingsPanel] 마스터 비밀번호 변경 완료');
      setIsChangePasswordOpen(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setPasswordError(null);
    } catch (error) {
      logError('마스터 비밀번호 변경 실패:', error);
      const errorMessage = String(error);
      
      if (errorMessage.includes('invalid old password')) {
        setPasswordError(t('settings.invalidCurrentPassword'));
      } else {
        setPasswordError(t('settings.passwordChangeFailed'));
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5" />
          <div>
            <h2 className="text-2xl font-bold text-foreground">{t('settings.title')}</h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('settings.description')}
            </p>
          </div>
        </div>
      </div>
    </div>
      
      <div className="space-y-8 pb-8">
        {/* Auto Lock Settings */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('settings.autoLock')}</h3>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="autoLock" className="text-sm font-medium text-foreground">{t('settings.autoLockDescription')}</Label>
            <Select
              value={config.autoLockMinutes.toString()}
              onValueChange={(value) => 
                handleConfigChange('autoLockMinutes', parseInt(value))
              }
            >
              <SelectTrigger id="autoLock" className="h-12">
                <SelectValue placeholder={t('settings.selectTime')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('settings.never')}</SelectItem>
                <SelectItem value="1">{t('settings.minute', { count: 1 })}</SelectItem>
                <SelectItem value="5">{t('settings.minute', { count: 5 })}</SelectItem>
                <SelectItem value="10">{t('settings.minute', { count: 10 })}</SelectItem>
                <SelectItem value="30">{t('settings.minute', { count: 30 })}</SelectItem>
                <SelectItem value="60">{t('settings.hour', { count: 1 })}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('settings.autoLockHelp')}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 border border-transparent hover:border-border transition-all">
            <div className="space-y-0.5">
              <Label htmlFor="lockOnDeactivate" className="text-sm font-medium cursor-pointer">
                {t('settings.lockOnDeactivate')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.autoLockDescription')}
              </p>
            </div>
            <div className="flex items-center h-6">
              <input
                type="checkbox"
                id="lockOnDeactivate"
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                checked={config.lockOnDeactivate}
                onChange={(e) => handleConfigChange('lockOnDeactivate', e.target.checked)}
              />
            </div>
          </div>
        </div>

        {/* Clipboard Settings */}
        <div className="space-y-5 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Clipboard className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('settings.clipboardSecurity')}</h3>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="clipboardClear" className="text-sm font-medium text-foreground">{t('settings.clearClipboardAfter')}</Label>
            <Select
              value={config.clipboardAutoDeleteSeconds.toString()}
              onValueChange={(value) => 
                handleConfigChange('clipboardAutoDeleteSeconds', parseInt(value))
              }
            >
              <SelectTrigger id="clipboardClear" className="h-12">
                <SelectValue placeholder={t('settings.selectTime')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">{t('settings.never')}</SelectItem>
                <SelectItem value="10">{t('settings.second', { count: 10 })}</SelectItem>
                <SelectItem value="30">{t('settings.second', { count: 30 })}</SelectItem>
                <SelectItem value="60">{t('settings.minute', { count: 1 })}</SelectItem>
                <SelectItem value="300">{t('settings.minute', { count: 5 })}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('settings.clipboardHelp')}
            </p>
          </div>
        </div>

        {/* Security Settings */}
        <div className="space-y-5 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('common.security')}</h3>
          </div>
          
          <div className="space-y-3">
            <Label htmlFor="keyDerivation" className="text-sm font-medium text-foreground">{t('settings.keyDerivation')}</Label>
            <Select
              value={config.keyDerivationAlgorithm}
              onValueChange={(value: 'pbkdf2' | 'scrypt' | 'argon2id') => 
                handleConfigChange('keyDerivationAlgorithm', value)
              }
            >
              <SelectTrigger id="keyDerivation" className="h-12">
                <SelectValue placeholder="Select algorithm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pbkdf2">PBKDF2 (Speed/Legacy)</SelectItem>
                <SelectItem value="scrypt">Scrypt (Memory-Hard)</SelectItem>
                <SelectItem value="argon2id">Argon2id (Modern/Best)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('settings.keyDerivationHelp')}
            </p>
          </div>

          {/* Master Password Change Button */}
          <div className="pt-4 border-t border-border/50">
            <AlertDialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
              <Button
                variant="outline"
                onClick={() => setIsChangePasswordOpen(true)}
                className="h-12 w-full"
              >
                <Lock className="h-4 w-4 mr-2" />
                {t('settings.changeMasterPassword')}
              </Button>
              <AlertDialogContent className="sm:max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.changeMasterPassword')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.changeMasterPasswordDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">{t('settings.currentPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">{t('settings.newPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">{t('settings.confirmNewPassword')}</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <Alert variant="destructive" className="py-2 px-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {passwordError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setPasswordForm({ current: '', new: '', confirm: '' })}>
                    {t('common.cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                        e.preventDefault();
                        handleChangeMasterPassword();
                    }}
                    disabled={isChangingPassword || !passwordForm.current || !passwordForm.new || passwordForm.new !== passwordForm.confirm}
                    className="bg-primary text-primary-foreground"
                  >
                    {isChangingPassword ? t('common.loading') : t('common.save')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Theme Settings */}
        <div className="space-y-5 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('settings.appearance')}</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium text-foreground">{t('settings.theme')}</Label>
              <RadioGroup
                value={config.theme}
                onValueChange={(value: 'light' | 'dark' | 'system') => 
                  handleConfigChange('theme', value)
                }
                className="flex flex-col space-y-3"
              >
                <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted">
                  <RadioGroupItem value="light" id="light" />
                  <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Sun className="h-4 w-4" />
                    {t('settings.light')}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted">
                  <RadioGroupItem value="dark" id="dark" />
                  <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Moon className="h-4 w-4" />
                    {t('settings.dark')}
                  </Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-xl hover:bg-muted">
                  <RadioGroupItem value="system" id="system" />
                  <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Monitor className="h-4 w-4" />
                    {t('settings.system')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50">
              <Label className="text-sm font-medium text-foreground">{t('settings.language')}</Label>
              <LanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Category Management */}
        <div className="space-y-5 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('sidebar.categories')}</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('category.description')}
            </p>
            
            <Button
              variant="outline"
              onClick={() => toggleCategoryManager(true)}
              className="h-12 w-full"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {t('vault.manageCategories')}
            </Button>
          </div>
        </div>

        {/* Backup & Restore Settings */}
        <div className="space-y-5 pt-6 border-t border-border">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <h3 className="text-lg font-semibold text-foreground">{t('settings.backupRestore')}</h3>
          </div>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('settings.backupRestoreHelp')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3">
              {/* 백업 내보내기 버튼 */}
              <Button
                variant="outline"
                onClick={handleExportBackup}
                disabled={isExporting || isImporting}
                className="h-12 flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? t('settings.exporting') : t('settings.exportBackup')}
              </Button>
              
              {/* 백백 가져오기 버튼 */}
              <Button
                variant="outline"
                onClick={handleImportBackup}
                disabled={isExporting || isImporting || isExportingExcel}
                className="h-12 flex-1"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? t('settings.importing') : t('settings.importBackup')}
              </Button>

              {/* 백업 가져오기 비밀번호 입력 다이얼로그 */}
              <AlertDialog open={isImportPasswordDialogOpen} onOpenChange={setIsImportPasswordDialogOpen}>
                <AlertDialogContent className="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('settings.importPasswordTitle')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.importPasswordDescription')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="import-password">{t('vault.masterPassword')}</Label>
                      <div className="relative">
                        <Input
                          id="import-password"
                          type={showNewPassword ? 'text' : 'password'}
                          value={importPassword}
                          onChange={(e) => setImportPassword(e.target.value)}
                          placeholder={t('vault.passwordPlaceholder')}
                          className="pr-10"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && importPassword && !isImporting) {
                              confirmImport();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {importPasswordError && (
                      <Alert variant="destructive" className="py-2 px-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {importPasswordError}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isImporting}>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        confirmImport();
                      }}
                      disabled={!importPassword || isImporting}
                    >
                      {isImporting ? t('common.loading') : t('common.confirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* 엑셀 내보내기 버튼 (보안 경고 다이얼로그 포함) */}
            <div className="pt-2">
              <AlertDialog open={isExcelWarningOpen} onOpenChange={setIsExcelWarningOpen}>
                <Button
                  variant="outline"
                  onClick={() => setIsExcelWarningOpen(true)}
                  disabled={isExporting || isImporting || isExportingExcel}
                  className="h-12 w-full text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {isExportingExcel ? t('settings.exporting') : t('settings.exportToExcel')}
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                      <FileSpreadsheet className="h-5 w-5" />
                      {t('settings.securityWarning')}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-3 pt-2">
                      <p className="font-semibold text-foreground">
                        {t('settings.unencryptedWarning')}
                      </p>
                      <p>
                        {t('settings.unencryptedWarningHelp')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('settings.excelHelp')}
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleExportExcel}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {t('settings.understandAndContinue')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                <strong>{t('settings.warning')}:</strong> {t('settings.importWarning')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-8 border-t border-border">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!isDirty}
            className="h-12 px-6"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {t('settings.resetToDefaults')}
          </Button>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-12 px-6"
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!isDirty}
              className="gap-2 h-12 px-6"
            >
              <Save className="h-4 w-4" />
              {t('settings.saveChanges')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}