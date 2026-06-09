const API_URL = "http://localhost:3001";

const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const articlesGrid = document.getElementById("articlesGrid");
const articlesStatus = document.getElementById("articlesStatus");
const articlesTitle = document.getElementById("articlesTitle");
const articlesSubtitle = document.getElementById("articlesSubtitle");
const categoryButtons = document.querySelectorAll(".category-card");

let searchTimeout = null;
let currentCategory = "";

const CATEGORY_LABELS = {
  gestao: "Gestão",
  pdv: "PDV",
  comanda: "Comanda",
  outros: "Outros",
  "videos-tutoriais": "Vídeos Tutoriais",
  "notas-de-versao": "Notas de Versão",
};

const CATEGORY_DESCRIPTIONS = {
  gestao:
    "Conteúdos relacionados aos módulos de gestão, financeiro, estoque e processos operacionais.",
  pdv:
    "Materiais sobre frente de caixa, vendas, atendimento e rotinas do ponto de venda.",
  comanda:
    "Guias sobre o uso de comandas, consumo, controle de mesas e operação relacionada.",
  outros:
    "Artigos gerais, configurações diversas e orientações complementares do sistema.",
  "videos-tutoriais":
    "Conteúdos em vídeo e materiais passo a passo para facilitar o aprendizado.",
  "notas-de-versao":
    "Atualizações, melhorias e novidades publicadas nas versões do VipERP.",
};

const CATEGORY_ORDER = [
  "gestao",
  "pdv",
  "comanda",
  "outros",
  "videos-tutoriais",
  "notas-de-versao",
];

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createArticleSummary(article) {
  if (article.summary) {
    return article.summary;
  }

  return "Acesse este artigo para consultar o passo a passo completo.";
}

function formatTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .map((item) => item.tag)
    .filter(Boolean)
    .slice(0, 2);
}

function getArticleCategoryName(article) {
  return normalizeText(article.category?.name || "");
}

function getArticleCategorySlug(article) {
  return slugify(article.category?.slug || "");
}

function getArticleTitleAndSlug(article) {
  return slugify(
    [
      article.title || "",
      article.slug || "",
      article.originalSlug || "",
    ].join(" ")
  );
}

function getArticleFullText(article) {
  const tags = Array.isArray(article.tags)
    ? article.tags.map((item) => item.tag?.name || "").join(" ")
    : "";

  return normalizeText(
    [
      article.category?.name || "",
      article.category?.slug || "",
      article.title || "",
      article.slug || "",
      article.originalSlug || "",
      tags,
    ].join(" ")
  );
}

function getArticleFullSlug(article) {
  const tags = Array.isArray(article.tags)
    ? article.tags.map((item) => item.tag?.name || "").join(" ")
    : "";

  return slugify(
    [
      article.category?.name || "",
      article.category?.slug || "",
      article.title || "",
      article.slug || "",
      article.originalSlug || "",
      tags,
    ].join(" ")
  );
}

function isReleaseNoteArticle(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);
  const titleSlug = getArticleTitleAndSlug(article);

  return (
    categoryName.includes("nota de versao") ||
    categoryName.includes("notas de versao") ||
    categorySlug.includes("nota-de-versao") ||
    categorySlug.includes("notas-de-versao") ||
    titleSlug.includes("nota-de-versao") ||
    titleSlug.includes("notas-de-versao")
  );
}

function isOriginalVideoTutorialCategory(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);

  return (
    categoryName.includes("videos tutoriais") ||
    categoryName.includes("video tutorial") ||
    categoryName.includes("tutoriais em video") ||
    categoryName.includes("tutorial em video") ||
    categorySlug.includes("videos-tutoriais") ||
    categorySlug.includes("video-tutorial") ||
    categorySlug.includes("tutoriais-em-video") ||
    categorySlug.includes("tutorial-em-video")
  );
}

function isGestaoArticle(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);

  return (
    categoryName.includes("gestao") ||
    categoryName.includes("gestão") ||
    categorySlug.includes("gestao")
  );
}

function isPdvArticle(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);

  return (
    categoryName.includes("pdv") ||
    categorySlug.includes("pdv")
  );
}

function isComandaArticle(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);

  return (
    categoryName.includes("comanda") ||
    categoryName.includes("comandas") ||
    categorySlug.includes("comanda") ||
    categorySlug.includes("comandas")
  );
}

function isOutrosArticle(article) {
  const categoryName = getArticleCategoryName(article);
  const categorySlug = getArticleCategorySlug(article);

  return (
    categoryName.includes("outros") ||
    categoryName.includes("geral") ||
    categorySlug.includes("outros") ||
    categorySlug.includes("geral")
  );
}

function isVideoInsideOutros(article) {
  const fullText = getArticleFullText(article);
  const fullSlug = getArticleFullSlug(article);

  return (
    Number(article.videoCount || 0) > 0 ||
    fullText.includes("video") ||
    fullText.includes("videos") ||
    fullText.includes("tutorial em video") ||
    fullText.includes("tutoriais em video") ||
    fullText.includes("video tutorial") ||
    fullText.includes("videos tutoriais") ||
    fullSlug.includes("video") ||
    fullSlug.includes("videos") ||
    fullSlug.includes("tutorial-em-video") ||
    fullSlug.includes("tutoriais-em-video") ||
    fullSlug.includes("video-tutorial") ||
    fullSlug.includes("videos-tutoriais")
  );
}

function getArticleCategoryKey(article) {
  /*
    Regra principal:
    Não mexer em Gestão, PDV, Comanda e Notas de Versão.

    A movimentação para Vídeos Tutoriais só acontece em dois casos:
    1. A categoria original já é Vídeos Tutoriais.
    2. O artigo cairia em Outros, mas possui vídeo ou indicação de vídeo/tutorial.
  */

  if (isReleaseNoteArticle(article)) {
    return "notas-de-versao";
  }

  if (isOriginalVideoTutorialCategory(article)) {
    return "videos-tutoriais";
  }

  if (isComandaArticle(article)) {
    return "comanda";
  }

  if (isPdvArticle(article)) {
    return "pdv";
  }

  if (isGestaoArticle(article)) {
    return "gestao";
  }

  if (isOutrosArticle(article)) {
    if (isVideoInsideOutros(article)) {
      return "videos-tutoriais";
    }

    return "outros";
  }

  if (isVideoInsideOutros(article)) {
    return "videos-tutoriais";
  }

  return "outros";
}

function articleMatchesSelectedCategory(article, selectedCategory) {
  if (!selectedCategory) {
    return true;
  }

  return getArticleCategoryKey(article) === selectedCategory;
}

function getCategoryOrder(categoryKey) {
  const index = CATEGORY_ORDER.indexOf(categoryKey);

  return index === -1 ? 99 : index;
}

function groupArticlesByCategory(articles) {
  const grouped = {};

  articles.forEach((article) => {
    const categoryKey = getArticleCategoryKey(article);

    if (!grouped[categoryKey]) {
      grouped[categoryKey] = [];
    }

    grouped[categoryKey].push(article);
  });

  return Object.entries(grouped).sort(([categoryA], [categoryB]) => {
    const orderA = getCategoryOrder(categoryA);
    const orderB = getCategoryOrder(categoryB);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return CATEGORY_LABELS[categoryA].localeCompare(CATEGORY_LABELS[categoryB]);
  });
}

function createArticleCard(article) {
  const categoryKey = getArticleCategoryKey(article);
  const categoryName =
    CATEGORY_LABELS[categoryKey] || article.category?.name || "Artigo";

  const tags = formatTags(article.tags);
  const summary = createArticleSummary(article);

  const tagsHtml = tags
    .map((tag) => `<span class="article-tag">${escapeHtml(tag.name)}</span>`)
    .join("");

  return `
    <article class="article-card">
      <div class="article-meta">
        <span class="article-category">${escapeHtml(categoryName)}</span>
        ${tagsHtml}
      </div>

      <h3>${escapeHtml(article.title)}</h3>

      <p>${escapeHtml(summary)}</p>

      <a class="article-link" href="./artigo.html?slug=${encodeURIComponent(article.slug)}">
        Ver artigo
        <span>→</span>
      </a>
    </article>
  `;
}

function renderArticles(articles) {
  articlesGrid.innerHTML = "";

  if (!articles || articles.length === 0) {
    articlesStatus.textContent = "Nenhum artigo encontrado para essa busca.";
    return;
  }

  articlesStatus.textContent = `${articles.length} artigo(s) encontrado(s).`;

  const groupedArticles = groupArticlesByCategory(articles);

  const sectionsHtml = groupedArticles
    .map(([categoryKey, categoryArticles]) => {
      const categoryName = CATEGORY_LABELS[categoryKey] || "Outros";
      const categoryDescription =
        CATEGORY_DESCRIPTIONS[categoryKey] ||
        "Conteúdos disponíveis nesta categoria.";

      const cardsHtml = categoryArticles.map(createArticleCard).join("");

      return `
        <section class="article-topic-group">
          <div class="topic-header">
            <div class="topic-title-row">
              <span class="topic-marker"></span>
              <div>
                <h3>${escapeHtml(categoryName)}</h3>
                <p>${escapeHtml(categoryDescription)}</p>
              </div>
            </div>

            <span class="topic-count">${categoryArticles.length} artigo(s)</span>
          </div>

          <div class="topic-articles-grid">
            ${cardsHtml}
          </div>
        </section>
      `;
    })
    .join("");

  articlesGrid.innerHTML = sectionsHtml;
}

async function loadArticles(options = {}) {
  const search = options.search || "";
  const category = options.category || "";

  articlesStatus.textContent = "Carregando artigos...";
  articlesGrid.innerHTML = "";

  try {
    const params = new URLSearchParams();

    if (search) {
      params.set("search", search);
    }

    const url = `${API_URL}/articles${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Erro ao carregar artigos.");
    }

    const data = await response.json();

    const articles = data.articles || [];

    const filteredArticles = articles.filter((article) =>
      articleMatchesSelectedCategory(article, category)
    );

    renderArticles(filteredArticles);
  } catch (error) {
    console.error(error);

    articlesStatus.textContent = "";
    articlesGrid.innerHTML = `
      <div class="error-box">
        Não foi possível carregar os artigos. Verifique se a API está rodando em http://localhost:3001.
      </div>
    `;
  }
}

function setActiveCategory(selectedButton) {
  categoryButtons.forEach((button) => {
    button.classList.remove("active");
  });

  if (selectedButton) {
    selectedButton.classList.add("active");
  }
}

function scrollToResults() {
  const resultsSection = document.getElementById("resultados");

  if (resultsSection) {
    resultsSection.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const search = searchInput.value.trim();

  articlesTitle.textContent = search
    ? `Resultados para "${search}"`
    : "Artigos disponíveis";

  articlesSubtitle.textContent = search
    ? "Veja os conteúdos encontrados para a sua pesquisa, organizados por área."
    : "Consulte os conteúdos da Central de Ajuda VipERP separados por área.";

  loadArticles({
    search,
    category: currentCategory,
  });

  scrollToResults();
});

searchInput.addEventListener("input", () => {
  const search = searchInput.value.trim();

  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    articlesTitle.textContent = search
      ? `Resultados para "${search}"`
      : "Artigos disponíveis";

    articlesSubtitle.textContent = search
      ? "Veja os conteúdos encontrados para a sua pesquisa, organizados por área."
      : "Consulte os conteúdos da Central de Ajuda VipERP separados por área.";

    loadArticles({
      search,
      category: currentCategory,
    });
  }, 350);
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const category = button.dataset.category || "";

    currentCategory = category;

    setActiveCategory(button);

    const categoryName =
      button.querySelector("strong")?.textContent || "Artigos";

    articlesTitle.textContent = category
      ? `Categoria: ${categoryName}`
      : "Artigos disponíveis";

    articlesSubtitle.textContent = category
      ? "Veja os artigos disponíveis nesta área da Central de Ajuda."
      : "Consulte os conteúdos da Central de Ajuda VipERP separados por área.";

    loadArticles({
      search: searchInput.value.trim(),
      category: currentCategory,
    });

    scrollToResults();
  });
});

loadArticles();