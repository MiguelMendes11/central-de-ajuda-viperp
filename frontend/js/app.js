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

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function removeHtmlTags(html) {
  return String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createArticleSummary(article) {
  if (article.summary) {
    return article.summary;
  }

  if (article.title) {
    return "Acesse este artigo para consultar o passo a passo completo.";
  }

  return "Conteúdo disponível na Central de Ajuda VipERP.";
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

function renderArticles(articles) {
  articlesGrid.innerHTML = "";

  if (!articles || articles.length === 0) {
    articlesStatus.textContent = "Nenhum artigo encontrado para essa busca.";
    return;
  }

  articlesStatus.textContent = `${articles.length} artigo(s) encontrado(s).`;

  const cards = articles.map((article) => {
    const categoryName = article.category?.name || "Artigo";
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
  });

  articlesGrid.innerHTML = cards.join("");
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

    if (category) {
      params.set("category", category);
    }

    const url = `${API_URL}/articles${params.toString() ? `?${params.toString()}` : ""}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Erro ao carregar artigos.");
    }

    const data = await response.json();

    renderArticles(data.articles || []);
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
    ? "Veja os conteúdos encontrados para a sua pesquisa."
    : "Consulte os conteúdos da Central de Ajuda VipERP.";

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
      ? "Veja os conteúdos encontrados para a sua pesquisa."
      : "Consulte os conteúdos da Central de Ajuda VipERP.";

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

    const categoryName = button.querySelector("strong")?.textContent || "Artigos";

    articlesTitle.textContent = category
      ? `Categoria: ${categoryName}`
      : "Artigos disponíveis";

    articlesSubtitle.textContent = category
      ? "Veja os artigos disponíveis nesta categoria."
      : "Consulte os conteúdos da Central de Ajuda VipERP.";

    loadArticles({
      search: searchInput.value.trim(),
      category: currentCategory,
    });

    scrollToResults();
  });
});

loadArticles();