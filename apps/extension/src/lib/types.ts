export interface TabFocusEventPayload {
  browser: string;
  domain: string;
  url?: string;
  title: string;
  incognito: boolean;
}

export interface ExtensionEvent {
  clientEventId: string;
  timestamp: string;
  type: 'tab_focus';
  payload: TabFocusEventPayload;
}

export interface ExtensionSettings {
  trackUrls: boolean; // if false, only domain is reported
  hostPort: string; // native host name
  paused: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  trackUrls: false,
  hostPort: 'com.worktrack.agent.bridge',
  paused: false,
};
