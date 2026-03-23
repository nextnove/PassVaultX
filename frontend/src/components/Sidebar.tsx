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

import { useCategories, useSearch, usePasswordItems } from '../stores/vaultStore';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { 
  Star, 
  Folder, 
  Plus, 
  ChevronRight, 
  BanknoteIcon as Bank, 
  Globe, 
  Code, 
  ShoppingBag, 
  Users, 
  FolderOpen,
  Check,
  X,
  Mail,
  Briefcase,
  CreditCard,
  Gamepad2,
  Plane,
  GraduationCap,
  Film,
  Smartphone
} from 'lucide-react';

export function Sidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const { categories, currentCategory, currentCategoryId, setCurrentCategory, addCategory } = useCategories();
  const { showFavoritesOnly, toggleFavoritesFilter, clearFavoritesFilter } = useSearch();
  const { totalItemCount, favoriteCount } = usePasswordItems();
  const { t } = useTranslation();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  log('[Sidebar] 렌더링됨');
  log('[Sidebar] currentCategory:', currentCategory);
  log('[Sidebar] currentCategoryId:', currentCategoryId);
  log('[Sidebar] categories:', categories);
  log('[Sidebar] categories IDs:', categories?.map(c => c.id) || []);

  const handleCategoryClick = (categoryId: string | null) => {
    log('[Sidebar] 카테고리 클릭됨:', categoryId);
    // 카테고리를 클릭하면 Favorites 필터를 자동으로 해제
    if (showFavoritesOnly) {
      clearFavoritesFilter();
    }
    setCurrentCategory(categoryId);
    log('[Sidebar] setCurrentCategory 호출 완료');
  };
  
  const handleFavoritesClick = () => {
    log('[Sidebar] Favorites 클릭됨');
    // Favorites를 클릭하면 카테고리 필터를 해제하고 전체 아이템의 즐겨찾기만 표시
    setCurrentCategory(null);
    toggleFavoritesFilter();
  };

  const handleAddCategory = async () => {
    log('[Sidebar] handleAddCategory 호출됨, 입력값:', newCategoryName);
    
    if (!newCategoryName.trim()) {
      setError(t('sidebar.categoryEmptyError'));
      return;
    }
    
    // Check for duplicate name
    if (categories.some(cat => cat.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
      setError(t('sidebar.categoryExistsError'));
      return;
    }

    try {
      log('[Sidebar] addCategory 호출 시작');
      await addCategory(newCategoryName.trim());
      log('[Sidebar] addCategory 성공');
      setNewCategoryName('');
      setShowAddCategory(false);
      setError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('sidebar.categoryAddError');
      logError('[Sidebar] 카테고리 추가 실패:', error);
      setError(errorMessage);
    }
  };

  const getCategoryIcon = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case '은행':
      case 'bank':
        return <Bank className="h-4 w-4" />;
      case '포털':
      case 'portal':
        return <Globe className="h-4 w-4" />;
      case '개발':
      case 'development':
        return <Code className="h-4 w-4" />;
      case '쇼핑':
      case 'shopping':
        return <ShoppingBag className="h-4 w-4" />;
      case 'sns':
      case 'social media':
        return <Users className="h-4 w-4" />;
      case '이메일':
      case '메일':
      case 'email':
      case 'mail':
        return <Mail className="h-4 w-4" />;
      case '업무':
      case '회사':
      case 'work':
      case 'business':
        return <Briefcase className="h-4 w-4" />;
      case '금융':
      case '결제':
      case 'finance':
      case 'payment':
        return <CreditCard className="h-4 w-4" />;
      case '게임':
      case 'game':
      case 'games':
        return <Gamepad2 className="h-4 w-4" />;
      case '여행':
      case 'travel':
      case 'trip':
        return <Plane className="h-4 w-4" />;
      case '학교':
      case '교육':
      case 'education':
      case 'school':
        return <GraduationCap className="h-4 w-4" />;
      case '엔터테인먼트':
      case '스트리밍':
      case '영화':
      case 'entertainment':
      case 'streaming':
        return <Film className="h-4 w-4" />;
      case '기기':
      case '디바이스':
      case '장치':
      case 'device':
      case 'hardware':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <FolderOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-6 border-b border-border">
        {/* All Items */}
        <button
          onClick={() => handleCategoryClick(null)}
          className={`flex items-center w-full p-3 rounded-xl mb-2 transition-all cursor-pointer ${
            currentCategory === null ? 'bg-primary/10 text-primary shadow-sm' : 'hover:bg-muted'
          } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
          title={t('sidebar.allItems')}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
            <Folder className="h-4 w-4" />
            {!isCollapsed && <span className="text-sm font-medium">{t('sidebar.allItems')}</span>}
          </div>
          {!isCollapsed && currentCategory === null && <ChevronRight className="h-4 w-4" />}
        </button>

        {/* Favorites Filter */}
        <button
          onClick={handleFavoritesClick}
          className={`flex items-center w-full p-3 rounded-xl mb-5 transition-all cursor-pointer ${
            showFavoritesOnly ? 'bg-yellow-50 text-yellow-600 shadow-sm dark:bg-yellow-900/20 dark:text-yellow-400' : 'hover:bg-muted'
          } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
          title={t('sidebar.favorites')}
        >
          <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
            <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-yellow-400' : ''}`} />
            {!isCollapsed && <span className="text-sm font-medium">{t('sidebar.favorites')}</span>}
          </div>
          {!isCollapsed && showFavoritesOnly && <ChevronRight className="h-4 w-4" />}
        </button>

        {!isCollapsed && <h2 className="text-lg font-semibold text-foreground mb-5">{t('sidebar.categories')}</h2>}

        {/* Category List */}
        <div className="space-y-2">
          {categories?.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              className={`flex items-center w-full p-3 rounded-xl transition-all cursor-pointer ${
                currentCategory?.id === category.id ? 'bg-primary/10 text-primary shadow-sm' : 'hover:bg-muted'
              } ${isCollapsed ? 'justify-center' : 'justify-between'}`}
              title={category.name}
            >
              <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                {getCategoryIcon(category.name)}
                {!isCollapsed && <span className="text-sm font-medium">{category.name}</span>}
              </div>
              {!isCollapsed && currentCategory?.id === category.id && <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </div>

        {/* Add Category Button */}
        {!isCollapsed && (
          <div className="mt-5">
            {showAddCategory ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddCategory();
                    } else if (e.key === 'Escape') {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                      setError(null);
                    }
                  }}
                  placeholder={t('sidebar.newCategoryPlaceholder')}
                  className="w-full px-3 py-2.5 text-sm border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      log('[Sidebar] Add 버튼 클릭됨');
                      handleAddCategory();
                    }}
                    className="flex-1"
                    disabled={!newCategoryName.trim()}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {t('common.add')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                      setError(null);
                    }}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  log('[Sidebar] Add Category 버튼 클릭됨');
                  setShowAddCategory(true);
                }}
                className="w-full flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>{t('sidebar.addCategory')}</span>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats Card */}
      {!isCollapsed && (
        <div className="p-6 mt-auto">
          <Card className="bg-linear-to-br from-primary/5 to-accent/5 border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t('sidebar.totalItems')}</p>
                  <p className="text-2xl font-bold text-foreground">{totalItemCount}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">{t('sidebar.favorites')}</p>
                  <p className="text-2xl font-bold text-foreground">{favoriteCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}