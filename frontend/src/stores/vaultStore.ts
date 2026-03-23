/**
 * PassVaultX - Zustand 스토어 구현
 *  
 * Zustand Store 생성 (VaultStore 정의 및 상태 변수 설정, 액션 메서드 구현)
 * 계산된 값 및 필터링 로직 구현 (filteredItems, favoriteItems 셀렉터 작성, 카테고리 필터링 로직)
 */

import React from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import Fuse from 'fuse.js';
import {
  VaultStore,
  initialVaultStoreState,
  StoreSelector
} from '../types/store';
import { PasswordItem, Category, NewPasswordItem, PasswordItemUpdate } from '../types';
import { UnlockVault, LockVault, CreateVault, AddPasswordItem, UpdatePasswordItem, DeletePasswordItem, AddCategory, UpdateCategory, DeleteCategory, ReorderCategories, GetAllPasswordItems, GetAllCategories } from '../../wailsjs/go/main/App';

// passVaultXAPI 타입은 preload/index.d.ts에서 전역으로 선언됨

// ==================== 개발 환경 로거 ====================
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

// ==================== Fuse.js 검색 설정 ====================
//  퍼지 검색
//  검색 최적화 - Fuse.js 인덱스 캐싱

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'username', weight: 0.2 },
    { name: 'url', weight: 0.1 },
    { name: 'notes', weight: 0.1 },
    { name: 'tags', weight: 0.2 }
  ],
  threshold: 0.3,  // 0.0 = 완전 일치, 1.0 = 모든 것 일치
  includeScore: true,
  minMatchCharLength: 2
};

// Fuse.js 인덱스 캐싱을 위한 변수
let fuseInstance: Fuse<PasswordItem> | null = null;
let cachedItemsHash: string | null = null;

/**
 * 항목 배열의 해시 생성 (캐시 무효화 판단용)
 */
const generateItemsHash = (items: PasswordItem[]): string => {
  return items.map(item => `${item.id}-${item.updatedAt}`).join('|');
};

// ==================== Zustand 스토어 생성 ====================

export const useVaultStore = create<VaultStore>()(
  devtools(
    persist(
      (set, get) => ({
        // ==================== 상태 변수 ====================
        // 볼트 잠금 상태, 현재 Password_Item 목록, 선택된 항목, 검색 쿼리, 현재 카테고리를 상태로 관리
        ...initialVaultStoreState,

        // ==================== 계산된 값 ====================
        // 상태 변경 시 React 컴포넌트를 자동으로 리렌더링
        
        /** 선택된 항목 */
        get selectedItem(): PasswordItem | null {
          const { items, selectedItemId } = get();
          if (!selectedItemId) return null;
          return items.find(item => item.id === selectedItemId) || null;
        },

        /** 필터링된 항목 목록 (검색 + 카테고리 + 즐겨찾기) */
        get filteredItems(): PasswordItem[] {
          const { items, searchQuery, currentCategoryId, showFavoritesOnly } = get();
          
          // 1. 카테고리 필터링
          let filtered = items;
          if (currentCategoryId) {
            filtered = filtered.filter(item => item.categoryId === currentCategoryId);
          }
          
          // 2. 즐겨찾기 필터링
          if (showFavoritesOnly && !currentCategoryId) {
            filtered = filtered.filter(item => item.favorite);
          }
          
          // 3. 검색 필터링 (Fuse.js 인덱스 캐싱 적용)
          if (searchQuery.trim()) {
            const currentHash = generateItemsHash(filtered);
            
            if (!fuseInstance || cachedItemsHash !== currentHash) {
              fuseInstance = new Fuse(filtered, fuseOptions);
              cachedItemsHash = currentHash;
            }
            
            const results = fuseInstance.search(searchQuery);
            filtered = results.map(result => result.item);
          }
          
          // 4. 정렬: 즐겨찾기 우선, 그 다음 최근 사용/수정 순
          const sorted = [...filtered].sort((a, b) => {
            if (a.favorite && !b.favorite) return -1;
            if (!a.favorite && b.favorite) return 1;
            const timeA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
            const timeB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
            return timeB - timeA;
          });
          
          return sorted;
        },

        /** 즐겨찾기 항목 목록 */
        get favoriteItems(): PasswordItem[] {
          const { items } = get();
          if (!items || !Array.isArray(items)) return [];
          
          return items
            .filter(item => item && item.favorite)
            .sort((a, b) => {
              const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
              const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
              return timeB - timeA;
            });
        },

        /** 현재 카테고리 */
        get currentCategory(): Category | null {
          const { categories, currentCategoryId } = get();
          if (!currentCategoryId || !categories || !Array.isArray(categories)) return null;
          return categories.find(category => category && category.id === currentCategoryId) || null;
        },

        /** 검색 결과 수 */
        get searchResultCount(): number {
          return get().filteredItems.length;
        },

        /** 총 항목 수 */
        get totalItemCount(): number {
          return get().items.length;
        },

        /** 즐겨찾기 항목 수 */
        get favoriteCount(): number {
          return get().items.filter(item => item.favorite).length;
        },

        /** 카테고리별 항목 수 */
        get itemsByCategory(): Record<string, number> {
          const { items, categories } = get();
          const result: Record<string, number> = {};
          
          // 모든 카테고리 초기화
          categories.forEach(category => {
            result[category.id] = 0;
          });
          
          // 항목 수 계산
          items.forEach(item => {
            const catId = item.categoryId || '';
            if (catId && result[catId] !== undefined) {
              result[catId]++;
            }
          });
          
          return result;
        },

        // ==================== 볼트 작업 액션 ====================
        
        /** 볼트 잠금 해제 */
        async unlockVault(masterPassword: string): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 잠금 해제 요청
            const vault = await UnlockVault(masterPassword);
            
            // 상태 업데이트
            set({
              isLocked: false,
              items: vault.items || [],
              categories: vault.categories || [],
              isLoading: false,
              success: '볼트가 잠금 해제되었습니다.'
            });
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 볼트 잠금 */
        async lockVault(): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            
            // IPC를 통해 Main Process에 잠금 요청
            await LockVault();
            
            // 상태 초기화
            set({
              ...initialVaultStoreState,
              isLoading: false
            });
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 새 볼트 생성 */
        async createVault(masterPassword: string): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 볼트 생성 요청
            await CreateVault(masterPassword);
            
            // 기본 상태로 설정 (볼트는 잠금 해제 상태로 시작)
            set({
              isLocked: false,
              items: [],
              categories: [],
              isLoading: false,
              success: '새 볼트가 생성되었습니다.'
            });
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        // ==================== 비밀번호 항목 작업 액션 ====================
        
        /** 비밀번호 항목 추가 */
        async addPasswordItem(itemData: NewPasswordItem): Promise<PasswordItem> {
          const { setLoading, setError } = get();
          
          log('[Store] addPasswordItem 호출됨:', itemData);
          
          try {
            setLoading(true);
            setError(null);
            
            log('[Store] IPC 호출 시작');
            // IPC를 통해 Main Process에 항목 추가 요청
            const newItem = await AddPasswordItem(itemData);
            log('[Store] IPC 호출 완료, 받은 항목:', newItem);
            
            // 로컬 상태 업데이트
            set(state => ({
              items: [...state.items, newItem],
              isLoading: false,
              success: '비밀번호 항목이 추가되었습니다.'
            }));
            
            log('[Store] 상태 업데이트 완료, 현재 items 개수:', get().items.length);
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
            return newItem;
            
          } catch (error) {
            logError('[Store] addPasswordItem 오류:', error);
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 비밀번호 항목 업데이트 */
        async updatePasswordItem(id: string, updates: PasswordItemUpdate): Promise<PasswordItem> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 항목 업데이트 요청
            const updatedItem = await UpdatePasswordItem(id, updates);
            
            // 로컬 상태 업데이트
            set(state => ({
              items: state.items.map(item => 
                item.id === id ? updatedItem : item
              ),
              isLoading: false,
              success: '비밀번호 항목이 수정되었습니다.'
            }));
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
            return updatedItem;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 비밀번호 항목 삭제 */
        async deletePasswordItem(id: string): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 항목 삭제 요청
            await DeletePasswordItem(id);
            
            // 로컬 상태 업데이트
            set(state => ({
              items: state.items.filter(item => item.id !== id),
              selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
              isLoading: false,
              success: '비밀번호 항목이 삭제되었습니다.'
            }));
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 비밀번호 항목 선택 */
        selectItem(id: string | null): void {
          log('[Store.selectItem] 호출됨, id:', id);
          set({ selectedItemId: id });
          log('[Store.selectItem] 설정 완료, selectedItemId:', get().selectedItemId);
        },

        /** 즐겨찾기 토글 */
        async toggleFavorite(id: string): Promise<void> {
          const { items, updatePasswordItem } = get();
          const item = items.find(item => item.id === id);
          
          if (!item) {
            throw new Error('항목을 찾을 수 없습니다.');
          }
          
          // 즐겨찾기 상태 토글
          await updatePasswordItem(id, { favorite: !item.favorite });
        },

        // ==================== 카테고리 작업 액션 ====================
        
        /** 카테고리 추가 */
        async addCategory(name: string): Promise<Category> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 카테고리 추가 요청
            const newCategory = await AddCategory(name);
            
            // 로컬 상태 업데이트
            set(state => ({
              categories: [...state.categories, newCategory],
              isLoading: false,
              success: '카테고리가 추가되었습니다.'
            }));
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
            return newCategory;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 카테고리 업데이트 */
        async updateCategory(id: string, name: string): Promise<Category> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 카테고리 업데이트 요청
            const updatedCategory = await UpdateCategory(id, name);
            
            // 로컬 상태 업데이트
            set(state => ({
              categories: state.categories.map(category =>
                category.id === id ? updatedCategory : category
              ),
              isLoading: false,
              success: '카테고리가 수정되었습니다.'
            }));
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
            return updatedCategory;
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 카테고리 삭제 */
        async deleteCategory(id: string): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            setError(null);
            
            // IPC를 통해 Main Process에 카테고리 삭제 요청
            await DeleteCategory(id);
            
            // 로컬 상태 업데이트
            set(state => ({
              categories: state.categories.filter(category => category.id !== id),
              currentCategoryId: state.currentCategoryId === id ? null : state.currentCategoryId,
              isLoading: false,
              success: '카테고리가 삭제되었습니다.'
            }));
            
            // 성공 메시지 3초 후 자동 제거
            setTimeout(() => {
              get().setSuccess(null);
            }, 3000);
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },

        /** 카테고리 순서 변경 */
        async reorderCategories(categoryIds: string[]): Promise<void> {
          const { categories, setError } = get();
          
          log('[Store.reorderCategories] 시작, 순서:', categoryIds);

          // 낙관적 업데이트를 위해 현재 상태 저장
          const originalCategories = [...categories];
          
          try {
            // 새 순서대로 카테고리 정렬 및 sortOrder 업데이트
            const newCategories = categoryIds.map((id, index) => {
              const cat = categories.find(c => c.id === id);
              if (!cat) throw new Error(`Category ${id} not found`);
              return { ...cat, sortOrder: index };
            });

            // UI 즉시 업데이트
            set({ categories: newCategories });

            // 백엔드에 반영
            await ReorderCategories(categoryIds);
            log('[Store.reorderCategories] 백엔드 반영 성공');
          } catch (error) {
            logError('[Store.reorderCategories] 실패:', error);
            // 실패 시 복구
            set({ categories: originalCategories });
            setError(error instanceof Error ? error.message : '순서 변경에 실패했습니다.');
          }
        },

        /** 현재 카테고리 설정 */
        setCurrentCategory(id: string | null): void {
          set({ currentCategoryId: id });
        },

        // ==================== 검색 및 필터링 액션 ====================
        
        /** 검색 쿼리 설정 */
        setSearchQuery(query: string): void {
          set({ searchQuery: query });
        },

        /** 즐겨찾기 필터 토글 */
        toggleFavoritesFilter(): void {
          set(state => ({ showFavoritesOnly: !state.showFavoritesOnly }));
        },

        /** 검색 결과 초기화 */
        clearSearch(): void {
          set({ 
            searchQuery: '',
            currentCategoryId: null,
            showFavoritesOnly: false 
          });
        },

        // ==================== UI 상태 관리 액션 ====================
        
        /** 로딩 상태 설정 */
        setLoading(loading: boolean): void {
          set({ isLoading: loading });
        },

        /** 에러 설정 */
        setError(error: string | null): void {
          set({ error });
        },

        /** 성공 메시지 설정 */
        setSuccess(success: string | null): void {
          set({ success });
        },

        // ==================== 모달 관리 액션 ====================
        
        /** 비밀번호 생성기 모달 표시/숨김 */
        togglePasswordGenerator(show?: boolean): void {
          set(state => ({ 
            showPasswordGenerator: show !== undefined ? show : !state.showPasswordGenerator 
          }));
        },

        /** 설정 모달 표시/숨김 */
        toggleSettings(show?: boolean): void {
          set(state => ({ 
            showSettings: show !== undefined ? show : !state.showSettings 
          }));
        },

        /** 카테고리 관리 모달 표시/숨김 */
        toggleCategoryManager(show?: boolean): void {
          set(state => ({ 
            showCategoryManager: show !== undefined ? show : !state.showCategoryManager 
          }));
        },

        /** 비밀번호 항목 폼 모달 표시/숨김 */
        togglePasswordItemForm(show?: boolean, itemId?: string | null): void {
          set(state => {
            const shouldShow = show !== undefined ? show : !state.showPasswordItemForm;
            
            if (shouldShow && itemId) {
              // 편집 모드: 기존 항목 데이터 로드
              const item = state.items.find(item => item.id === itemId);
              return {
                showPasswordItemForm: true,
                editingItemId: itemId,
                newItemForm: item ? {
                  title: item.title,
                  categoryId: item.categoryId,
                  username: item.username,
                  password: item.password,
                  url: item.url,
                  notes: item.notes,
                  favorite: item.favorite
                } : state.newItemForm
              };
            } else if (shouldShow) {
              // 생성 모드: 빈 폼
              return {
                showPasswordItemForm: true,
                editingItemId: null,
                newItemForm: initialVaultStoreState.newItemForm
              };
            } else {
              // 모달 닫기
              return {
                showPasswordItemForm: false,
                editingItemId: null,
                newItemForm: initialVaultStoreState.newItemForm
              };
            }
          });
        },

        /** 삭제 확인 모달 표시/숨김 */
        toggleDeleteConfirm(show?: boolean, itemId?: string | null): void {
          set(state => ({ 
            showDeleteConfirm: show !== undefined ? show : !state.showDeleteConfirm,
            editingItemId: itemId || state.editingItemId
          }));
        },

        // ==================== 폼 관리 액션 ====================
        
        /** 새 항목 폼 업데이트 */
        updateNewItemForm(updates: Partial<PasswordItem>): void {
          set(state => ({
            newItemForm: { ...state.newItemForm, ...updates }
          }));
        },

        /** 새 항목 폼 초기화 */
        resetNewItemForm(): void {
          set({ newItemForm: initialVaultStoreState.newItemForm });
        },

        // ==================== 데이터 새로고침 액션 ====================
        
        /** 모든 데이터 새로고침 */
        async refreshData(): Promise<void> {
          const { setLoading, setError } = get();
          
          try {
            setLoading(true);
            
            // IPC를 통해 Main Process에서 최신 데이터 가져오기
            const items = await GetAllPasswordItems();
            const categories = await GetAllCategories();
            
            set({
              items,
              categories,
              isLoading: false
            });
            
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
            setError(errorMessage);
            set({ isLoading: false });
            throw error;
          }
        },
      }),
      {
        name: 'vault-store',
        partialize: (state) => ({
          // UI 편의 상태만 선택 (민감 데이터 영속화 제외)
          selectedItemId: state.selectedItemId,
          searchQuery: state.searchQuery,
          currentCategoryId: state.currentCategoryId,
          showFavoritesOnly: state.showFavoritesOnly,
        }),
      }
    ),
    {
      name: 'VaultStore',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ==================== 유틸리티 선택자 ====================

/** 모든 항목 선택자 */
export const selectAllItems: StoreSelector<PasswordItem[]> = (state) => state.items;

/** 모든 카테고리 선택자 */
export const selectAllCategories: StoreSelector<Category[]> = (state) => state.categories || [];

/** 선택된 항목 선택자 */
export const selectSelectedItem: StoreSelector<PasswordItem | null> = (state) => state.selectedItem;

/** 필터링된 항목 선택자 */
export const selectFilteredItems: StoreSelector<PasswordItem[]> = (state) => state.filteredItems;

/** 즐겨찾기 항목 선택자 */
export const selectFavoriteItems: StoreSelector<PasswordItem[]> = (state) => state.favoriteItems;

/** 현재 카테고리 선택자 */
export const selectCurrentCategory: StoreSelector<Category | null> = (state) => state.currentCategory;

/** 검색 결과 수 선택자 */
export const selectSearchResultCount: StoreSelector<number> = (state) => state.searchResultCount;

/** 총 항목 수 선택자 */
export const selectTotalItemCount: StoreSelector<number> = (state) => state.totalItemCount;

/** 즐겨찾기 항목 수 선택자 */
export const selectFavoriteCount: StoreSelector<number> = (state) => state.favoriteCount;

/** 카테고리별 항목 수 선택자 */
export const selectItemsByCategory: StoreSelector<Record<string, number>> = (state) => state.itemsByCategory;

/** 로딩 상태 선택자 */
export const selectIsLoading: StoreSelector<boolean> = (state) => state.isLoading;

/** 에러 메시지 선택자 */
export const selectError: StoreSelector<string | null> = (state) => state.error;

/** 성공 메시지 선택자 */
export const selectSuccess: StoreSelector<string | null> = (state) => state.success;

/** 볼트 잠금 상태 선택자 */
export const selectIsLocked: StoreSelector<boolean> = (state) => state.isLocked;

/** 검색 쿼리 선택자 */
export const selectSearchQuery: StoreSelector<string> = (state) => state.searchQuery;

/** 즐겨찾기 필터 상태 선택자 */
export const selectShowFavoritesOnly: StoreSelector<boolean> = (state) => state.showFavoritesOnly;

/** 모달 상태 선택자들 */
export const selectShowPasswordGenerator: StoreSelector<boolean> = (state) => state.showPasswordGenerator;
export const selectShowSettings: StoreSelector<boolean> = (state) => state.showSettings;
export const selectShowCategoryManager: StoreSelector<boolean> = (state) => state.showCategoryManager;
export const selectShowPasswordItemForm: StoreSelector<boolean> = (state) => state.showPasswordItemForm;
export const selectShowDeleteConfirm: StoreSelector<boolean> = (state) => state.showDeleteConfirm;

/** 폼 상태 선택자들 */
export const selectEditingItemId: StoreSelector<string | null> = (state) => state.editingItemId;
export const selectNewItemForm: StoreSelector<Partial<PasswordItem>> = (state) => state.newItemForm;

// ==================== 컴포넌트용 Hook ====================

/** 볼트 상태를 관리하는 Hook */
export const useVault = () => {
  const isLocked = useVaultStore(selectIsLocked);
  const isLoading = useVaultStore(selectIsLoading);
  const error = useVaultStore(selectError);
  const success = useVaultStore(selectSuccess);
  const unlockVault = useVaultStore(state => state.unlockVault);
  const lockVault = useVaultStore(state => state.lockVault);
  const createVault = useVaultStore(state => state.createVault);
  const setError = useVaultStore(state => state.setError);
  const setSuccess = useVaultStore(state => state.setSuccess);
  
  return {
    isLocked,
    isLoading,
    error,
    success,
    unlockVault,
    lockVault,
    createVault,
    setError,
    setSuccess
  };
};

/** 비밀번호 항목을 관리하는 Hook */
export const usePasswordItems = () => {
  const items = useVaultStore(selectAllItems);
  const selectedItemId = useVaultStore(state => state.selectedItemId);
  const currentCategoryId = useVaultStore(state => state.currentCategoryId);
  const searchQuery = useVaultStore(state => state.searchQuery);
  const showFavoritesOnly = useVaultStore(state => state.showFavoritesOnly);
  const favoriteItems = useVaultStore(selectFavoriteItems);
  const addPasswordItem = useVaultStore(state => state.addPasswordItem);
  const updatePasswordItem = useVaultStore(state => state.updatePasswordItem);
  const deletePasswordItem = useVaultStore(state => state.deletePasswordItem);
  const selectItem = useVaultStore(state => state.selectItem);
  const toggleFavorite = useVaultStore(state => state.toggleFavorite);
  
  // selectedItem을 useMemo로 계산하여 selectedItemId나 items가 변경될 때만 재계산
  const selectedItem = React.useMemo(() => {
    log('[usePasswordItems] selectedItem 계산 중, selectedItemId:', selectedItemId, 'items 개수:', items.length);
    const result = selectedItemId 
      ? items.find(item => item.id === selectedItemId) || null
      : null;
    log('[usePasswordItems] selectedItem 결과:', result ? result.title : 'null');
    return result;
  }, [selectedItemId, items]);
  
  // filteredItems를 useMemo로 계산하여 의존성이 변경될 때만 재계산
  const filteredItems = React.useMemo(() => {
    log('[usePasswordItems] filteredItems 계산 중, items 개수:', items.length);
    log('[usePasswordItems] currentCategoryId:', currentCategoryId);
    
    let result = items;
    
    // 1. 카테고리 필터링
    if (currentCategoryId) {
      result = result.filter(item => item.categoryId === currentCategoryId);
    }
    
    // 2. 즐겨찾기 필터링
    // Favorites는 전체 아이템에 대한 것이므로 카테고리 필터와 함께 적용하지 않음
    // 카테고리가 선택된 상태에서는 Favorites 필터를 자동으로 해제
    if (showFavoritesOnly && !currentCategoryId) {
      result = result.filter(item => item.favorite);
    }
    
    // 3. 검색 필터링
    if (searchQuery.trim()) {
      const fuse = new Fuse(result, fuseOptions);
      const searchResults = fuse.search(searchQuery);
      result = searchResults.map(r => r.item);
    }
    
    // 4. 정렬
    result = result.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    
    log('[usePasswordItems] filteredItems 결과 개수:', result.length);
    return result;
  }, [items, currentCategoryId, showFavoritesOnly, searchQuery]);
  
  // totalItemCount와 favoriteCount를 직접 계산
  const totalItemCount = items.length;
  const favoriteCount = items.filter(item => item.favorite).length;
  
  return {
    items,
    filteredItems,
    favoriteItems,
    selectedItem,
    totalItemCount,
    favoriteCount,
    addPasswordItem,
    updatePasswordItem,
    deletePasswordItem,
    selectItem,
    toggleFavorite
  };
};

/** 카테고리를 관리하는 Hook */
export const useCategories = () => {
  const categories = useVaultStore(selectAllCategories);
  const currentCategoryId = useVaultStore(state => state.currentCategoryId);
  const items = useVaultStore(selectAllItems);
  const addCategory = useVaultStore(state => state.addCategory);
  const updateCategory = useVaultStore(state => state.updateCategory);
  const deleteCategory = useVaultStore(state => state.deleteCategory);
  const setCurrentCategory = useVaultStore(state => state.setCurrentCategory);
  
  // currentCategory를 직접 계산 (getter 대신)
  const currentCategory = currentCategoryId 
    ? categories.find(category => category.id === currentCategoryId) || null
    : null;
  
  // itemsByCategory를 useMemo로 계산
  const itemsByCategory = React.useMemo(() => {
    const result: Record<string, number> = {};
    
    // 모든 카테고리 초기화
    categories.forEach(category => {
      result[category.id] = 0;
    });
    
    // 항목 수 계산
    items.forEach(item => {
      const catId = item.categoryId || '';
      if (catId && result[catId] !== undefined) {
        result[catId]++;
      }
    });
    
    return result;
  }, [categories, items]);
  
  return {
    categories,
    currentCategory,
    currentCategoryId,
    itemsByCategory,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategories: useVaultStore(state => state.reorderCategories),
    setCurrentCategory
  };
};

/** 검색 및 필터링을 관리하는 Hook */
export const useSearch = () => {
  const searchQuery = useVaultStore(selectSearchQuery);
  const showFavoritesOnly = useVaultStore(selectShowFavoritesOnly);
  const items = useVaultStore(selectAllItems);
  const currentCategoryId = useVaultStore(state => state.currentCategoryId);
  const setSearchQuery = useVaultStore(state => state.setSearchQuery);
  const toggleFavoritesFilter = useVaultStore(state => state.toggleFavoritesFilter);
  const clearSearch = useVaultStore(state => state.clearSearch);
  
  // Favorites 필터만 해제하는 함수
  const clearFavoritesFilter = () => {
    if (showFavoritesOnly) {
      useVaultStore.setState({ showFavoritesOnly: false });
    }
  };
  
  // searchResultCount를 useMemo로 계산
  const searchResultCount = React.useMemo(() => {
    let result = items;
    
    // 1. 카테고리 필터링
    if (currentCategoryId) {
      result = result.filter(item => item.categoryId === currentCategoryId);
    }
    
    // 2. 즐겨찾기 필터링
    // Favorites는 전체 아이템에 대한 것이므로 카테고리 필터와 함께 적용하지 않음
    // 카테고리가 선택된 상태에서는 Favorites 필터를 자동으로 해제
    if (showFavoritesOnly && !currentCategoryId) {
      result = result.filter(item => item.favorite);
    }
    
    // 3. 검색 필터링
    if (searchQuery.trim()) {
      const fuse = new Fuse(result, fuseOptions);
      const searchResults = fuse.search(searchQuery);
      result = searchResults.map(r => r.item);
    }
    
    return result.length;
  }, [items, currentCategoryId, showFavoritesOnly, searchQuery]);
  
  return {
    searchQuery,
    showFavoritesOnly,
    searchResultCount,
    setSearchQuery,
    toggleFavoritesFilter,
    clearFavoritesFilter,
    clearSearch
  };
};

/** 모달을 관리하는 Hook */
export const useModals = () => {
  const showPasswordGenerator = useVaultStore(selectShowPasswordGenerator);
  const showSettings = useVaultStore(selectShowSettings);
  const showCategoryManager = useVaultStore(selectShowCategoryManager);
  const showPasswordItemForm = useVaultStore(selectShowPasswordItemForm);
  const showDeleteConfirm = useVaultStore(selectShowDeleteConfirm);
  const togglePasswordGenerator = useVaultStore(state => state.togglePasswordGenerator);
  const toggleSettings = useVaultStore(state => state.toggleSettings);
  const toggleCategoryManager = useVaultStore(state => state.toggleCategoryManager);
  const togglePasswordItemForm = useVaultStore(state => state.togglePasswordItemForm);
  const toggleDeleteConfirm = useVaultStore(state => state.toggleDeleteConfirm);
  
  return {
    showPasswordGenerator,
    showSettings,
    showCategoryManager,
    showPasswordItemForm,
    showDeleteConfirm,
    togglePasswordGenerator,
    toggleSettings,
    toggleCategoryManager,
    togglePasswordItemForm,
    toggleDeleteConfirm
  };
};

/** 폼을 관리하는 Hook */
export const useForms = () => {
  const editingItemId = useVaultStore(selectEditingItemId);
  const newItemForm = useVaultStore(selectNewItemForm);
  const updateNewItemForm = useVaultStore(state => state.updateNewItemForm);
  const resetNewItemForm = useVaultStore(state => state.resetNewItemForm);
  
  return {
    editingItemId,
    newItemForm,
    updateNewItemForm,
    resetNewItemForm
  };
};

/** 데이터 새로고침을 관리하는 Hook */
export const useRefresh = () => {
  const isLoading = useVaultStore(selectIsLoading);
  const refreshData = useVaultStore(state => state.refreshData);
  const setLoading = useVaultStore(state => state.setLoading);
  
  return {
    isLoading,
    refreshData,
    setLoading
  };
};

/** 전체 스토어에 접근하는 Hook */
export const useStore = () => useVaultStore();

export default useVaultStore;