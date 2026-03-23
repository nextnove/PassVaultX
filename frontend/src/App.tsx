import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Development logger
const isDev = import.meta.env.DEV;
const log = (...args: any[]) => {
  if (isDev) console.log(...args);
};
const logError = (...args: any[]) => {
  if (isDev) console.error(...args);
};

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { EventsOn, EventsEmit } from '../wailsjs/runtime/runtime'
import { VaultExists, GetConfig } from '../wailsjs/go/main/App'
import { LoginPage } from './components/LoginPage'
import { CreateVaultForm } from './components/CreateVaultForm'
import { VaultPage } from './components/VaultPage'
import { useVault } from './stores/vaultStore'
import { useTheme } from './hooks'
import React from 'react'

// 에러 경계 컴포넌트 추가
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('[ErrorBoundary] Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">애플리케이션 오류가 발생했습니다</h1>
          <div className="bg-muted p-4 rounded-lg max-w-2xl overflow-auto text-left mb-6">
            <p className="font-mono text-sm text-foreground whitespace-pre-wrap">
              {this.state.error?.stack || this.state.error?.message}
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            앱 새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * PassVaultX 애플리케이션 메인 컴포넌트
 * Renderer Process 초기 라우팅 구현
 * 볼트 파일 존재 여부에 따른 화면 전환
 */
function App(): React.JSX.Element {
  const [isCheckingVault, setIsCheckingVault] = useState(true)
  const [vaultExists, setVaultExists] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const { isLocked, lockVault } = useVault()
  const { t } = useTranslation()
  
  // OS 절전 모드 진입 시 자동 잠금 이벤트 구독
  useEffect(() => {
    const unsubscribe = EventsOn("vault-locked", () => {
      log('[App] OS Suspend/Sleep detected. Locking vault...');
      lockVault();
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [lockVault]);

  // Window blur (deactivate) 시 자동 잠금 처리
  useEffect(() => {
    const handleBlur = async () => {
      if (isLocked) return;
      
      try {
        EventsEmit("window-blur"); // Signal backend to check policy
        const config = await GetConfig() as any;
        if (config.lockOnDeactivate) {
          log('[App] Window blur detected and LockOnDeactivate is enabled. Locking vault...');
          lockVault();
        }
      } catch (error) {
        logError('Failed to get config on blur:', error);
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [isLocked, lockVault]);

  // Initialize theme
  useTheme()

  // 애플리케이션 시작 시 볼트 파일 존재 여부 확인
  // Application이 시작될 때 Vault_File의 존재 여부를 확인한다
  useEffect(() => {
    const checkVaultExists = async () => {
      try {
        const exists = await VaultExists()
        setVaultExists(exists)
        
        // Vault_File이 존재하지 않을 때 새 볼트 생성 화면을 표시한다
        if (!exists) {
          setShowCreateForm(true)
        }
      } catch (error) {
        logError('Failed to check vault existence:', error)
        // 에러 발생 시 기본적으로 생성 화면 표시
        setShowCreateForm(true)
      } finally {
        setIsCheckingVault(false)
      }
    }

    checkVaultExists()
  }, [])

  // 로딩 중 화면
  if (isCheckingVault) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t('common.appName')} Manager
          </h1>
          <p className="text-muted-foreground">
            {t('common.initializing')}
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {(!vaultExists || showCreateForm) ? (
          <Route 
            path="*" 
            element={
              <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <CreateVaultForm
                  vaultExists={vaultExists}
                  onSuccess={() => {
                    setVaultExists(true)
                    setShowCreateForm(false)
                  }}
                  onCancel={vaultExists ? () => setShowCreateForm(false) : undefined}
                />
              </div>
            } 
          />
        ) : isLocked ? (
          <Route 
            path="*" 
            element={
              <LoginPage
                onUnlockSuccess={() => {
                  log('[App] Unlock success callback triggered');
                }}
                onCreateVault={() => setShowCreateForm(true)}
              />
            } 
          />
        ) : (
          <>
            <Route path="/vault" element={<VaultPage />} />
            <Route path="*" element={<Navigate to="/vault" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}

export default App