import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

type DemoUser = {
  email: string;
  name: string;
  role: Role;
  passwordEnvKey: 'DEMO_ADMIN_PW' | 'DEMO_PM_PW' | 'DEMO_MEMBER_PW';
};

const DEMO_USERS: DemoUser[] = [
  { email: 'admin@demo.local', name: 'Demo Admin', role: Role.admin, passwordEnvKey: 'DEMO_ADMIN_PW' },
  { email: 'pm@demo.local', name: 'Demo PM', role: Role.project_manager, passwordEnvKey: 'DEMO_PM_PW' },
  { email: 'member@demo.local', name: 'Demo Member', role: Role.team_member, passwordEnvKey: 'DEMO_MEMBER_PW' },
];

export const seedDemoUsers = async (client: PrismaClient = prisma): Promise<void> => {
  for (const u of DEMO_USERS) {
    const pw = process.env[u.passwordEnvKey];
    if (!pw) {
      throw new Error(`Missing required env var: ${u.passwordEnvKey}`);
    }
    const passwordHash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
    await client.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
      },
    });
  }
};

const isMain = require.main === module;

if (isMain) {
  seedDemoUsers()
    .then(() => {
      console.warn(`[seed] upserted ${DEMO_USERS.length} demo users`);
      return prisma.$disconnect();
    })
    .catch(async (err) => {
      console.error('[seed] failed', err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
