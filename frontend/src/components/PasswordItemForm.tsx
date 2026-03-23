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

import { Save, X, Eye, EyeOff, Key, Globe, User, FileText, Tag } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { usePasswordItems, useCategories, useForms, useModals } from '../stores/vaultStore';
import { PasswordItem } from '../types';
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

interface PasswordItemFormProps {
  onClose?: () => void;
  onSave?: (item: Partial<PasswordItem>) => void;
}

export function PasswordItemForm({ onClose, onSave }: PasswordItemFormProps) {
  const { addPasswordItem, updatePasswordItem, selectedItem } = usePasswordItems();
  const { categories } = useCategories();
  const { editingItemId, newItemForm, updateNewItemForm, resetNewItemForm } = useForms();
  const { togglePasswordItemForm, toggleCategoryManager } = useModals();
  const { t } = useTranslation();
  
  log('[PasswordItemForm] 렌더링됨');
  log('[PasswordItemForm] categories:', categories);
  log('[PasswordItemForm] newItemForm:', newItemForm);
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

  const isEditing = !!editingItemId;
  const currentItem = isEditing ? selectedItem : null;

  // Initialize form with current item data when editing
  useEffect(() => {
    if (isEditing && currentItem) {
      updateNewItemForm({
        title: currentItem.title,
        categoryId: currentItem.categoryId,
        username: currentItem.username,
        password: currentItem.password,
        url: currentItem.url,
        notes: currentItem.notes,
        tags: currentItem.tags,
        favorite: currentItem.favorite,
      });
    }
  }, [isEditing, currentItem, updateNewItemForm]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newItemForm.title?.trim()) {
      newErrors.title = t('vault.titleRequired');
    }

    if (!newItemForm.categoryId) {
      newErrors.categoryId = t('vault.categoryRequired');
    }

    if (!newItemForm.password?.trim()) {
      newErrors.password = t('vault.passwordRequired');
    }

    if (newItemForm.url && !isValidUrl(newItemForm.url)) {
      newErrors.url = t('vault.invalidUrl');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    log('[PasswordItemForm] handleSubmit 호출됨');
    log('[PasswordItemForm] newItemForm:', newItemForm);
    
    // 카테고리가 없는 경우 확인
    if (categories.length === 0 && !isEditing) {
      setErrors({ categoryId: t('vault.createCategoryFirst') });
      return;
    }
    
    if (!validateForm()) {
      log('[PasswordItemForm] 유효성 검사 실패:', errors);
      return;
    }

    log('[PasswordItemForm] 유효성 검사 통과, 저장 시작');
    setIsSubmitting(true);

    try {
      if (isEditing && editingItemId) {
        log('[PasswordItemForm] 항목 업데이트 중:', editingItemId);
        await updatePasswordItem(editingItemId, newItemForm);
      } else {
        log('[PasswordItemForm] 새 항목 추가 중');
        const result = await addPasswordItem({
          title: newItemForm.title || '',
          categoryId: newItemForm.categoryId || '',
          username: newItemForm.username || '',
          password: newItemForm.password || '',
          url: newItemForm.url || '',
          notes: newItemForm.notes || '',
          tags: newItemForm.tags || [],
          favorite: newItemForm.favorite || false,
        });
        log('[PasswordItemForm] 항목 추가 완료:', result);
      }

      onSave?.(newItemForm);
      handleClose();
    } catch (error) {
      logError('[PasswordItemForm] 저장 중 오류:', error);
      setErrors({ submit: t('vault.saveFailed') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    resetNewItemForm();
    togglePasswordItemForm(false);
    onClose?.();
  };

  const generateAndSetPassword = () => {
    // Generate a random password (simple implementation)
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    updateNewItemForm({ password });
  };

  const handleGeneratePassword = () => {
    // Show confirmation if password field is not empty
    if (newItemForm.password && newItemForm.password.trim() !== '') {
      setShowOverwriteConfirm(true);
      return;
    }
    generateAndSetPassword();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">
              {isEditing ? t('vault.editPassword') : t('vault.addNewPassword')}
            </CardTitle>
            <CardDescription className="mt-2">
              {isEditing ? t('vault.updatePasswordDetails') : t('vault.enterPasswordDetails')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-3">
            <Label htmlFor="title" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4" />
              {t('vault.titleLabel')}
            </Label>
            <Input
              id="title"
              value={newItemForm.title || ''}
              onChange={(e) => updateNewItemForm({ title: e.target.value })}
              placeholder={t('vault.titlePlaceholder')}
              className={`h-12 ${errors.title ? 'border-destructive' : ''}`}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-3">
            <Label htmlFor="category" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Tag className="h-4 w-4" />
              {t('vault.categoryLabel')}
            </Label>
            {categories.length === 0 ? (
              <div className="p-4 bg-muted rounded-xl border border-input">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('vault.noCategoriesAvailable')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleClose();
                    // CategoryManager 열기
                    setTimeout(() => {
                      toggleCategoryManager(true);
                    }, 100);
                  }}
                >
                  {t('vault.openCategoryManager')}
                </Button>
              </div>
            ) : (
              <select
                id="category"
                value={newItemForm.categoryId || ''}
                onChange={(e) => updateNewItemForm({ categoryId: e.target.value })}
                className={`w-full h-12 px-4 py-2 border rounded-xl bg-background text-foreground ${
                  errors.categoryId ? 'border-destructive' : 'border-input'
                }`}
              >
                <option value="">{t('vault.selectCategory')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
            {errors.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Username */}
            <div className="space-y-3">
              <Label htmlFor="username" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <User className="h-4 w-4" />
                {t('vault.usernameEmail')}
              </Label>
              <Input
                id="username"
                value={newItemForm.username || ''}
                onChange={(e) => updateNewItemForm({ username: e.target.value })}
                placeholder={t('vault.usernamePlaceholder')}
                className="h-12"
              />
            </div>

            {/* URL */}
            <div className="space-y-3">
              <Label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Globe className="h-4 w-4" />
                {t('vault.website')}
              </Label>
              <Input
                id="url"
                value={newItemForm.url || ''}
                onChange={(e) => updateNewItemForm({ url: e.target.value })}
                placeholder={t('vault.urlPlaceholder')}
                className={`h-12 ${errors.url ? 'border-destructive' : ''}`}
              />
              {errors.url && (
                <p className="text-sm text-destructive">{errors.url}</p>
              )}
            </div>
          </div>

          {/* Password */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Key className="h-4 w-4" />
                {t('vault.password')} *
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeneratePassword}
                >
                  {newItemForm.password ? t('generator.regenerate') : t('generator.generate')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword(!showPassword)}
                  className="h-8 w-8"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={newItemForm.password || ''}
                onChange={(e) => updateNewItemForm({ password: e.target.value })}
                placeholder={t('vault.passwordPlaceholderForm')}
                className={`h-12 ${errors.password ? 'border-destructive pr-10' : 'pr-10'}`}
              />
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <Label htmlFor="notes" className="text-sm font-medium text-foreground">{t('vault.notes')}</Label>
            <textarea
              id="notes"
              value={newItemForm.notes || ''}
              onChange={(e) => updateNewItemForm({ notes: e.target.value })}
              placeholder={t('vault.notesPlaceholder')}
              className="w-full px-4 py-3 border border-input rounded-xl min-h-24 resize-y bg-background text-foreground"
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label htmlFor="tags" className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Tag className="h-4 w-4" />
              {t('vault.tagsLabel')}
            </Label>
            <Input
              id="tags"
              value={newItemForm.tags?.join(', ') || ''}
              onChange={(e) => {
                const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
                updateNewItemForm({ tags });
              }}
              placeholder={t('vault.tagsPlaceholder')}
              className="h-12"
            />
          </div>

          {/* Favorite */}
          <div className="flex items-center space-x-3 p-4 bg-muted rounded-xl">
            <input
              type="checkbox"
              id="favorite"
              checked={newItemForm.favorite || false}
              onChange={(e) => updateNewItemForm({ favorite: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="favorite" className="cursor-pointer text-sm font-medium text-foreground">
              {t('vault.markAsFavorite')}
            </Label>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-4 bg-destructive/10 border border-destructive rounded-xl">
              <p className="text-sm text-destructive">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-12 px-6"
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="gap-2 h-12 px-6"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? t('vault.saving') : isEditing ? t('common.update') : t('common.save')}
            </Button>
          </div>
        </form>
      </CardContent>

      <AlertDialog open={showOverwriteConfirm} onOpenChange={setShowOverwriteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('generator.overwriteWarningTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('generator.overwriteWarning')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={generateAndSetPassword}>
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}