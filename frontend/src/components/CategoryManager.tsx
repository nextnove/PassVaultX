import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

import { Plus, Edit2, Trash2, X, Save, AlertTriangle, GripVertical } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { useCategories } from '../stores/vaultStore';
import { Category } from '../types';

interface CategoryManagerProps {
  onClose?: () => void;
}

export function CategoryManager({ onClose }: CategoryManagerProps) {
  log('[CategoryManager] 컴포넌트 렌더링됨');
  
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useCategories();
  const { t, i18n } = useTranslation();
  
  log('[CategoryManager] categories:', categories);
  log('[CategoryManager] addCategory 함수:', typeof addCategory);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    
    // 드래그 시 반투명 효과를 위해 0.001초 후 클래스 추가 (드래그 이미지 보존용)
    const target = e.currentTarget as HTMLElement;
    setTimeout(() => {
      target.classList.add('opacity-40');
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedId(null);
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('opacity-40');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId === targetId) return;

    const newOrder = [...categories];
    const sourceIndex = newOrder.findIndex(c => c.id === sourceId);
    const targetIndex = newOrder.findIndex(c => c.id === targetId);

    if (sourceIndex > -1 && targetIndex > -1) {
      const [removed] = newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, removed);
      
      try {
        await reorderCategories(newOrder.map(c => c.id));
      } catch (err) {
        setError(t('sidebar.categoryAddError')); // 순서 변경 실패 메시지 (적절한 키가 없으면 재사용)
      }
    }
  };

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setEditName(category.name);
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) {
      setError(t('sidebar.categoryEmptyError'));
      return;
    }

    try {
      await updateCategory(editingId, editName.trim());
      setSuccess(t('category.updatedSuccess'));
      setEditingId(null);
      setEditName('');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('sidebar.categoryAddError');
      logError('카테고리 수정 실패:', error);
      setError(errorMessage);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setError(t('sidebar.categoryEmptyError'));
      return;
    }

    // Check for duplicate name
    if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      setError(t('sidebar.categoryExistsError'));
      return;
    }

    log('[CategoryManager] 카테고리 추가 시도:', newCategoryName.trim());
    
    try {
      const newCategory = await addCategory(newCategoryName.trim());
      log('[CategoryManager] 카테고리 추가 성공:', newCategory);
      setSuccess(t('category.addedSuccess'));
      setNewCategoryName('');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : t('sidebar.categoryAddError'));
      logError('[CategoryManager] 카테고리 추가 실패:', error);
      setError(errorMessage);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setIsDeleting(true);
    try {
      await deleteCategory(categoryId);
      setSuccess(t('category.deletedSuccess'));
      setDeleteConfirmId(null);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : (error instanceof Error ? error.message : t('sidebar.categoryDeleteError', 'Cannot delete category: it may be in use'));
      logError('카테고리 삭제 실패:', error);
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'edit' | 'add') => {
    if (e.key === 'Enter') {
      if (action === 'edit') {
        handleSaveEdit();
      } else {
        handleAddCategory();
      }
    } else if (e.key === 'Escape') {
      if (action === 'edit') {
        handleCancelEdit();
      } else {
        setNewCategoryName('');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('category.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('category.description')}
          </p>
        </div>
      </div>
      
      {/* Add New Category */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">{t('category.addNew')}</h3>
        <div className="flex gap-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, 'add')}
            placeholder={t('category.placeholder')}
            className="flex-1"
          />
          <Button onClick={() => {
            log('[CategoryManager] Add 버튼 클릭됨');
            handleAddCategory();
          }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('common.add')}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Categories List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('category.existing')}</h3>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('category.noCategories')}
          </p>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <div
                key={category.id}
                draggable={editingId !== category.id}
                onDragStart={(e) => handleDragStart(e, category.id)}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, category.id)}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 group ${
                  draggedId === category.id ? 'opacity-40' : ''
                }`}
              >
                {/* Drag Handle */}
                <div className="mr-2 cursor-grab active:cursor-grabbing text-muted-foreground/50 group-hover:text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                {editingId === category.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, 'edit')}
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleSaveEdit}
                      className="h-8 w-8"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <span className="font-medium">{category.name}</span>
                      <p className="text-xs text-muted-foreground">
                        {t('vault.created')}: {new Date(category.createdAt).toLocaleDateString(i18n.language)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleStartEdit(category)}
                        className="h-8 w-8"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(category.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDeleteCategory(deleteConfirmId)}
        title={t('category.deleteTitle')}
        description={t('category.deleteConfirm')}
        isDeleting={isDeleting}
      />
    </div>
  );
}