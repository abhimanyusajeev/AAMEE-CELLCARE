const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "OWNER_EMAIL and OWNER_PASSWORD are required."
    );
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: {
      email,
    },
    data: {
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  console.log("Password updated successfully.");
  console.log(user);
}

main()
  .catch((error) => {
    console.error("Failed to update password:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });