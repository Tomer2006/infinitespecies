/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

// Global window extensions for React integration
interface Window {
  __reactCanvas: HTMLCanvasElement | null;
  __reactShowLoading: (title: string) => void;
  __reactHideLoading: () => void;
  __reactUpdateProgress: (progress: number, label?: string, stage?: string) => void;
  gc?: () => void;
}

