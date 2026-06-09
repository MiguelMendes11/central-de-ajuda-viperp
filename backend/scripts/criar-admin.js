require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  console.error("Erro: DATABASE_URL não encontrada no arquivo .env");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

async function criarAdmin() {
  const nome = "Administrador";
  const email = "admin@viperp.com.br";
  const senha = "admin123";

  const adminExistente = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (adminExistente) {
    console.log("Usuário administrador já existe:");
    console.log("Email:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(senha, 10);

  await prisma.user.create({
    data: {
      name: nome,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Usuário administrador criado com sucesso!");
  console.log("");
  console.log("Email:", email);
  console.log("Senha:", senha);
  console.log("");
  console.log("Importante: depois vamos trocar essa senha no painel.");
}

criarAdmin()
  .catch((error) => {
    console.error("Erro ao criar administrador:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });