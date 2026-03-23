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

import { useVault, useModals } from '../stores/vaultStore';
import { useAutoLock, useTheme } from '../hooks';
import { Sidebar } from './Sidebar';
import { PasswordList } from './PasswordList';
import { PasswordDetail } from './PasswordDetail';
import { SearchBar } from './SearchBar';
import { SettingsPanel } from './SettingsPanel';
import { CategoryManager } from './CategoryManager';
import { PasswordItemForm } from './PasswordItemForm';
import { PasswordGenerator } from './PasswordGenerator';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { Toaster } from './ui/toaster';
import { Button } from './ui/button';
import { Lock, Settings, Clock, Tag } from 'lucide-react';
import { AppConfig, DEFAULT_CONFIG } from '../types';
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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

export function VaultPage() {
  const { lockVault } = useVault();
  const { 
    showSettings,
    showCategoryManager,
    showPasswordItemForm,
    showPasswordGenerator,
    showDeleteConfirm,
    toggleSettings,
    toggleCategoryManager,
    togglePasswordItemForm,
    togglePasswordGenerator,
    toggleDeleteConfirm
  } = useModals();
  const { t } = useTranslation();
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(DEFAULT_CONFIG.autoLockMinutes);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
  
  // Initialize theme
  const { theme, changeTheme } = useTheme();

  // Handle responsive sidebar collapse
  useEffect(() => {
    const handleResize = () => {
      const isSmallScreen = window.innerWidth < 1024;
      
      // 화면이 작아지면 자동으로 닫기
      if (isSmallScreen) {
        setIsSidebarCollapsed(true);
      } 
      // 화면이 커지면, 사용자가 수동으로 닫지 않았을 경우에만 열기
      else if (!isManuallyCollapsed) {
        setIsSidebarCollapsed(false);
      }
    };

    // Check on mount
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManuallyCollapsed]);

  // 사이드바 토글 핸들러 (사용자가 수동으로 클릭)
  const handleSidebarToggle = () => {
    const newCollapsedState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newCollapsedState);
    
    // 화면이 큰 상태에서 사용자가 수동으로 닫은 경우만 기록
    if (window.innerWidth >= 1024) {
      setIsManuallyCollapsed(newCollapsedState);
    }
  };

  // Load auto-lock configuration from localStorage
  useEffect(() => {
    const loadConfig = () => {
      try {
        const savedConfig = localStorage.getItem('passvaultx-config');
        if (savedConfig) {
          const config: AppConfig = JSON.parse(savedConfig);
          setAutoLockMinutes(config.autoLockMinutes);
        }
      } catch (error) {
        logError('Failed to load auto-lock config:', error);
      }
    };

    loadConfig();
    
    // Listen for config changes (e.g., when settings are saved)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'passvaultx-config') {
        loadConfig();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Initialize auto-lock hook
  const autoLock = useAutoLock(autoLockMinutes);

  const handleLockVault = async () => {
    setShowLockConfirm(false);
    await lockVault();
    // Navigate to login page - this will be handled by the parent component
    log('Vault locked, should navigate to login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Lock Confirmation Dialog */}
      <AlertDialog open={showLockConfirm} onOpenChange={setShowLockConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('vault.lockConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('vault.lockConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLockVault}>
              {t('vault.lock')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sidebar with Title and Actions */}
      <div className={`border-r border-border bg-card flex flex-col overflow-hidden transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-64'
      }`}>
        {/* Title and Actions Section */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            {!isSidebarCollapsed && (
              <h1 className="text-2xl font-bold text-foreground">{t('common.appName')}</h1>
            )}
            <button
              onClick={handleSidebarToggle}
              className="group p-1.5 hover:bg-muted rounded-lg transition-colors ml-auto cursor-pointer"
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 20 20" 
                fill="currentColor" 
                xmlns="http://www.w3.org/2000/svg" 
                className={`transition-all text-muted-foreground group-hover:text-foreground ${
                  isSidebarCollapsed ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              >
                <path d="M16.5 4C17.3284 4 18 4.67157 18 5.5V14.5C18 15.3284 17.3284 16 16.5 16H3.5C2.67157 16 2 15.3284 2 14.5V5.5C2 4.67157 2.67157 4 3.5 4H16.5ZM7 15H16.5C16.7761 15 17 14.7761 17 14.5V5.5C17 5.22386 16.7761 5 16.5 5H7V15ZM3.5 5C3.22386 5 3 5.22386 3 5.5V14.5C3 14.7761 3.22386 15 3.5 15H6V5H3.5Z"></path>
              </svg>
            </button>
          </div>
          
          {/* Auto-lock Info */}
          {!isSidebarCollapsed && autoLock.isEnabled && autoLockMinutes > 0 && (
            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4 p-2 bg-muted/50 rounded-lg">
              <Clock className="h-4 w-4" />
              <span>
                {t('vault.settings_autoLock')}: {autoLockMinutes} min
                {autoLock.remainingTime > 0 && (
                  <span className="block text-xs mt-0.5">
                    ({Math.ceil(autoLock.remainingTime / 60000)} min remaining)
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleCategoryManager()}
              className={`w-full flex items-center space-x-2 ${
                isSidebarCollapsed ? 'justify-center px-2' : 'justify-start'
              }`}
              title={t('vault.manageCategories')}
            >
              <Tag className="h-4 w-4" />
              {!isSidebarCollapsed && <span>{t('vault.manageCategories')}</span>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSettings()}
              className={`w-full flex items-center space-x-2 ${
                isSidebarCollapsed ? 'justify-center px-2' : 'justify-start'
              }`}
              title={t('vault.settings')}
            >
              <Settings className="h-4 w-4" />
              {!isSidebarCollapsed && <span>{t('vault.settings')}</span>}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLockConfirm(true)}
              className={`w-full flex items-center space-x-2 ${
                isSidebarCollapsed ? 'justify-center px-2' : 'justify-start'
              }`}
              title={t('vault.lockVault')}
            >
              <Lock className="h-4 w-4" />
              {!isSidebarCollapsed && <span>{t('vault.lockVault')}</span>}
            </Button>
          </div>
        </div>

        {/* Categories Section */}
        <div className="flex-1 overflow-y-auto">
          <Sidebar isCollapsed={isSidebarCollapsed} />
        </div>
      </div>

      {/* Main Content Area - 2 Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Password List Panel */}
        <div className="flex-1 border-r border-border bg-card">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">{t('vault.passwords')}</h2>
              </div>
              <SearchBar />
            </div>
            <div className="flex-1 overflow-hidden">
              <PasswordList />
            </div>
          </div>
        </div>

        {/* Password Detail Panel */}
        <div className="flex-1 bg-card">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{t('vault.details')}</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <PasswordDetail />
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <Dialog open={showSettings} onOpenChange={(open) => toggleSettings(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="settings-description">
          <DialogTitle className="sr-only">Settings</DialogTitle>
          <DialogDescription id="settings-description" className="sr-only">
            Configure your password manager preferences
          </DialogDescription>
          <SettingsPanel 
            onClose={() => toggleSettings(false)} 
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showCategoryManager} onOpenChange={(open) => toggleCategoryManager(open)}>
        <DialogContent className="max-w-md" aria-describedby="category-manager-description">
          <DialogTitle className="sr-only">Category Manager</DialogTitle>
          <DialogDescription id="category-manager-description" className="sr-only">
            Add, edit, or delete categories for organizing passwords
          </DialogDescription>
          <CategoryManager 
            onClose={() => toggleCategoryManager(false)} 
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showPasswordItemForm} onOpenChange={(open) => togglePasswordItemForm(open)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" aria-describedby="password-form-description">
          <DialogTitle className="sr-only">Password Form</DialogTitle>
          <DialogDescription id="password-form-description" className="sr-only">
            Add or edit password details
          </DialogDescription>
          <PasswordItemForm 
            onClose={() => togglePasswordItemForm(false)} 
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={showPasswordGenerator} onOpenChange={(open) => togglePasswordGenerator(open)}>
        <DialogContent className="max-w-md" aria-describedby="password-generator-description">
          <DialogTitle className="sr-only">Password Generator</DialogTitle>
          <DialogDescription id="password-generator-description" className="sr-only">
            Generate a strong, secure password
          </DialogDescription>
          <PasswordGenerator 
            onClose={() => togglePasswordGenerator(false)} 
          />
        </DialogContent>
      </Dialog>
      
      {showDeleteConfirm && (
        <DeleteConfirmDialog 
          isOpen={showDeleteConfirm} 
          onClose={() => toggleDeleteConfirm(false)} 
          onConfirm={() => toggleDeleteConfirm(false)}
          title={t('vault.deleteConfirmTitle')}
          description={t('vault.deleteConfirmDescription')}
        />
      )}
      
      <Toaster />
    </div>
  );
}