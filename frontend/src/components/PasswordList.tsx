import { useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};

import { usePasswordItems, useSearch, useModals } from '../stores/vaultStore';
import { PasswordCard } from './PasswordCard';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { useToast } from './ui/use-toast';
import { Search, Plus } from 'lucide-react';
import { Button } from './ui/button';

// 렌더링 최적화 - useMemo/useCallback 최적화
export function PasswordList() {
  const { filteredItems, selectedItem, selectItem, items, deletePasswordItem } = usePasswordItems();
  const { searchQuery, searchResultCount, showFavoritesOnly } = useSearch();
  const { togglePasswordItemForm } = useModals();
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  log('[PasswordList] 렌더링됨, filteredItems 개수:', filteredItems.length);
  log('[PasswordList] 전체 items 개수:', items.length);
  log('[PasswordList] items:', items);
  log('[PasswordList] items categoryIds:', items.map(item => ({ title: item.title, categoryId: item.categoryId })));
  log('[PasswordList] filteredItems:', filteredItems);

  // useCallback으로 핸들러 메모이제이션
  const handleAddItem = useCallback(() => {
    log('[PasswordList] Add First Item 버튼 클릭됨');
    togglePasswordItemForm(true);
  }, [togglePasswordItemForm]);

  const handleSelectItem = useCallback((itemId: string) => {
    log('[PasswordList] 항목 클릭됨, itemId:', itemId);
    log('[PasswordList] selectItem 호출 전, selectedItem:', selectedItem);
    selectItem(itemId);
    log('[PasswordList] selectItem 호출 완료');
  }, [selectItem, selectedItem]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setDeleteConfirmId(itemId);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    
    setIsDeleting(true);
    try {
      await deletePasswordItem(deleteConfirmId);
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
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, deletePasswordItem, toast, t]);

  // useMemo로 렌더링 최적화
  const emptyState = useMemo(() => {
    // Favorites 페이지인 경우
    if (showFavoritesOnly) {
      return (
        <div className="h-full flex flex-col items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
              <Search className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              {t('vault.noFavoriteItems')}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t('vault.markAsFavoriteToSee')}
            </p>
          </div>
        </div>
      );
    }
    
    // 일반 페이지 (All Items, 카테고리)
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-muted rounded-xl flex items-center justify-center mx-auto mb-6">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-3">
            {searchQuery ? t('vault.noMatchingItems') : t('vault.noPasswordItems')}
          </h3>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {searchQuery
              ? t('vault.adjustSearchTerms')
              : t('vault.addFirstItemToStart')}
          </p>
          <Button onClick={handleAddItem} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>{t('vault.addFirstItem')}</span>
          </Button>
        </div>
      </div>
    );
  }, [searchQuery, showFavoritesOnly, handleAddItem]);

  if (filteredItems.length === 0) {
    return emptyState;
  }

  return (
    <div className="h-full flex flex-col p-6">
      {/* List Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-foreground">
            {t('vault.item', { count: searchResultCount })}
          </span>
          {searchQuery && (
            <span className="text-sm text-muted-foreground">
              {t('vault.searchQueryFor', { query: searchQuery })}
            </span>
          )}
        </div>
        <Button onClick={handleAddItem} size="sm" className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>{t('vault.addItem')}</span>
        </Button>
      </div>

      {/* Password Items List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <PasswordCard
              key={item.id}
              item={item}
              isSelected={selectedItem?.id === item.id}
              onClick={() => handleSelectItem(item.id)}
              onDelete={(e) => handleDeleteClick(e, item.id)}
            />
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <DeleteConfirmDialog
          isOpen={!!deleteConfirmId}
          onClose={() => setDeleteConfirmId(null)}
          onConfirm={handleConfirmDelete}
          title={t('vault.deletePasswordTitle')}
          description={t('vault.deletePasswordConfirm', { 
            title: items.find(i => i.id === deleteConfirmId)?.title || '' 
          })}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}