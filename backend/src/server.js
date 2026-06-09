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

app.use(cors());
app.use(express.json());

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    }
  );
}

function authenticateAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token não informado.",
      });
    }

    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      return res.status(401).json({
        error: "Formato do token inválido.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || decoded.role !== "ADMIN") {
      return res.status(403).json({
        error: "Acesso negado.",
      });
    }

    req.user = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Token inválido ou expirado.",
    });
  }
}

app.get("/", (req, res) => {
  res.json({
    message: "API da Central de Ajuda VipERP funcionando.",
    status: "online",
  });
});

/**
 * Login administrativo.
 * POST /admin/login
 */
app.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Informe email e senha.",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: String(email).trim().toLowerCase(),
      },
    });

    if (!user) {
      return res.status(401).json({
        error: "Email ou senha inválidos.",
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordIsValid) {
      return res.status(401).json({
        error: "Email ou senha inválidos.",
      });
    }

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        error: "Usuário sem permissão administrativa.",
      });
    }

    const token = generateToken(user);

    res.json({
      message: "Login realizado com sucesso.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro ao realizar login:", error);

    res.status(500).json({
      error: "Erro ao realizar login.",
    });
  }
});

/**
 * Dados do usuário logado.
 * GET /admin/me
 */
app.get("/admin/me", authenticateAdmin, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: "Usuário não encontrado.",
      });
    }

    res.json({
      user,
    });
  } catch (error) {
    console.error("Erro ao buscar usuário logado:", error);

    res.status(500).json({
      error: "Erro ao buscar usuário logado.",
    });
  }
});

/**
 * Lista administrativa de artigos.
 * Mostra publicados, rascunhos, arquivados e protegidos.
 * GET /admin/articles
 */
app.get("/admin/articles", authenticateAdmin, async (req, res) => {
  try {
    const { search, status, protected: protectedFilter, category } = req.query;

    const where = {};

    if (search) {
      where.OR = [
        {
          title: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          contentHtml: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          summary: {
            contains: String(search),
            mode: "insensitive",
          },
        },
      ];
    }

    if (status && ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(String(status))) {
      where.status = String(status);
    }

    if (protectedFilter === "true") {
      where.protected = true;
    }

    if (protectedFilter === "false") {
      where.protected = false;
    }

    if (category) {
      where.category = {
        slug: String(category),
      };
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        id: true,
        oldId: true,
        title: true,
        slug: true,
        originalSlug: true,
        summary: true,
        originalUrl: true,
        futureUrl: true,
        author: true,
        wpStatus: true,
        status: true,
        protected: true,
        imageCount: true,
        localImageCount: true,
        missingImageCount: true,
        videoCount: true,
        publishedAt: true,
        modifiedAt: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    res.json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao listar artigos administrativos:", error);

    res.status(500).json({
      error: "Erro ao listar artigos administrativos.",
    });
  }
});

/**
 * Estatísticas gerais
 */
app.get("/stats", async (req, res) => {
  try {
    const [
      articles,
      categories,
      tags,
      publishedArticles,
      draftArticles,
      archivedArticles,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.category.count(),
      prisma.tag.count(),
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
    ]);

    res.json({
      articles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      categories,
      tags,
    });
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);

    res.status(500).json({
      error: "Erro ao buscar estatísticas.",
    });
  }
});

/**
 * Rota de debug para conferir título, slug e status dos artigos.
 * Útil durante o desenvolvimento.
 */
app.get("/debug/slugs", async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: {
        title: "asc",
      },
      select: {
        title: true,
        slug: true,
        status: true,
        oldId: true,
        originalSlug: true,
        originalUrl: true,
        futureUrl: true,
      },
    });

    res.json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao listar slugs:", error);

    res.status(500).json({
      error: "Erro ao listar slugs.",
    });
  }
});

/**
 * Lista artigos publicados.
 * Permite filtros:
 * /articles?search=impressora
 * /articles?category=fiscal
 * /articles?tag=nf-e
 */
app.get("/articles", async (req, res) => {
  try {
    const { search, category, tag, includeAll } = req.query;

    const where = {};

    if (includeAll !== "true") {
      where.status = "PUBLISHED";
    }

    if (search) {
      where.OR = [
        {
          title: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          contentHtml: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          summary: {
            contains: String(search),
            mode: "insensitive",
          },
        },
        {
          slug: {
            contains: String(search),
            mode: "insensitive",
          },
        },
      ];
    }

    if (category) {
      where.category = {
        slug: String(category),
      };
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            slug: String(tag),
          },
        },
      };
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        oldId: true,
        title: true,
        slug: true,
        originalSlug: true,
        summary: true,
        originalUrl: true,
        futureUrl: true,
        author: true,
        wpStatus: true,
        status: true,
        protected: true,
        imageCount: true,
        localImageCount: true,
        missingImageCount: true,
        videoCount: true,
        publishedAt: true,
        modifiedAt: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    res.json({
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao listar artigos:", error);

    res.status(500).json({
      error: "Erro ao listar artigos.",
    });
  }
});

/**
 * Busca simples.
 * Exemplo:
 * /search?q=impressora
 */
app.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || String(q).trim() === "") {
      return res.status(400).json({
        error: "Informe um termo de busca usando ?q=termo",
      });
    }

    const termo = String(q).trim();

    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          {
            title: {
              contains: termo,
              mode: "insensitive",
            },
          },
          {
            slug: {
              contains: termo,
              mode: "insensitive",
            },
          },
          {
            contentHtml: {
              contains: termo,
              mode: "insensitive",
            },
          },
          {
            summary: {
              contains: termo,
              mode: "insensitive",
            },
          },
        ],
      },
      orderBy: {
        title: "asc",
      },
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        status: true,
        imageCount: true,
        videoCount: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    res.json({
      search: termo,
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao pesquisar artigos:", error);

    res.status(500).json({
      error: "Erro ao pesquisar artigos.",
    });
  }
});

/**
 * Abre um artigo pelo slug.
 * Exemplo:
 * /articles/como-corrigir-o-erro-0x00000709
 */
app.get("/articles/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await prisma.article.findUnique({
      where: {
        slug,
      },
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!article) {
      return res.status(404).json({
        error: "Artigo não encontrado.",
        slugRecebido: slug,
        dica: "Acesse /debug/slugs para conferir o slug correto salvo no banco.",
      });
    }

    res.json(article);
  } catch (error) {
    console.error("Erro ao buscar artigo:", error);

    res.status(500).json({
      error: "Erro ao buscar artigo.",
    });
  }
});

/**
 * Lista categorias.
 */
app.get("/categories", async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
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

    res.json({
      total: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Erro ao listar categorias:", error);

    res.status(500).json({
      error: "Erro ao listar categorias.",
    });
  }
});

/**
 * Lista artigos de uma categoria.
 * Exemplo:
 * /categories/fiscal/articles
 */
app.get("/categories/:slug/articles", async (req, res) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: {
        slug,
      },
      include: {
        articles: {
          where: {
            status: "PUBLISHED",
          },
          orderBy: {
            title: "asc",
          },
          select: {
            id: true,
            title: true,
            slug: true,
            summary: true,
            status: true,
            imageCount: true,
            videoCount: true,
            publishedAt: true,
            modifiedAt: true,
          },
        },
      },
    });

    if (!category) {
      return res.status(404).json({
        error: "Categoria não encontrada.",
        slugRecebido: slug,
      });
    }

    res.json({
      category,
      total: category.articles.length,
      articles: category.articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos da categoria:", error);

    res.status(500).json({
      error: "Erro ao buscar artigos da categoria.",
    });
  }
});

/**
 * Lista tags.
 */
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

    res.json({
      total: tags.length,
      tags,
    });
  } catch (error) {
    console.error("Erro ao listar tags:", error);

    res.status(500).json({
      error: "Erro ao listar tags.",
    });
  }
});

/**
 * Lista artigos de uma tag.
 * Exemplo:
 * /tags/impressora/articles
 */
app.get("/tags/:slug/articles", async (req, res) => {
  try {
    const { slug } = req.params;

    const tag = await prisma.tag.findUnique({
      where: {
        slug,
      },
      include: {
        articles: {
          include: {
            article: {
              select: {
                id: true,
                title: true,
                slug: true,
                summary: true,
                status: true,
                imageCount: true,
                videoCount: true,
                publishedAt: true,
                modifiedAt: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!tag) {
      return res.status(404).json({
        error: "Tag não encontrada.",
        slugRecebido: slug,
      });
    }

    const articles = tag.articles
      .map((item) => item.article)
      .filter((article) => article.status === "PUBLISHED")
      .sort((a, b) => a.title.localeCompare(b.title));

    res.json({
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
      },
      total: articles.length,
      articles,
    });
  } catch (error) {
    console.error("Erro ao buscar artigos da tag:", error);

    res.status(500).json({
      error: "Erro ao buscar artigos da tag.",
    });
  }
});

/**
 * Rota não encontrada.
 */
app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada.",
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});