import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { useSearch } from '../stores/vaultStore';

interface SearchBarProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ 
  onSearch, 
  placeholder = "Search passwords...",
  className = "" 
}: SearchBarProps) {
  const { searchQuery, setSearchQuery } = useSearch();
  const { t } = useTranslation();
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced search to avoid too many re-renders
  const debouncedSetSearchQuery = useCallback((value: string) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    debounceTimeout.current = setTimeout(() => {
      setSearchQuery(value);
      onSearch?.(value);
    }, 300);
  }, [setSearchQuery, onSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalQuery(value);
    debouncedSetSearchQuery(value);
  };

  const handleClear = () => {
    setLocalQuery('');
    setSearchQuery('');
    onSearch?.('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={`relative flex-1 max-w-2xl ${className}`}>
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
          isFocused ? 'text-primary' : 'text-muted-foreground'
        }`} />
        
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder === "Search passwords..." ? t('vault.searchPlaceholder') : placeholder}
          value={localQuery}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        
        {localQuery && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t('vault.clearSearch')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}