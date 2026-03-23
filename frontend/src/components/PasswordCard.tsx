import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PasswordItem } from '../types';
import { Star, Globe, User, Lock, Trash2 } from 'lucide-react';
import { useCategories } from '../stores/vaultStore';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface PasswordCardProps {
  item: PasswordItem;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

// 렌더링 최적화 - React.memo 적용
export const PasswordCard = memo(function PasswordCard({ item, isSelected, onClick, onDelete }: PasswordCardProps) {
  const { categories } = useCategories();
  const { t, i18n } = useTranslation();
  const category = categories.find(c => c.id === item.categoryId);

  const getInitials = (title: string) => {
    return title
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getColorFromString = (str: string) => {
    const colors = [
      'bg-blue-100 text-blue-600',
      'bg-green-100 text-green-600',
      'bg-purple-100 text-purple-600',
      'bg-pink-100 text-pink-600',
      'bg-orange-100 text-orange-600',
      'bg-indigo-100 text-indigo-600',
    ];
    const index = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
    return colors[index];
  };

  return (
    <Card
      onClick={onClick}
      className={`p-5 cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'border-primary bg-primary/10 shadow-lg'
          : 'hover:border-muted-foreground hover:bg-muted/50 hover:shadow-lg'
      }`}
    >
      <div className="flex items-start space-x-4">
        {/* Avatar/Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getColorFromString(item.title)}`}>
          <span className="font-bold text-base">{getInitials(item.title)}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="font-semibold text-foreground truncate">{item.title}</h3>
                {item.favorite && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />
                )}
              </div>
              
              <div className="flex flex-col space-y-1 text-sm text-muted-foreground">
                {item.username && (
                  <div className="flex items-center space-x-2">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.username}</span>
                  </div>
                )}
                {item.url && (
                  <div className="flex items-center space-x-2">
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.url}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
            <div className="flex items-center space-x-2">
              {category && (
                <span className="px-2.5 py-1 text-xs font-medium bg-muted text-foreground rounded-md">
                  {category.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(item.updatedAt).toLocaleDateString(i18n.language)}
              </span>
            </div>
            
            <div className="flex items-center space-x-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">••••••••</span>
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(e);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
});