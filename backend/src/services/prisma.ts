import { PrismaClient } from '@prisma/client';

// Singleton instance to prevent multiple client instantiations
const prisma = new PrismaClient();

export default prisma;
