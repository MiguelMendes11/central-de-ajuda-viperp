require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

if (!process.env.DATABASE_URL) {
  console.error("Erro: DATABASE_URL não encontrada no arquivo .env");
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error("Erro: JWT_SECRET não encontrada no arquivo .env");
  process.exit(1);
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function getTokenFromRequest(req) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return null;
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function authenticateAdmin(req, res, next) {
  try {
    const token = getTokenFromRequest(req);

    if (!token) {
      return res.status(401).json({
        error: "Token de autenticação não informado.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.id,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Usuário não encontrado.",
      });
    }

    if (user.role !== "ADMIN" && user.role !== "EDITOR") {
      return res.status(403).json({
        error: "Usuário sem permissão administrativa.",
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    return res.status(401).json({
      error: "Sessão inválida ou expirada.",
    });
  }
}

function normalizeSearchTerm(value) {
  return String(value || "").trim();
}

function getPaginationParams(req) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function getPublicArticleInclude() {
  return {
    category: true,
    tags: {
      include: {
        tag: true,
      },
    },
  };
}

function getAdminArticleInclude() {
  return {
    category: true,
    tags: {
      include: {
        tag: true,
      },
    },
  };
}

function validateArticlePayload(payload) {
  const { title, slug, contentHtml, status } = payload;

  if (!title || !String(title).trim()) {
    return "O título do artigo é obrigatório.";
  }

  if (!slug || !String(slug).trim()) {
    return "O slug do artigo é obrigatório.";
  }

  if (!contentHtml || !String(contentHtml).trim()) {
    return "O conteúdo do artigo é obrigatório.";
  }

  const allowedStatus = ["PUBLISHED", "DRAFT", "ARCHIVED"];

  if (!allowedStatus.includes(status)) {
    return "Status inválido.";
  }

  return null;
}

/* ============================= */
/* ROTAS ADMINISTRATIVAS */
/* ============================= */

app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Informe e-mail e senha.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: String(email).trim().toLowerCase(),
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "E-mail ou senha inválidos.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({
        error: "E-mail ou senha inválidos.",
      });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Erro no login administrativo:", error);

    return res.status(500).json({
      error: "Erro ao realizar login administrativo.",
    });
  }
});

app.get("/admin/me", authenticateAdmin, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
      updatedAt: req.user.updatedAt,
    },
  });
});

app.get("/admin/articles", authenticateAdmin, async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: [
        {
          updatedAt: "desc",
        },
      ],
      include: getAdminArticleInclude(),
    });

    return res.json({
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos administrativos:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigos administrativos.",
    });
  }
});

app.post("/admin/articles", authenticateAdmin, async (req, res) => {
  try {
    const {
      title,
      slug,
      summary,
      contentHtml,
      status,
      protected: isProtected,
      isFeatured,
    } = req.body;

    const validationError = validateArticlePayload({
      title,
      slug,
      contentHtml,
      status,
    });

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const cleanSlug = String(slug).trim();

    const slugAlreadyExists = await prisma.article.findUnique({
      where: {
        slug: cleanSlug,
      },
    });

    if (slugAlreadyExists) {
      return res.status(409).json({
        error: "Já existe um artigo usando este slug.",
      });
    }

    const now = new Date();

    const article = await prisma.article.create({
      data: {
        title: String(title).trim(),
        slug: cleanSlug,
        summary: summary ? String(summary).trim() : null,
        contentHtml: String(contentHtml).trim(),
        originalHtml: String(contentHtml).trim(),
        status,
        protected: Boolean(isProtected),
        isFeatured: Boolean(isFeatured),
        author: req.user.name || req.user.email,
        publishedAt: status === "PUBLISHED" ? now : null,
        modifiedAt: now,
        imageCount: 0,
        localImageCount: 0,
        missingImageCount: 0,
        videoCount: 0,
      },
      include: getAdminArticleInclude(),
    });

    return res.status(201).json({
      message: "Artigo criado com sucesso.",
      article,
    });
  } catch (error) {
    console.error("Erro ao criar artigo administrativo:", error);

    return res.status(500).json({
      error: "Erro ao criar artigo administrativo.",
    });
  }
});

app.get("/admin/articles/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const article = await prisma.article.findUnique({
      where: {
        id,
      },
      include: getAdminArticleInclude(),
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
      });
    }

    return res.json({
      article,
    });
  } catch (error) {
    console.error("Erro ao buscar artigo administrativo:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigo administrativo.",
    });
  }
});

app.put("/admin/articles/:id", authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      slug,
      summary,
      contentHtml,
      status,
      protected: isProtected,
      isFeatured,
    } = req.body;

    const validationError = validateArticlePayload({
      title,
      slug,
      contentHtml,
      status,
    });

    if (validationError) {
      return res.status(400).json({
        error: validationError,
      });
    }

    const existingArticle = await prisma.article.findUnique({
      where: {
        id,
      },
    });

    if (!existingArticle) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
      });
    }

    const cleanSlug = String(slug).trim();

    const slugAlreadyExists = await prisma.article.findFirst({
      where: {
        slug: cleanSlug,
        NOT: {
          id,
        },
      },
    });

    if (slugAlreadyExists) {
      return res.status(409).json({
        error: "Já existe outro artigo usando este slug.",
      });
    }

    const wasNotPublished = existingArticle.status !== "PUBLISHED";
    const willBePublished = status === "PUBLISHED";

    const article = await prisma.article.update({
      where: {
        id,
      },
      data: {
        title: String(title).trim(),
        slug: cleanSlug,
        summary: summary ? String(summary).trim() : null,
        contentHtml: String(contentHtml).trim(),
        status,
        protected: Boolean(isProtected),
        isFeatured: Boolean(isFeatured),
        publishedAt:
          wasNotPublished && willBePublished && !existingArticle.publishedAt
            ? new Date()
            : existingArticle.publishedAt,
        modifiedAt: new Date(),
      },
      include: getAdminArticleInclude(),
    });

    return res.json({
      message: "Artigo atualizado com sucesso.",
      article,
    });
  } catch (error) {
    console.error("Erro ao atualizar artigo administrativo:", error);

    return res.status(500).json({
      error: "Erro ao atualizar artigo administrativo.",
    });
  }
});

/* ============================= */
/* ROTAS PÚBLICAS */
/* ============================= */

app.get("/", (req, res) => {
  return res.json({
    message: "API da Central de Ajuda VipERP funcionando.",
    version: "1.0.0",
  });
});

app.get("/stats", async (req, res) => {
  try {
    const [
      articles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      categories,
      tags,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({
        where: {
          status: "PUBLISHED",
        },
      }),
      prisma.article.count({
        where: {
          status: "DRAFT",
        },
      }),
      prisma.article.count({
        where: {
          status: "ARCHIVED",
        },
      }),
      prisma.category.count(),
      prisma.tag.count(),
    ]);

    return res.json({
      articles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      categories,
      tags,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);

    return res.status(500).json({
      error: "Erro ao buscar estatísticas.",
    });
  }
});

app.get("/debug/slugs", async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
      },
      orderBy: {
        title: "asc",
      },
    });

    return res.json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar slugs:", error);

    return res.status(500).json({
      error: "Erro ao buscar slugs.",
    });
  }
});

app.get("/articles", async (req, res) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);

    const where = {
      status: "PUBLISHED",
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({
        where,
      }),
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            publishedAt: "desc",
          },
          {
            title: "asc",
          },
        ],
        include: getPublicArticleInclude(),
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigos.",
    });
  }
});

app.get("/search", async (req, res) => {
  try {
    const query = normalizeSearchTerm(req.query.q);
    const { page, limit, skip } = getPaginationParams(req);

    if (!query) {
      return res.json({
        page,
        limit,
        total: 0,
        totalPages: 0,
        articles: [],
      });
    }

    const where = {
      status: "PUBLISHED",
      OR: [
        {
          title: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          summary: {
            contains: query,
            mode: "insensitive",
          },
        },
        {
          contentHtml: {
            contains: query,
            mode: "insensitive",
          },
        },
      ],
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({
        where,
      }),
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            publishedAt: "desc",
          },
          {
            title: "asc",
          },
        ],
        include: getPublicArticleInclude(),
      }),
    ]);

    return res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos na pesquisa:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigos na pesquisa.",
    });
  }
});

app.get("/articles/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await prisma.article.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
      },
      include: getPublicArticleInclude(),
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
      });
    }

    return res.json({
      article,
    });
  } catch (error) {
    console.error("Erro ao buscar artigo:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigo.",
    });
  }
});

app.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            articles: {
              where: {
                status: "PUBLISHED",
              },
            },
          },
        },
      },
    });

    return res.json({
      categories,
    });
  } catch (error) {
    console.error("Erro ao buscar categorias:", error);

    return res.status(500).json({
      error: "Erro ao buscar categorias.",
    });
  }
});

app.get("/categories/:slug/articles", async (req, res) => {
  try {
    const { slug } = req.params;
    const { page, limit, skip } = getPaginationParams(req);

    const category = await prisma.category.findUnique({
      where: {
        slug,
      },
    });

    if (!category) {
      return res.status(404).json({
        error: "Categoria não encontrada.",
      });
    }

    const where = {
      status: "PUBLISHED",
      categoryId: category.id,
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({
        where,
      }),
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            publishedAt: "desc",
          },
          {
            title: "asc",
          },
        ],
        include: getPublicArticleInclude(),
      }),
    ]);

    return res.json({
      category,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos da categoria:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigos da categoria.",
    });
  }
});

app.get("/tags", async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            articles: true,
          },
        },
      },
    });

    return res.json({
      tags,
    });
  } catch (error) {
    console.error("Erro ao buscar tags:", error);

    return res.status(500).json({
      error: "Erro ao buscar tags.",
    });
  }
});

app.get("/tags/:slug/articles", async (req, res) => {
  try {
    const { slug } = req.params;
    const { page, limit, skip } = getPaginationParams(req);

    const tag = await prisma.tag.findUnique({
      where: {
        slug,
      },
    });

    if (!tag) {
      return res.status(404).json({
        error: "Tag não encontrada.",
      });
    }

    const where = {
      status: "PUBLISHED",
      tags: {
        some: {
          tagId: tag.id,
        },
      },
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({
        where,
      }),
      prisma.article.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          {
            isFeatured: "desc",
          },
          {
            publishedAt: "desc",
          },
          {
            title: "asc",
          },
        ],
        include: getPublicArticleInclude(),
      }),
    ]);

    return res.json({
      tag,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos da tag:", error);

    return res.status(500).json({
      error: "Erro ao buscar artigos da tag.",
    });
  }
});

/* ============================= */
/* FALLBACK */
/* ============================= */

app.use((req, res) => {
  return res.status(404).json({
    error: "Rota não encontrada.",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});