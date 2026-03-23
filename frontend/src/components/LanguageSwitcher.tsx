import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const languages = [
    { code: 'ko', name: '한국어' },
    { code: 'en', name: 'English' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('i18nextLng', lng);
  };

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select
        value={i18n.language}
        onValueChange={changeLanguage}
      >
        <SelectTrigger className="w-[120px] h-9">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lng) => (
            <SelectItem key={lng.code} value={lng.code}>
              {lng.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
