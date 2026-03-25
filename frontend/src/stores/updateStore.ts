import { create } from 'zustand';

interface UpdateState {
  latestVersion: string | null;
  installerUrl: string | null;
  portableUrl: string | null;
  showUpdateModal: boolean;
  
  setUpdateInfo: (version: string, installer: string, portable: string) => void;
  toggleUpdateModal: (show?: boolean) => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  latestVersion: null,
  installerUrl: null,
  portableUrl: null,
  showUpdateModal: false,

  setUpdateInfo: (version, installer, portable) => 
    set({ 
      latestVersion: version, 
      installerUrl: installer, 
      portableUrl: portable,
    }),
    
  toggleUpdateModal: (show) => 
    set((state) => ({ showUpdateModal: show !== undefined ? show : !state.showUpdateModal })),
    
  reset: () => 
    set({ latestVersion: null, installerUrl: null, portableUrl: null, showUpdateModal: false }),
}));
