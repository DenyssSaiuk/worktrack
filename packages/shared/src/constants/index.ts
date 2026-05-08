export const ROLES = {
  EMPLOYEE: 'employee',
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = Object.values(ROLES);

export const EVENT_TYPES = {
  WINDOW_FOCUS: 'window_focus',
  TAB_FOCUS: 'tab_focus',
  IDLE_START: 'idle_start',
  IDLE_END: 'idle_end',
  PRIVATE_START: 'private_start',
  PRIVATE_END: 'private_end',
  SCREENSHOT: 'screenshot',
} as const;
export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
export const EVENT_TYPE_VALUES = Object.values(EVENT_TYPES);

export const PRODUCTIVITY_CATEGORIES = {
  PRODUCTIVE: 'productive',
  NEUTRAL: 'neutral',
  DISTRACTING: 'distracting',
  BLOCKED: 'blocked',
} as const;
export type ProductivityCategory =
  (typeof PRODUCTIVITY_CATEGORIES)[keyof typeof PRODUCTIVITY_CATEGORIES];
export const PRODUCTIVITY_CATEGORY_VALUES = Object.values(PRODUCTIVITY_CATEGORIES);

export const SCREENSHOT_TRIGGERS = {
  UNKNOWN_PROCESS: 'unknown_process',
  NON_WHITELISTED_DOMAIN: 'non_whitelisted_domain',
  MANAGER_REQUESTED: 'manager_requested',
} as const;
export type ScreenshotTrigger = (typeof SCREENSHOT_TRIGGERS)[keyof typeof SCREENSHOT_TRIGGERS];
export const SCREENSHOT_TRIGGER_VALUES = Object.values(SCREENSHOT_TRIGGERS);

export const LIMITS = {
  MAX_EVENTS_PER_BATCH: 1000,
  HEARTBEAT_INTERVAL_MS: 60_000,
  SYNC_INTERVAL_MS: 30_000,
  MIN_RETENTION_DAYS: 7,
  MAX_RETENTION_DAYS: 365,
  DEFAULT_RETENTION_DAYS: 90,
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_SECONDS: 7 * 24 * 60 * 60,
  AGENT_TOKEN_TTL_SECONDS: 365 * 24 * 60 * 60,
  BCRYPT_COST: 12,
} as const;

export const POLICY_VERSION = '2025-01-01';
