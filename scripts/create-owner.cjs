const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "abhimanyu@gmail.com";
  const password = process.env.OWNER_PASSWORD;

  if (!password) {
    throw new Error("OWNER_PASSWORD environment variable is required.");
  }

  if (password.length < 8) {
    throw new Error("OWNER_PASSWORD must be at least 8 characters.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
    },
  });

  if (existingUser) {
    console.log("User already exists:", existingUser.email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name: "Abhimanyu",
      email: email.toLowerCase(),
      phone: null,
      passwordHash,
      role: "OWNER",
      isActive: true,
    },
  });

  console.log("Owner created successfully!");
  console.log("ID:", user.id);
  console.log("Email:", user.email);
  console.log("Role:", user.role);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
