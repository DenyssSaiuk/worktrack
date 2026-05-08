import { prisma } from '@worktrack/database';
import { Worker } from 'bullmq';
import { Workbook } from 'exceljs';

import { loadConfig } from '../config.js';
import { QUEUE_NAMES } from './queues.js';
import { presignDownload, uploadObject } from '../lib/storage.js';
import { broadcast } from '../routes/ws.js';

import type { ConnectionOptions } from 'bullmq';
import type { Logger } from 'pino';

interface ExportJobData {
  jobId: string;
  organizationId: string;
  requestedBy: string;
  userId?: string;
  from: string;
  to: string;
  includeScreenshots: boolean;
}

export function startExcelExportWorker(
  connection: ConnectionOptions,
  log: Logger,
): Worker<ExportJobData> {
  const cfg = loadConfig();

  return new Worker<ExportJobData>(
    QUEUE_NAMES.EXCEL_EXPORT,
    async (job) => {
      const { jobId, organizationId, userId, from, to, includeScreenshots } = job.data;
      log.info({ jobId, userId, from, to }, 'excel-export start');

      await prisma.exportJob.update({
        where: { id: jobId },
        data: { status: 'running', progress: 5 },
      });
      broadcast(organizationId, { kind: 'export', jobId, status: 'running', progress: 5 });

      const start = new Date(from);
      const end = new Date(to);

      const userFilter = userId ? { id: userId, organizationId } : { organizationId };
      const users = await prisma.user.findMany({ where: userFilter });

      const workbook = new Workbook();
      workbook.creator = 'WorkTrack';
      workbook.created = new Date();

      const dailySheet = workbook.addWorksheet('Daily Summary');
      dailySheet.columns = [
        { header: 'User', key: 'user', width: 28 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Worked (min)', key: 'worked', width: 12 },
        { header: 'Idle (min)', key: 'idle', width: 12 },
        { header: 'Private (min)', key: 'private', width: 12 },
        { header: 'Productive (min)', key: 'productive', width: 16 },
        { header: 'Neutral (min)', key: 'neutral', width: 16 },
        { header: 'Distracting (min)', key: 'distracting', width: 16 },
        { header: 'Score', key: 'score', width: 8 },
      ];
      dailySheet.getRow(1).font = { bold: true };

      const activitySheet = workbook.addWorksheet('Activity Log');
      activitySheet.columns = [
        { header: 'User', key: 'user', width: 28 },
        { header: 'Timestamp', key: 'timestamp', width: 22 },
        { header: 'Type', key: 'type', width: 16 },
        { header: 'Detail', key: 'detail', width: 60 },
      ];
      activitySheet.getRow(1).font = { bold: true };

      const topAppsSheet = workbook.addWorksheet('Top Apps');
      topAppsSheet.columns = [
        { header: 'User', key: 'user', width: 28 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'App', key: 'app', width: 32 },
        { header: 'Minutes', key: 'minutes', width: 10 },
      ];
      const topSitesSheet = workbook.addWorksheet('Top Sites');
      topSitesSheet.columns = [
        { header: 'User', key: 'user', width: 28 },
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Domain', key: 'domain', width: 32 },
        { header: 'Minutes', key: 'minutes', width: 10 },
      ];
      const idleSheet = workbook.addWorksheet('Idle Periods');
      idleSheet.columns = [
        { header: 'User', key: 'user', width: 28 },
        { header: 'Started', key: 'started', width: 22 },
        { header: 'Duration (s)', key: 'durationSeconds', width: 14 },
      ];

      let processed = 0;
      for (const user of users) {
        const summaries = await prisma.dailySummary.findMany({
          where: {
            userId: user.id,
            date: { gte: stripTime(start), lte: stripTime(end) },
          },
          orderBy: { date: 'asc' },
        });
        for (const s of summaries) {
          dailySheet.addRow({
            user: user.fullName,
            date: s.date.toISOString().slice(0, 10),
            worked: s.workedMinutes,
            idle: s.idleMinutes,
            private: s.privateMinutes,
            productive: s.productiveMinutes,
            neutral: s.neutralMinutes,
            distracting: s.distractingMinutes,
            score: s.productivityScore,
          });
          for (const app of (s.topApps ?? []) as Array<{ label: string; minutes: number }>) {
            topAppsSheet.addRow({
              user: user.fullName,
              date: s.date.toISOString().slice(0, 10),
              app: app.label,
              minutes: app.minutes,
            });
          }
          for (const site of (s.topSites ?? []) as Array<{ label: string; minutes: number }>) {
            topSitesSheet.addRow({
              user: user.fullName,
              date: s.date.toISOString().slice(0, 10),
              domain: site.label,
              minutes: site.minutes,
            });
          }
        }

        const events = await prisma.activityEvent.findMany({
          where: {
            timestamp: { gte: start, lte: end },
            session: { userId: user.id },
          },
          orderBy: { timestamp: 'asc' },
          take: 10_000,
        });
        for (const e of events) {
          activitySheet.addRow({
            user: user.fullName,
            timestamp: e.timestamp.toISOString(),
            type: e.type,
            detail: JSON.stringify(e.payload).slice(0, 240),
          });
          if (e.type === 'idle_end') {
            const payload = e.payload as { idleDurationSeconds?: number };
            idleSheet.addRow({
              user: user.fullName,
              started: e.timestamp.toISOString(),
              durationSeconds: payload.idleDurationSeconds ?? 0,
            });
          }
        }

        processed++;
        const progress = Math.min(95, 5 + Math.round((processed / users.length) * 90));
        await prisma.exportJob.update({
          where: { id: jobId },
          data: { progress },
        });
        broadcast(organizationId, { kind: 'export', jobId, status: 'running', progress });
      }

      if (includeScreenshots) {
        const shotSheet = workbook.addWorksheet('Screenshots');
        shotSheet.columns = [
          { header: 'Taken at', key: 'takenAt', width: 22 },
          { header: 'Trigger', key: 'trigger', width: 24 },
          { header: 'AI summary', key: 'ai', width: 60 },
          { header: 'Reviewed', key: 'reviewed', width: 10 },
        ];
        const shots = await prisma.screenshot.findMany({
          where: {
            takenAt: { gte: start, lte: end },
            session: { user: { organizationId, ...(userId ? { id: userId } : {}) } },
          },
          orderBy: { takenAt: 'asc' },
          take: 5_000,
        });
        for (const s of shots) {
          shotSheet.addRow({
            takenAt: s.takenAt.toISOString(),
            trigger: s.trigger,
            ai: s.aiSummary ?? '',
            reviewed: s.reviewed ? 'yes' : 'no',
          });
        }
      }

      const buf = Buffer.from(await workbook.xlsx.writeBuffer());
      const key = `exports/${organizationId}/${jobId}.xlsx`;
      await uploadObject(
        cfg,
        key,
        buf,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const url = await presignDownload(cfg, key, 24 * 60 * 60);

      await prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'done',
          progress: 100,
          storageKey: key,
          downloadUrl: url,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          completedAt: new Date(),
        },
      });
      broadcast(organizationId, {
        kind: 'export',
        jobId,
        status: 'done',
        progress: 100,
        downloadUrl: url,
      });

      log.info({ jobId, key, bytes: buf.byteLength }, 'excel-export done');
      return { key, bytes: buf.byteLength };
    },
    { connection, concurrency: 2 },
  );
}

function stripTime(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

export type { ExportJobData };
