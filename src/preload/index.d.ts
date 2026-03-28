import type { ElectronAPI } from './index'

// Augment the global Window interface so TypeScript knows window.api exists
declare global {
  interface Window {
    api: ElectronAPI
  }
}
