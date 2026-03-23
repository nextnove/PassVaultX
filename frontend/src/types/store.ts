/**
 * PassVaultX - Zustand 스토어 타입 정의
 */

import { PasswordItem, Category } from './index';

// ==================== 스토어 상태 인터페이스 ====================

/**
 * 볼트 스토어 상태
 */
export interface VaultStoreState {
  // 기본 상태
  /** 볼트 잠금 상태 */
  isLocked: boolean;
  /** 비밀번호 항목 목록 */
  items: PasswordItem[];
  /** 카테고리 목록 */
  categories: Category[];
  /** 선택된 항목 ID */
  selectedItemId: string | null;
  /** 검색 쿼리 */
  searchQuery: string;
  /** 현재 카테고리 ID (null = 모든 카테고리) */
  currentCategoryId: string | null;
  /** 즐겨찾기 필터 활성화 여부 */
  showFavoritesOnly: boolean;
  
  // UI 상태
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 성공 메시지 */
  success: string | null;
  
  // 모달 상태
  /** 비밀번호 생성기 모달 표시 여부 */
  showPasswordGenerator: boolean;
  /** 설정 모달 표시 여부 */
  showSettings: boolean;
  /** 카테고리 관리 모달 표시 여부 */
  showCategoryManager: boolean;
  /** 비밀번호 항목 폼 모달 표시 여부 */
  showPasswordItemForm: boolean;
  /** 삭제 확인 모달 표시 여부 */
  showDeleteConfirm: boolean;
  
  // 폼 상태
  /** 편집 중인 비밀번호 항목 ID */
  editingItemId: string | null;
  /** 새 비밀번호 항목 폼 데이터 */
  newItemForm: Partial<PasswordItem>;
}

// ==================== 스토어 액션 인터페이스 ====================

/**
 * 볼트 스토어 액션
 */
export interface VaultStoreActions {
  // 볼트 작업
  /** 볼트 잠금 해제 */
  unlockVault: (masterPassword: string) => Promise<void>;
  /** 볼트 잠금 */
  lockVault: () => Promise<void>;
  /** 새 볼트 생성 */
  createVault: (masterPassword: string) => Promise<void>;
  
  // 비밀번호 항목 작업
  /** 비밀번호 항목 추가 */
  addPasswordItem: (item: Omit<PasswordItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PasswordItem>;
  /** 비밀번호 항목 업데이트 */
  updatePasswordItem: (id: string, updates: Partial<PasswordItem>) => Promise<PasswordItem>;
  /** 비밀번호 항목 삭제 */
  deletePasswordItem: (id: string) => Promise<void>;
  /** 비밀번호 항목 선택 */
  selectItem: (id: string | null) => void;
  /** 즐겨찾기 토글 */
  toggleFavorite: (id: string) => Promise<void>;
  
  // 카테고리 작업
  /** 카테고리 추가 */
  addCategory: (name: string) => Promise<Category>;
  /** 카테고리 업데이트 */
  updateCategory: (id: string, name: string) => Promise<Category>;
  /** 카테고리 삭제 */
  deleteCategory: (id: string) => Promise<void>;
  /** 카테고리 순서 변경 */
  reorderCategories: (categoryIds: string[]) => Promise<void>;
  /** 현재 카테고리 설정 */
  setCurrentCategory: (id: string | null) => void;
  
  // 검색 및 필터링
  /** 검색 쿼리 설정 */
  setSearchQuery: (query: string) => void;
  /** 즐겨찾기 필터 토글 */
  toggleFavoritesFilter: () => void;
  /** 검색 결과 초기화 */
  clearSearch: () => void;
  
  // UI 상태 관리
  /** 로딩 상태 설정 */
  setLoading: (loading: boolean) => void;
  /** 에러 설정 */
  setError: (error: string | null) => void;
  /** 성공 메시지 설정 */
  setSuccess: (success: string | null) => void;
  
  // 모달 관리
  /** 비밀번호 생성기 모달 표시/숨김 */
  togglePasswordGenerator: (show?: boolean) => void;
  /** 설정 모달 표시/숨김 */
  toggleSettings: (show?: boolean) => void;
  /** 카테고리 관리 모달 표시/숨김 */
  toggleCategoryManager: (show?: boolean) => void;
  /** 비밀번호 항목 폼 모달 표시/숨김 */
  togglePasswordItemForm: (show?: boolean, itemId?: string | null) => void;
  /** 삭제 확인 모달 표시/숨김 */
  toggleDeleteConfirm: (show?: boolean, itemId?: string | null) => void;
  
  // 폼 관리
  /** 새 항목 폼 업데이트 */
  updateNewItemForm: (updates: Partial<PasswordItem>) => void;
  /** 새 항목 폼 초기화 */
  resetNewItemForm: () => void;
  
  // 데이터 새로고침
  /** 모든 데이터 새로고침 */
  refreshData: () => Promise<void>;
}

// ==================== 계산된 값 타입 ====================

/**
 * 계산된 값
 */
export interface VaultStoreComputed {
  /** 선택된 항목 */
  selectedItem: PasswordItem | null;
  /** 필터링된 항목 목록 (검색 + 카테고리 + 즐겨찾기) */
  filteredItems: PasswordItem[];
  /** 즐겨찾기 항목 목록 */
  favoriteItems: PasswordItem[];
  /** 현재 카테고리 */
  currentCategory: Category | null;
  /** 검색 결과 수 */
  searchResultCount: number;
  /** 총 항목 수 */
  totalItemCount: number;
  /** 즐겨찾기 항목 수 */
  favoriteCount: number;
  /** 카테고리별 항목 수 */
  itemsByCategory: Record<string, number>;
}

// ==================== 전체 스토어 타입 ====================

/**
 * 전체 볼트 스토어 타입
 */
export type VaultStore = VaultStoreState & VaultStoreActions & VaultStoreComputed;

// ==================== 스토어 초기 상태 ====================

/**
 * 스토어 초기 상태
 */
export const initialVaultStoreState: VaultStoreState = {
  // 기본 상태
  isLocked: true,
  items: [],
  categories: [],
  selectedItemId: null,
  searchQuery: '',
  currentCategoryId: null,
  showFavoritesOnly: false,
  
  // UI 상태
  isLoading: false,
  error: null,
  success: null,
  
  // 모달 상태
  showPasswordGenerator: false,
  showSettings: false,
  showCategoryManager: false,
  showPasswordItemForm: false,
  showDeleteConfirm: false,
  
  // 폼 상태
  editingItemId: null,
  newItemForm: {
    title: '',
    categoryId: '',
    username: '',
    password: '',
    url: '',
    notes: '',
    favorite: false,
  },
};

// ==================== 스토어 선택자 타입 ====================

/**
 * 스토어 선택자 함수 타입
 */
export type StoreSelector<T> = (state: VaultStore) => T;

/**
 * 스토어 선택자 생성 함수
 */
export const createSelector = <T>(selector: StoreSelector<T>): StoreSelector<T> => selector;