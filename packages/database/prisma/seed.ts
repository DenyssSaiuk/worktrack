/**
 * Development seed: 1 organization, 1 admin, 2 managers, 10 employees.
 * Idempotent — safe to re-run.
 */
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
        screenshotsEnabled: false,
        aiAnalysisEnabled: false,
        defaultWorkSchedule: DEFAULT_SCHEDULE,
      },
    },
    update: {},
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

  for (let i = 1; i <= 10; i++) {
    const email = `employee${i}@acme.test`;
    const manager = managers[i % managers.length];
    if (!manager) continue;
    await prisma.user.upsert({
      where: { email },
      create: {
        organizationId: org.id,
        email,
        passwordHash,
        fullName: `Employee ${i}`,
        role: 'employee',
        managerId: manager.id,
        workSchedule: DEFAULT_SCHEDULE,
      },
      update: {},
    });
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
      { organizationId: org.id, pattern: 'slack.com', category: 'neutral', appliesTo: 'all' },
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

  console.log('\n=== WorkTrack dev seed complete ===');
  console.log(`Organization: ${org.name} (${org.slug})`);
  console.log(`Admin login:    ${admin.email} / ${DEFAULT_PASSWORD}`);
  console.log(`Manager logins: ${managers.map((m) => m.email).join(', ')} / ${DEFAULT_PASSWORD}`);
  console.log('Employee logins: employee1@acme.test … employee10@acme.test (same password)');
  console.log('===================================\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
