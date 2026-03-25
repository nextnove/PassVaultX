import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { Download, Rocket, X, ExternalLink } from "lucide-react";
import { useUpdateStore } from "../stores/updateStore";
import { StartUpdate } from "../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../wailsjs/runtime/runtime";

export function UpdateModal() {
  const { t } = useTranslation();
  const { 
    latestVersion, 
    installerUrl, 
    portableUrl, 
    showUpdateModal, 
    toggleUpdateModal 
  } = useUpdateStore();

  if (!latestVersion) return null;

  const handleInstallerUpdate = async () => {
    if (installerUrl) {
      try {
        await StartUpdate(installerUrl);
        toggleUpdateModal(false);
      } catch (error) {
        console.error("Failed to start installer update:", error);
      }
    }
  };

  const handlePortableDownload = () => {
    if (portableUrl) {
      BrowserOpenURL(portableUrl);
      toggleUpdateModal(false);
    }
  };

  return (
    <AlertDialog open={showUpdateModal} onOpenChange={toggleUpdateModal}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            {t('update.title', '새로운 업데이트 발견!')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base py-2">
            {t('update.message', '새로운 버전 {{version}}이 릴리스되었습니다. 업데이트를 진행하시겠습니까?', { version: latestVersion })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="grid gap-4 py-4">
          {installerUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('update.recommended', '권장 (자동 업데이트)')}</p>
              <Button 
                onClick={handleInstallerUpdate} 
                className="w-full justify-start py-6 text-base"
              >
                <Download className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-bold">{t('update.useInstaller', '인스톨러로 업데이트')}</div>
                  <div className="text-xs opacity-70">PassVaultX_Installer.exe</div>
                </div>
              </Button>
            </div>
          )}
          
          {portableUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('update.portable', '휴대용 버전 (단일 EXE)')}</p>
              <Button 
                variant="outline" 
                onClick={handlePortableDownload} 
                className="w-full justify-start py-6 text-base"
              >
                <ExternalLink className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-bold">{t('update.downloadPortable', '단일 EXE 다운로드')}</div>
                  <div className="text-xs opacity-70">PassVaultX.exe</div>
                </div>
              </Button>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="ghost" onClick={() => toggleUpdateModal(false)}>
              <X className="h-4 w-4 mr-2" />
              {t('common.later', '나중에')}
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
