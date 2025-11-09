declare global {
  interface Window {
    HOST?: string;
    openai?: {
      sendFollowUpMessage?: (params: { prompt: string }) => void;
    };
  }
}

export {};
