import 'dotenv/config'
import { PrismaClient } from './generated/prisma/client.js'
import { PrismaNeon } from '@prisma/adapter-neon'

const neon = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
})

export const prisma = new PrismaClient({ adapter: neon })
