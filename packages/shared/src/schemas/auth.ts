import { z } from 'zod';

import { ROLE_VALUES } from '../constants/index.js';

export const loginRequest = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(256),
});
export type LoginRequest = z.infer<typeof loginRequest>;

export const tokenPair = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof tokenPair>;

export const sessionUser = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(ROLE_VALUES as [string, ...string[]]),
  organizationId: z.string(),
});
export type SessionUser = z.infer<typeof sessionUser>;

export const loginResponse = z.object({
  user: sessionUser,
  tokens: tokenPair,
});
export type LoginResponse = z.infer<typeof loginResponse>;

export const refreshRequest = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequest>;

export const agentEnrollRequest = z.object({
  enrollToken: z.string().min(8),
  hostname: z.string().min(1).max(256),
  os: z.string().min(1).max(64),
  agentVersion: z.string().min(1).max(32),
});
export type AgentEnrollRequest = z.infer<typeof agentEnrollRequest>;

export const agentEnrollResponse = z.object({
  agentToken: z.string(),
  deviceId: z.string(),
  userId: z.string(),
  policyVersion: z.string(),
});
export type AgentEnrollResponse = z.infer<typeof agentEnrollResponse>;

export const agentTokenPayload = z.object({
  sub: z.string(),
  deviceId: z.string(),
  organizationId: z.string(),
  scope: z.literal('agent'),
});
export type AgentTokenPayload = z.infer<typeof agentTokenPayload>;

export const userTokenPayload = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: z.enum(ROLE_VALUES as [string, ...string[]]),
  organizationId: z.string(),
  scope: z.literal('user'),
});
export type UserTokenPayload = z.infer<typeof userTokenPayload>;
