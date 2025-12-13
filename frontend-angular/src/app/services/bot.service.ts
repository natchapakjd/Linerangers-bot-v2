import { Injectable, signal } from '@angular/core';
import { BotStatus, CommandResponse, WsMessage } from '../models/bot.model';

@Injectable({
  providedIn: 'root'
})
export class BotService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 5;
  
  // Signals for reactive state
  status = signal<BotStatus>({
    state: 'stopped',
    adb_connected: false,
    current_action: 'Idle',
    loop_count: 0
  });
  
  screenImage = signal<string>('');
  logs = signal<string[]>(['🚀 System ready. Click START to begin.']);
  isConnected = signal<boolean>(false);

  constructor() {
    this.connect();
  }

  private connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.isConnected.set(true);
      this.addLog('🔌 Connected to server');
    };
    
    this.ws.onclose = () => {
      this.isConnected.set(false);
      if (this.reconnectAttempts < this.MAX_RECONNECT) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), 2000);
      }
    };
    
    this.ws.onerror = () => {
      this.addLog('⚠️ Connection error');
    };
    
    this.ws.onmessage = (event) => {
      const data: WsMessage = JSON.parse(event.data);
      this.handleMessage(data);
    };
  }

  private handleMessage(data: WsMessage): void {
    switch (data.type) {
      case 'status':
        if (data.data) this.status.set(data.data);
        break;
      case 'screen':
        if (data.image) this.screenImage.set(data.image);
        break;
      case 'log':
        if (data.message) this.addLog(data.message);
        break;
    }
  }

  addLog(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const logs = this.logs();
    this.logs.set([...logs, `[${timestamp}] ${message}`]);
  }

  clearLogs(): void {
    this.logs.set([]);
    this.addLog('📋 Logs cleared');
  }

  // API Methods
  async start(): Promise<CommandResponse | null> {
    this.addLog('🚀 Starting bot...');
    return this.apiCall('start');
  }

  async stop(): Promise<CommandResponse | null> {
    this.addLog('🛑 Stopping bot...');
    const result = await this.apiCall('stop');
    if (result?.success) {
      this.screenImage.set('');
    }
    return result;
  }

  async pause(): Promise<CommandResponse | null> {
    this.addLog('⏸️ Pausing bot...');
    return this.apiCall('pause');
  }

  async resume(): Promise<CommandResponse | null> {
    this.addLog('▶️ Resuming bot...');
    return this.apiCall('resume');
  }

  private async apiCall(endpoint: string): Promise<CommandResponse | null> {
    try {
      const response = await fetch(`/api/v1/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result: CommandResponse = await response.json();
      this.addLog(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
      return result;
    } catch (error) {
      this.addLog(`❌ API Error: ${error}`);
      return null;
    }
  }
}
