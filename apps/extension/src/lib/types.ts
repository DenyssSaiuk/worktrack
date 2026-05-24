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

export interface ExtensionAuth {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  accessExpiresAt: number;
  email: string;
  fullName: string;
  role: string;
}

export interface ExtensionSettings {
  /** Backend base URL, e.g. `http://localhost:7340`. */
  backendUrl: string;
  /** When true, send only the domain — never the URL path. */
  domainOnly: boolean;
  /** Manual "do not track" toggle in the popup. */
  paused: boolean;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  backendUrl: 'http://localhost:7340',
  domainOnly: true,
  paused: false,
};
