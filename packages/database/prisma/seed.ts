/**
 * Development seed: 1 organization, 1 admin, 2 managers, 10 employees,
 * 2 weeks of synthetic activity (work sessions, events, daily summaries) and
 * a few manager-requested screenshots for the review queue.
 * Idempotent — safe to re-run.
 */
import { randomBytes } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'WorkTrack!Dev2026';
const DEFAULT_SCHEDULE = {
  timezone: 'Europe/Kyiv',
  hours: {
    mon: { start: '09:00', end: '18:00' },
    tue: { start: '09:00', end: '18:00' },
    wed: { start: '09:00', end: '18:00' },
    thu: { start: '09:00', end: '18:00' },
    fri: { start: '09:00', end: '18:00' },
  },
};

const ACTIVITY_DAYS = 14;

// (process, window-title) for window_focus events.
const PRODUCTIVE_APPS = [
  ['Code.exe', 'index.ts — worktrack'],
  ['Code.exe', 'schema.prisma — worktrack'],
  ['WebStorm.exe', 'dashboard/page.tsx'],
  ['Terminal.exe', 'pnpm test'],
  ['Figma.exe', 'WorkTrack — Live screen'],
];
const NEUTRAL_APPS = [
  ['Slack.exe', '#engineering — Acme'],
  ['Outlook.exe', 'Inbox — 12 unread'],
  ['Notion.exe', 'Team wiki — Sprint 24'],
];
const DISTRACTING_APPS = [
  ['Spotify.exe', 'Lo-fi beats'],
  ['Telegram.exe', 'Friends chat'],
];

const PRODUCTIVE_SITES: Array<[string, string]> = [
  ['github.com', 'denyssaiuk/worktrack · PR #42'],
  ['github.com', 'Issues · worktrack'],
  ['jira.atlassian.com', 'WT-104 — Implement aggregation worker'],
  ['docs.google.com', 'Q2 OKRs draft'],
  ['stackoverflow.com', 'How to type generic Prisma where'],
];
const NEUTRAL_SITES: Array<[string, string]> = [
  ['slack.com', '#engineering — Acme'],
  ['mail.google.com', 'Inbox (3)'],
];
const DISTRACTING_SITES: Array<[string, string]> = [
  ['youtube.com', 'Lo-fi hip hop radio — beats to relax/study to'],
  ['facebook.com', 'News feed'],
  ['tiktok.com', 'For you'],
];

interface EventRow {
  sessionId: string;
  clientEventId: string;
  timestamp: Date;
  type: 'window_focus' | 'tab_focus' | 'idle_start' | 'idle_end';
  payload: Record<string, unknown>;
}

interface SummaryAccum {
  productiveMinutes: number;
  neutralMinutes: number;
  distractingMinutes: number;
  idleMinutes: number;
  workedMinutes: number;
  topApps: Map<string, number>;
  topSites: Map<string, number>;
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main(): Promise<void> {
  console.log('Seeding development data…');

  const passwordHash = await hash(DEFAULT_PASSWORD, 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'acme' },
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      retentionDays: 90,
      settings: {
        screenshotsEnabled: true,
        aiAnalysisEnabled: false,
        defaultWorkSchedule: DEFAULT_SCHEDULE,
      },
    },
    update: {
      settings: {
        screenshotsEnabled: true,
        aiAnalysisEnabled: false,
        defaultWorkSchedule: DEFAULT_SCHEDULE,
      },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acme.test' },
    create: {
      organizationId: org.id,
      email: 'admin@acme.test',
      passwordHash,
      fullName: 'Acme Admin',
      role: 'admin',
      consentVersion: '2025-01-01',
      consentAt: new Date(),
    },
    update: {},
  });

  const managers = await Promise.all(
    [
      { email: 'alice.manager@acme.test', fullName: 'Alice Manager' },
      { email: 'bob.manager@acme.test', fullName: 'Bob Manager' },
    ].map(({ email, fullName }) =>
      prisma.user.upsert({
        where: { email },
        create: {
          organizationId: org.id,
          email,
          passwordHash,
          fullName,
          role: 'manager',
          workSchedule: DEFAULT_SCHEDULE,
        },
        update: {},
      }),
    ),
  );

  const employeeNames = [
    'Olena Kovalenko',
    'Maks Tymoshenko',
    'Iryna Shevchenko',
    'Andrii Bondarenko',
    'Natalia Petrenko',
    'Vasyl Marchenko',
    'Yulia Lysenko',
    'Dmytro Boyko',
    'Sofia Kravchenko',
    'Taras Melnyk',
  ];

  const employees = [];
  for (let i = 1; i <= 10; i++) {
    const email = `employee${i}@acme.test`;
    const manager = managers[i % managers.length];
    if (!manager) continue;
    const fullName = employeeNames[i - 1] ?? `Employee ${i}`;
    const u = await prisma.user.upsert({
      where: { email },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        fullName,
        role: 'employee',
        managerId: manager.id,
        workSchedule: DEFAULT_SCHEDULE,
        consentVersion: '2025-01-01',
        consentAt: new Date(),
      },
      update: { fullName, managerId: manager.id },
    });
    employees.push(u);
  }

  await prisma.productivityRule.deleteMany({ where: { organizationId: org.id } });
  await prisma.productivityRule.createMany({
    data: [
      { organizationId: org.id, pattern: 'github.com', category: 'productive', appliesTo: 'all' },
      {
        organizationId: org.id,
        pattern: 'jira.atlassian.com',
        category: 'productive',
        appliesTo: 'all',
      },
      {
        organizationId: org.id,
        pattern: 'docs.google.com',
        category: 'productive',
        appliesTo: 'all',
      },
      {
        organizationId: org.id,
        pattern: 'stackoverflow.com',
        category: 'productive',
        appliesTo: 'all',
      },
      { organizationId: org.id, pattern: 'slack.com', category: 'neutral', appliesTo: 'all' },
      {
        organizationId: org.id,
        pattern: 'mail.google.com',
        category: 'neutral',
        appliesTo: 'all',
      },
      { organizationId: org.id, pattern: 'youtube.com', category: 'distracting', appliesTo: 'all' },
      {
        organizationId: org.id,
        pattern: 'facebook.com',
        category: 'distracting',
        appliesTo: 'all',
      },
      { organizationId: org.id, pattern: 'tiktok.com', category: 'distracting', appliesTo: 'all' },
    ],
  });

  await seedActivity(employees);
  await seedScreenshots(employees);

  console.log('\n=== WorkTrack dev seed complete ===');
  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log(`Admin login:    ${admin.email} / ${DEFAULT_PASSWORD}`);
  console.log(`Manager logins: ${managers.map((m) => m.email).join(', ')} / ${DEFAULT_PASSWORD}`);
  console.log('Employee logins: employee1@acme.test … employee10@acme.test (same password)');
  console.log('===================================\n');
}

async function seedActivity(employees: Array<{ id: string; fullName: string }>): Promise<void> {
  console.log(`Generating ${ACTIVITY_DAYS} days of activity for ${employees.length} employees…`);

  // Always clear and reseed activity so the demo lines up with "today"
  // whenever you re-run `pnpm db:seed`.
  await prisma.dailySummary.deleteMany({});
  await prisma.activityEvent.deleteMany({});
  await prisma.workSession.deleteMany({});
  await prisma.device.deleteMany({});

  // One device per employee.
  for (const emp of employees) {
    await prisma.device.create({
      data: {
        userId: emp.id,
        hostname: `${emp.fullName.split(' ')[0]?.toLowerCase()}-laptop`,
        os: pick(['windows-11', 'macos-14', 'ubuntu-22.04'], Math.random),
        agentVersion: '0.1.0',
        lastSeenAt: new Date(),
      },
    });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const allEvents: EventRow[] = [];
  const allSummaries: Array<{
    userId: string;
    date: Date;
    workedMinutes: number;
    idleMinutes: number;
    productiveMinutes: number;
    neutralMinutes: number;
    distractingMinutes: number;
    productivityScore: number;
    topApps: unknown;
    topSites: unknown;
  }> = [];

  for (let idx = 0; idx < employees.length; idx++) {
    const emp = employees[idx];
    if (!emp) continue;
    const rng = mulberry32(0xa11ce + idx * 7919);
    const device = await prisma.device.findFirst({ where: { userId: emp.id } });
    if (!device) continue;

    // 0 = most productive, 0.7 = mostly distracted.
    const distractionBias = 0.05 + rng() * 0.45;

    for (let dayOffset = ACTIVITY_DAYS - 1; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(today.getTime() - dayOffset * 24 * 60 * 60 * 1000);
      const dow = dayDate.getUTCDay();
      const isToday = dayOffset === 0;
      // Skip Sundays entirely; Saturdays only sometimes. Always seed today so
      // the dashboard's "today" widgets have something to render.
      if (!isToday && dow === 0) continue;
      if (!isToday && dow === 6 && rng() < 0.7) continue;

      const sessionStart = new Date(dayDate);
      sessionStart.setUTCHours(9, Math.floor(rng() * 30), 0, 0);
      const sessionEnd = new Date(sessionStart.getTime());
      sessionEnd.setUTCHours(17 + Math.floor(rng() * 2), 30 + Math.floor(rng() * 30), 0, 0);
      const durationMinutes = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 60_000);

      const session = await prisma.workSession.create({
        data: {
          userId: emp.id,
          deviceId: device.id,
          clientSessionId: `seed-${emp.id}-${dayDate.toISOString().slice(0, 10)}`,
          startedAt: sessionStart,
          endedAt: isToday ? null : sessionEnd,
          state: isToday ? 'active' : 'closed',
          privateMinutes: Math.floor(rng() * 20),
        },
      });

      const acc: SummaryAccum = {
        productiveMinutes: 0,
        neutralMinutes: 0,
        distractingMinutes: 0,
        idleMinutes: 0,
        workedMinutes: 0,
        topApps: new Map(),
        topSites: new Map(),
      };

      // Walk the session in 2-7 min slices; each slice picks a category.
      let cursor = sessionStart.getTime();
      let eventCounter = 0;
      while (cursor < sessionEnd.getTime() - 60_000) {
        const sliceMinutes = 2 + Math.floor(rng() * 6);
        const sliceEnd = Math.min(cursor + sliceMinutes * 60_000, sessionEnd.getTime());
        const r = rng();
        const category = r < distractionBias ? 'distracting' : r < 0.85 ? 'productive' : 'neutral';

        // Drop a focus event at the start of the slice.
        const isBrowserSlice = rng() < 0.6;
        if (isBrowserSlice) {
          const sitePool =
            category === 'productive'
              ? PRODUCTIVE_SITES
              : category === 'neutral'
                ? NEUTRAL_SITES
                : DISTRACTING_SITES;
          const [domain, title] = pick(sitePool, rng);
          allEvents.push({
            sessionId: session.id,
            clientEventId: `seed-${session.id}-${eventCounter++}`,
            timestamp: new Date(cursor),
            type: 'tab_focus',
            payload: {
              browser: 'chrome',
              domain,
              title,
              incognito: false,
            },
          });
          acc.topSites.set(domain, (acc.topSites.get(domain) ?? 0) + sliceMinutes);
        } else {
          const appPool =
            category === 'productive'
              ? PRODUCTIVE_APPS
              : category === 'neutral'
                ? NEUTRAL_APPS
                : DISTRACTING_APPS;
          const [processName, windowTitle] = pick(appPool, rng);
          allEvents.push({
            sessionId: session.id,
            clientEventId: `seed-${session.id}-${eventCounter++}`,
            timestamp: new Date(cursor),
            type: 'window_focus',
            payload: { processName, windowTitle },
          });
          acc.topApps.set(processName, (acc.topApps.get(processName) ?? 0) + sliceMinutes);
        }

        // Occasional idle pair.
        if (rng() < 0.12) {
          const idleStart = sliceEnd - 60_000;
          const idleMinutes = 1 + Math.floor(rng() * 4);
          allEvents.push({
            sessionId: session.id,
            clientEventId: `seed-${session.id}-${eventCounter++}`,
            timestamp: new Date(idleStart),
            type: 'idle_start',
            payload: { idleThresholdSeconds: 60 },
          });
          allEvents.push({
            sessionId: session.id,
            clientEventId: `seed-${session.id}-${eventCounter++}`,
            timestamp: new Date(idleStart + idleMinutes * 60_000),
            type: 'idle_end',
            payload: { idleSeconds: idleMinutes * 60 },
          });
          acc.idleMinutes += idleMinutes;
        }

        if (category === 'productive') acc.productiveMinutes += sliceMinutes;
        else if (category === 'neutral') acc.neutralMinutes += sliceMinutes;
        else acc.distractingMinutes += sliceMinutes;
        acc.workedMinutes += sliceMinutes;
        cursor = sliceEnd;
      }

      // Numerator and denominator for the productivity score.
      const total = acc.productiveMinutes + acc.neutralMinutes + acc.distractingMinutes;
      const productivityScore =
        total > 0
          ? Math.round(((acc.productiveMinutes + 0.5 * acc.neutralMinutes) * 100) / total)
          : 0;

      const summaryDate = new Date(dayDate);
      summaryDate.setUTCHours(0, 0, 0, 0);

      allSummaries.push({
        userId: emp.id,
        date: summaryDate,
        workedMinutes: acc.workedMinutes,
        idleMinutes: acc.idleMinutes,
        productiveMinutes: acc.productiveMinutes,
        neutralMinutes: acc.neutralMinutes,
        distractingMinutes: acc.distractingMinutes,
        productivityScore,
        topApps: Array.from(acc.topApps.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, minutes]) => ({ label, minutes })),
        topSites: Array.from(acc.topSites.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([label, minutes]) => ({ label, minutes })),
      });
      void durationMinutes;
    }
  }

  // Bulk insert in chunks so we don't exceed query length.
  const chunkSize = 1000;
  for (let i = 0; i < allEvents.length; i += chunkSize) {
    await prisma.activityEvent.createMany({
      data: allEvents.slice(i, i + chunkSize),
      skipDuplicates: true,
    });
  }
  console.log(`  ↳ inserted ${allEvents.length} activity events.`);

  for (let i = 0; i < allSummaries.length; i += chunkSize) {
    await prisma.dailySummary.createMany({
      data: allSummaries.slice(i, i + chunkSize),
      skipDuplicates: true,
    });
  }
  console.log(`  ↳ inserted ${allSummaries.length} daily summaries.`);
}

async function seedScreenshots(employees: Array<{ id: string; fullName: string }>): Promise<void> {
  const existing = await prisma.screenshot.count();
  if (existing > 0) {
    console.log(`  ↳ ${existing} screenshots already present — skipping.`);
    return;
  }

  const candidates = employees.slice(0, 5);
  for (const emp of candidates) {
    const session = await prisma.workSession.findFirst({
      where: { userId: emp.id },
      orderBy: { startedAt: 'desc' },
    });
    if (!session) continue;
    await prisma.screenshot.create({
      data: {
        sessionId: session.id,
        takenAt: new Date(),
        trigger: 'manager_request',
        storageKey: `screenshots/${emp.id}/${randomBytes(8).toString('hex')}.bin`,
        width: 1920,
        height: 1080,
        encryption: {
          algo: 'AES-256-GCM',
          ivBase64: randomBytes(12).toString('base64'),
          keyId: `org-key-1`,
        },
        reviewed: false,
      },
    });
  }
  console.log(`  ↳ inserted ${candidates.length} pending screenshots.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
