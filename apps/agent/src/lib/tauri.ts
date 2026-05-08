import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import type { UnlistenFn } from '@tauri-apps/api/event';

export interface AgentStatus {
  enrolled: boolean;
  loggedIn: boolean;
  workdayActive: boolean;
  inPrivateSession: boolean;
  online: boolean;
  hostname: string;
  agentVersion: string;
  bufferedEventCount: number;
  serverUrl: string;
}

export const agent = {
  status(): Promise<AgentStatus> {
    return invoke<AgentStatus>('agent_status');
  },
  enrollAndLogin(serverUrl: string, enrollToken: string): Promise<void> {
    return invoke('agent_enroll', { serverUrl, enrollToken });
  },
  startWorkday(): Promise<void> {
    return invoke('agent_start_workday');
  },
  endWorkday(): Promise<void> {
    return invoke('agent_end_workday');
  },
  togglePrivate(): Promise<void> {
    return invoke('agent_toggle_private');
  },
  logout(): Promise<void> {
    return invoke('agent_logout');
  },
  onStatusChange(handler: (s: AgentStatus) => void): Promise<UnlistenFn> {
    return listen<AgentStatus>('agent://status', (e) => handler(e.payload));
  },
};
