import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

import { CopyToClipboard } from '../../wailsjs/go/main/App';
import { usePasswordItems, useCategories, useModals } from '../stores/vaultStore';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { 
  Eye, 
  EyeOff, 
  Copy, 
  Edit, 
  Trash2, 
  Star, 
  Globe, 
  User, 
  Lock, 
  ExternalLink,
  Check,
  Folder
} from 'lucide-react';

// 렌더링 최적화 - useMemo/useCallback 최적화
export function PasswordDetail() {
  const { selectedItem, updatePasswordItem, deletePasswordItem } = usePasswordItems();
  const { categories } = useCategories();
  const { togglePasswordItemForm } = useModals();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  log('[PasswordDetail] 렌더링됨');
  log('[PasswordDetail] selectedItem:', selectedItem);

  // useCallback으로 핸들러 메모이제이션
  const handleCopyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      // Use the IPC bridge to copy to clipboard with auto-delete
      await CopyToClipboard(text, 30); // 30 seconds auto-delete
      
      setIsCopied(true);
      
      // Show success toast
      toast({
        variant: "success",
        title: t('vault.copySuccessTitle'),
        description: t('vault.copySuccessDescription', { field: fieldName }),
        duration: 3000,
      });
      
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      logError('Failed to copy:', err);
      toast({
        variant: "destructive",
        title: t('vault.copyFailedTitle'),
        description: t('vault.copyFailedDescription'),
        duration: 3000,
      });
    }
  }, [toast]);

  const handleCopyPassword = useCallback(() => {
    if (selectedItem) {
      handleCopyToClipboard(selectedItem.password, t('vault.password'));
    }
  }, [selectedItem, handleCopyToClipboard, t]);

  const handleCopyUsername = useCallback(() => {
    if (selectedItem) {
      handleCopyToClipboard(selectedItem.username || '', t('vault.usernameEmail'));
    }
  }, [selectedItem, handleCopyToClipboard, t]);

  const handleOpenUrl = useCallback(() => {
    if (selectedItem?.url) {
      window.open(selectedItem.url, '_blank', 'noopener,noreferrer');
    }
  }, [selectedItem?.url]);

  const handleToggleFavorite = useCallback(() => {
    if (selectedItem) {
      updatePasswordItem(selectedItem.id, { favorite: !selectedItem.favorite });
    }
  }, [selectedItem, updatePasswordItem]);

  const handleDelete = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);
  
  const handleEdit = useCallback(() => {
    if (selectedItem) {
      log('[PasswordDetail] Edit 버튼 클릭됨, itemId:', selectedItem.id);
      togglePasswordItemForm(true, selectedItem.id);
    }
  }, [selectedItem, togglePasswordItemForm]);

  const handleConfirmDelete = useCallback(async () => {
    if (!selectedItem) return;
    
    setIsDeleting(true);
    try {
      await deletePasswordItem(selectedItem.id);
      toast({
        variant: "default",
        title: t('vault.passwordDeletedTitle'),
        description: t('vault.passwordDeletedDescription'),
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t('vault.deleteFailedTitle'),
        description: t('vault.deleteFailedDescription'),
        duration: 3000,
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }, [selectedItem, deletePasswordItem, toast]);

  const getCategoryName = useCallback((categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || t('vault.uncategorized');
  }, [categories, t]);

  // useMemo로 빈 상태 메모이제이션
  const emptyState = useMemo(() => (
    <div className="h-full flex items-center justify-center text-muted-foreground p-8">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-muted flex items-center justify-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-3">{t('vault.noPasswordSelected')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t('vault.selectPasswordToView')}
        </p>
      </div>
    </div>
  ), []);

  if (!selectedItem) {
    return emptyState;
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {selectedItem.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              {t('vault.lastUpdated', { date: new Date(selectedItem.updatedAt).toLocaleDateString(i18n.language) })}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="flex items-center space-x-2"
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleFavorite}
              className="flex items-center space-x-2"
            >
              <Star className={`h-4 w-4 ${selectedItem.favorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Username/Email */}
          <div className="space-y-3">
            <Label htmlFor="username" className="text-sm font-medium text-foreground">{t('vault.usernameEmail')}</Label>
            <div className="flex items-center space-x-3">
              <div className="flex-1 flex items-center space-x-3 bg-muted px-4 py-3 rounded-xl border border-border">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 text-foreground">{selectedItem.username}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyUsername()}
                  className="h-8 px-2"
                >
                  {isCopied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">{t('vault.password')}</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
                className="h-8 px-2"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-1 flex items-center space-x-3 bg-muted px-4 py-3 rounded-xl border border-border">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 font-mono text-foreground">
                  {showPassword ? selectedItem.password : '•'.repeat(12)}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyPassword}
                className="h-11 px-4"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* URL */}
          {selectedItem.url && (
            <div className="space-y-3">
              <Label htmlFor="url" className="text-sm font-medium text-foreground">{t('vault.website')}</Label>
              <div className="flex items-center space-x-3">
                <div className="flex-1 flex items-center space-x-3 bg-muted px-4 py-3 rounded-xl border border-border">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-foreground">{selectedItem.url}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenUrl}
                  className="h-11 px-4"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Category */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">{t('vault.category')}</Label>
            <div className="flex items-center space-x-3 bg-muted px-4 py-3 rounded-xl border border-border">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{getCategoryName(selectedItem.categoryId || '')}</span>
            </div>
          </div>

          {/* Notes */}
          {selectedItem.notes && (
            <div className="space-y-3">
              <Label htmlFor="notes" className="text-sm font-medium text-foreground">{t('vault.notes')}</Label>
              <div className="bg-muted px-4 py-3 rounded-xl border border-border min-h-25">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedItem.notes}
                </p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-border">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('vault.created')}</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(selectedItem.createdAt).toLocaleDateString(i18n.language)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('vault.settings_autoLock_updatedAt', { defaultValue: t('vault.last_updated') || 'Last Updated' })}</p>
              <p className="text-sm font-medium text-foreground">
                {new Date(selectedItem.updatedAt).toLocaleDateString(i18n.language)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-8 border-t border-border mt-8">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            className="flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t('common.delete')}
          </Button>
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              {t('common.edit')}
            </Button>
            <Button size="sm" onClick={handleCopyPassword}>
              <Copy className="h-4 w-4 mr-2" />
              {t('vault.copyPassword')}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleConfirmDelete}
        title={t('vault.deletePasswordTitle')}
        description={t('vault.deletePasswordConfirm', { title: selectedItem.title })}
        isDeleting={isDeleting}
      />
    </div>
  );
}