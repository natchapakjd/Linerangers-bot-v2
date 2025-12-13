// Bot status interface
export interface BotStatus {
  state: 'stopped' | 'running' | 'paused' | 'error';
  adb_connected: boolean;
  current_action: string;
  loop_count: number;
}

// API response interface
export interface CommandResponse {
  success: boolean;
  message: string;
  data?: any;
}

// WebSocket message types
export interface WsMessage {
  type: 'status' | 'screen' | 'log';
  data?: BotStatus;
  image?: string;
  message?: string;
}
