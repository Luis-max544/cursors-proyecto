import bcrypt from 'bcryptjs'
import { db, users, creatorProfiles, videos } from './index'

const SALT_ROUNDS = 12

async function seed() {
  console.log('Seeding database...')

  const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS)

  // Seed users
  const [alice, bob] = await db
    .insert(users)
    .values([
      { email: 'alice@example.com', username: 'alice_codes', passwordHash, role: 'creator' },
      { email: 'bob@example.com', username: 'bob_science', passwordHash, role: 'creator' },
    ])
    .returning({ id: users.id })
    .onConflictDoNothing()

  if (!alice || !bob) {
    console.log('Seed users already exist, skipping.')
    process.exit(0)
  }

  // Seed creator profiles
  await db.insert(creatorProfiles).values([
    {
      userId: alice.id,
      channelName: 'Alice Codes',
      channelSlug: 'alice-codes',
      approved: true,
      approvedAt: new Date(),
    },
    {
      userId: bob.id,
      channelName: 'Bob Science',
      channelSlug: 'bob-science',
      approved: true,
      approvedAt: new Date(),
    },
  ])

  // Seed videos — mix of free and premium, different categories
  const now = new Date()
  await db.insert(videos).values([
    {
      creatorId: alice.id,
      title: 'Intro to TypeScript in 30 minutes',
      description: 'A quick tour of TypeScript fundamentals for JavaScript developers.',
      category: 'programming',
      durationSeconds: 1800,
      status: 'ready',
      isPremium: false,
      viewsCount: 4200,
      publishedAt: now,
      hlsKey: 'hls/seed-video-1/index.m3u8',
    },
    {
      creatorId: alice.id,
      title: 'Advanced React Patterns',
      description: 'Compound components, render props, and custom hooks deep dive.',
      category: 'programming',
      durationSeconds: 3600,
      status: 'ready',
      isPremium: true,
      viewsCount: 2100,
      publishedAt: now,
      hlsKey: 'hls/seed-video-2/index.m3u8',
    },
    {
      creatorId: alice.id,
      title: 'Building REST APIs with Express',
      description: 'From zero to production-ready API with TypeScript and Express.',
      category: 'programming',
      durationSeconds: 5400,
      status: 'ready',
      isPremium: false,
      viewsCount: 6800,
      publishedAt: now,
      hlsKey: 'hls/seed-video-3/index.m3u8',
    },
    {
      creatorId: alice.id,
      title: 'Docker for Developers',
      description: 'Containerize your apps and set up local dev environments.',
      category: 'programming',
      durationSeconds: 2700,
      status: 'ready',
      isPremium: true,
      viewsCount: 3300,
      publishedAt: now,
      hlsKey: 'hls/seed-video-4/index.m3u8',
    },
    {
      creatorId: alice.id,
      title: 'Git & GitHub Masterclass',
      description: 'Branching, rebasing, pull requests, and CI/CD workflows.',
      category: 'programming',
      durationSeconds: 4200,
      status: 'ready',
      isPremium: false,
      viewsCount: 9100,
      publishedAt: now,
      hlsKey: 'hls/seed-video-5/index.m3u8',
    },
    {
      creatorId: bob.id,
      title: 'How Black Holes Form',
      description: 'The lifecycle of massive stars and the physics of gravitational collapse.',
      category: 'science',
      durationSeconds: 2400,
      status: 'ready',
      isPremium: false,
      viewsCount: 5500,
      publishedAt: now,
      hlsKey: 'hls/seed-video-6/index.m3u8',
    },
    {
      creatorId: bob.id,
      title: 'Quantum Mechanics for Beginners',
      description: 'Wave-particle duality, superposition, and the Schrödinger equation explained.',
      category: 'science',
      durationSeconds: 3900,
      status: 'ready',
      isPremium: true,
      viewsCount: 1800,
      publishedAt: now,
      hlsKey: 'hls/seed-video-7/index.m3u8',
    },
    {
      creatorId: bob.id,
      title: 'Introduction to Calculus',
      description: 'Limits, derivatives, and integrals from first principles.',
      category: 'math',
      durationSeconds: 4500,
      status: 'ready',
      isPremium: false,
      viewsCount: 7200,
      publishedAt: now,
      hlsKey: 'hls/seed-video-8/index.m3u8',
    },
    {
      creatorId: bob.id,
      title: 'Linear Algebra Essentials',
      description: 'Vectors, matrices, eigenvalues, and their applications in ML.',
      category: 'math',
      durationSeconds: 5100,
      status: 'ready',
      isPremium: true,
      viewsCount: 2900,
      publishedAt: now,
      hlsKey: 'hls/seed-video-9/index.m3u8',
    },
    {
      creatorId: bob.id,
      title: 'Spanish for Absolute Beginners',
      description: 'Core vocabulary, greetings, and basic sentence structure.',
      category: 'languages',
      durationSeconds: 3300,
      status: 'ready',
      isPremium: false,
      viewsCount: 11400,
      publishedAt: now,
      hlsKey: 'hls/seed-video-10/index.m3u8',
    },
  ])

  console.log(`Seeded 2 creators and 10 videos.`)
  console.log('Credentials: alice@example.com / password123, bob@example.com / password123')
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
