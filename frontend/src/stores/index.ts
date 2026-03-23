/**
 * PassVaultX - 스토어 모듈 내보내기
 * 
 * 모든 스토어 관련 기능을 한 곳에서 내보냅니다.
 */

// Zustand 스토어
export { useVaultStore, default as vaultStore } from './vaultStore';

// 스토어 타입
export type { 
  VaultStoreState, 
  VaultStoreActions, 
  VaultStoreComputed, 
  VaultStore,
  StoreSelector 
} from '../types/store';

// 유틸리티 선택자
export {
  selectAllItems,
  selectAllCategories,
  selectSelectedItem,
  selectFilteredItems,
  selectFavoriteItems,
  selectCurrentCategory,
  selectSearchResultCount,
  selectTotalItemCount,
  selectFavoriteCount,
  selectItemsByCategory,
  selectIsLoading,
  selectError,
  selectSuccess,
  selectIsLocked,
  selectSearchQuery,
  selectShowFavoritesOnly,
  selectShowPasswordGenerator,
  selectShowSettings,
  selectShowCategoryManager,
  selectShowPasswordItemForm,
  selectShowDeleteConfirm,
  selectEditingItemId,
  selectNewItemForm
} from './vaultStore';

// 컴포넌트용 Hook
export {
  useVault,
  usePasswordItems,
  useCategories,
  useSearch,
  useModals,
  useForms,
  useRefresh,
  useStore
} from './vaultStore';

// 유틸리티 함수
export { createSelector } from '../types/store';