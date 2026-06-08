require("dotenv").config();

const path = require("path");
const XLSX = require("xlsx");
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

const arquivo = path.join(__dirname, "..", "data", "artigos.xlsx");

function gerarSlug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function separarLista(valor) {
  if (!valor) return [];

  return String(valor)
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function converterBoolean(valor) {
  const texto = String(valor || "").toLowerCase().trim();

  return ["sim", "s", "true", "1", "yes"].includes(texto);
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return 0;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : 0;
}

function converterData(valor) {
  if (!valor) return null;

  if (valor instanceof Date && !isNaN(valor)) {
    return valor;
  }

  if (typeof valor === "number") {
    const dataExcel = XLSX.SSF.parse_date_code(valor);

    if (!dataExcel) return null;

    return new Date(
      dataExcel.y,
      dataExcel.m - 1,
      dataExcel.d,
      dataExcel.H || 0,
      dataExcel.M || 0,
      dataExcel.S || 0
    );
  }

  const data = new Date(valor);

  return isNaN(data) ? null : data;
}

function definirStatusArtigo(statusExcel) {
  const status = String(statusExcel || "").toLowerCase().trim();

  if (
    status.includes("draft") ||
    status.includes("rascunho") ||
    status.includes("pendente")
  ) {
    return "DRAFT";
  }

  if (
    status.includes("archive") ||
    status.includes("arquivado") ||
    status.includes("trash") ||
    status.includes("lixeira")
  ) {
    return "ARCHIVED";
  }

  return "PUBLISHED";
}

async function buscarOuCriarCategoria(nomeCategoria) {
  if (!nomeCategoria) return null;

  const nome = String(nomeCategoria).trim();
  const slug = gerarSlug(nome);

  if (!slug) return null;

  const categoria = await prisma.category.upsert({
    where: {
      slug,
    },
    update: {
      name: nome,
    },
    create: {
      name: nome,
      slug,
    },
  });

  return categoria;
}

async function buscarOuCriarTag(nomeTag) {
  if (!nomeTag) return null;

  const nome = String(nomeTag).trim();
  const slug = gerarSlug(nome);

  if (!slug) return null;

  const tag = await prisma.tag.upsert({
    where: {
      slug,
    },
    update: {
      name: nome,
    },
    create: {
      name: nome,
      slug,
    },
  });

  return tag;
}

async function importarArtigos() {
  console.log("Iniciando importação dos artigos...");
  console.log("Arquivo:", arquivo);

  const workbook = XLSX.readFile(arquivo, {
    cellDates: true,
  });

  const nomePrimeiraAba = workbook.SheetNames[0];
  const planilha = workbook.Sheets[nomePrimeiraAba];

  const linhas = XLSX.utils.sheet_to_json(planilha, {
    defval: "",
  });

  console.log("Aba encontrada:", nomePrimeiraAba);
  console.log("Total de linhas encontradas:", linhas.length);

  if (linhas.length === 0) {
    console.log("Nenhum artigo encontrado no Excel.");
    return;
  }

  let artigosCriados = 0;
  let artigosAtualizados = 0;
  let artigosIgnorados = 0;
  let categoriasCriadasOuAtualizadas = 0;
  let tagsCriadasOuAtualizadas = 0;

  for (const linha of linhas) {
    const titulo = String(linha["Título"] || "").trim();

    const slug = gerarSlug(
      linha["Slug"] ||
        linha["Slug Original"] ||
        linha["Título"] ||
        linha["ID"]
    );

    const conteudoHtmlNovo = String(linha["Conteúdo HTML Novo"] || "").trim();
    const conteudoHtmlOriginal = String(
      linha["Conteúdo HTML Original"] || ""
    ).trim();

    const contentHtml = conteudoHtmlNovo || conteudoHtmlOriginal;

    if (!titulo || !slug || !contentHtml) {
      console.log("Ignorado por falta de título, slug ou conteúdo:", {
        id: linha["ID"],
        titulo,
        slug,
      });

      artigosIgnorados++;
      continue;
    }

    const categorias = separarLista(linha["Categorias"]);
    const tags = separarLista(linha["Tags"]);

    let categoriaPrincipal = null;

    if (categorias.length > 0) {
      categoriaPrincipal = await buscarOuCriarCategoria(categorias[0]);
      categoriasCriadasOuAtualizadas++;
    }

    const dadosArtigo = {
      oldId: String(linha["ID"] || "").trim() || null,

      title: titulo,
      slug,
      originalSlug: String(linha["Slug Original"] || "").trim() || null,

      originalUrl: String(linha["URL Original"] || "").trim() || null,
      futureUrl: String(linha["URL Futura Sugerida"] || "").trim() || null,

      author: String(linha["Autor"] || "").trim() || null,
      wpStatus: String(linha["Status"] || "").trim() || null,
      protected: converterBoolean(linha["Protegido"]),

      publishedAt: converterData(linha["Data Publicação"]),
      modifiedAt: converterData(linha["Data Modificação"]),

      summary: null,
      contentHtml,
      originalHtml: conteudoHtmlOriginal || null,

      imageCount: converterNumero(linha["Qtd Imagens"]),
      localImageCount: converterNumero(
        linha["Qtd Imagens Encontradas Localmente"]
      ),
      missingImageCount: converterNumero(
        linha["Qtd Imagens Faltando Localmente"]
      ),

      originalImages: String(linha["Imagens Originais"] || "").trim() || null,
      newImages: String(linha["Imagens Novas"] || "").trim() || null,

      videoCount: converterNumero(linha["Qtd Vídeos"]),
      videos: String(linha["Vídeos"] || "").trim() || null,

      status: definirStatusArtigo(linha["Status"]),
      isFeatured: false,

      categoryId: categoriaPrincipal ? categoriaPrincipal.id : null,
    };

    const artigoExistente = await prisma.article.findUnique({
      where: {
        slug,
      },
    });

    let artigo;

    if (artigoExistente) {
      artigo = await prisma.article.update({
        where: {
          slug,
        },
        data: dadosArtigo,
      });

      await prisma.articleTag.deleteMany({
        where: {
          articleId: artigo.id,
        },
      });

      artigosAtualizados++;
    } else {
      artigo = await prisma.article.create({
        data: dadosArtigo,
      });

      artigosCriados++;
    }

    for (const nomeTag of tags) {
      const tag = await buscarOuCriarTag(nomeTag);

      if (!tag) continue;

      await prisma.articleTag.upsert({
        where: {
          articleId_tagId: {
            articleId: artigo.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          articleId: artigo.id,
          tagId: tag.id,
        },
      });

      tagsCriadasOuAtualizadas++;
    }

    console.log(`OK: ${titulo}`);
  }

  console.log("");
  console.log("Importação finalizada.");
  console.log("Artigos criados:", artigosCriados);
  console.log("Artigos atualizados:", artigosAtualizados);
  console.log("Artigos ignorados:", artigosIgnorados);
  console.log("Categorias processadas:", categoriasCriadasOuAtualizadas);
  console.log("Tags processadas:", tagsCriadasOuAtualizadas);
}

importarArtigos()
  .catch((error) => {
    console.error("");
    console.error("Erro durante a importação:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });