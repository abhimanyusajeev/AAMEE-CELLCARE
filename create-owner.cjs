const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME;

  if (!email || !password || !name) {
    throw new Error(
      "OWNER_EMAIL, OWNER_PASSWORD and OWNER_NAME are required."
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    throw new Error(`User already exists: ${email}`);
  }

  const owner = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  console.log(`Owner created successfully: ${owner.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });