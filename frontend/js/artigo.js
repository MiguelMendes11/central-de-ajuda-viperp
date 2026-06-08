const API_URL = "http://localhost:3001";

const articleStatus = document.getElementById("articleStatus");
const articleContainer = document.getElementById("articleContainer");
const articleMeta = document.getElementById("articleMeta");
const articleTitle = document.getElementById("articleTitle");
const articleInfo = document.getElementById("articleInfo");
const articleContent = document.getElementById("articleContent");

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function formatDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR");
}

function renderMeta(article) {
  const categoryName = article.category?.name || "Artigo";

  const tags = Array.isArray(article.tags)
    ? article.tags
        .map((item) => item.tag)
        .filter(Boolean)
        .slice(0, 4)
    : [];

  const tagsHtml = tags
    .map((tag) => `<span class="article-tag">${escapeHtml(tag.name)}</span>`)
    .join("");

  articleMeta.innerHTML = `
    <span class="article-category">${escapeHtml(categoryName)}</span>
    ${tagsHtml}
  `;
}

function renderInfo(article) {
  const publishedAt = formatDate(article.publishedAt);
  const modifiedAt = formatDate(article.modifiedAt);

  const details = [];

  if (publishedAt) {
    details.push(`Publicado em ${publishedAt}`);
  }

  if (modifiedAt) {
    details.push(`Atualizado em ${modifiedAt}`);
  }

  if (article.videoCount > 0) {
    details.push(`${article.videoCount} vídeo(s)`);
  }

  if (article.imageCount > 0) {
    details.push(`${article.imageCount} imagem(ns)`);
  }

  articleInfo.textContent = details.length
    ? details.join(" • ")
    : "Conteúdo da Central de Ajuda VipERP";
}

function fixContentLinks() {
  const links = articleContent.querySelectorAll("a");

  links.forEach((link) => {
    const href = link.getAttribute("href");

    if (!href) return;

    if (href.startsWith("http")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
}

function fixImages() {
  const images = articleContent.querySelectorAll("img");

  images.forEach((img) => {
    img.setAttribute("loading", "lazy");

    const src = img.getAttribute("src");

    if (!src) return;

    if (src.startsWith("file:///")) {
      img.setAttribute("alt", img.getAttribute("alt") || "Imagem não disponível");
      img.insertAdjacentHTML(
        "afterend",
        '<p class="error-box">Esta imagem ainda está apontando para um caminho local do computador e precisa ser ajustada para /uploads.</p>'
      );
    }
  });
}

async function loadArticle() {
  const slug = getSlugFromUrl();

  if (!slug) {
    articleStatus.className = "error-box";
    articleStatus.textContent = "Slug do artigo não informado.";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/articles/${encodeURIComponent(slug)}`);

    if (!response.ok) {
      throw new Error("Artigo não encontrado.");
    }

    const article = await response.json();

    document.title = `${article.title} | Central de Ajuda VipERP`;

    renderMeta(article);

    articleTitle.textContent = article.title;
    renderInfo(article);

    articleContent.innerHTML = article.contentHtml || "<p>Conteúdo não disponível.</p>";

    fixContentLinks();
    fixImages();

    articleStatus.style.display = "none";
    articleContainer.style.display = "block";
  } catch (error) {
    console.error(error);

    articleStatus.className = "error-box";
    articleStatus.innerHTML = `
      Não foi possível carregar este artigo.
      <br />
      Verifique se a API está rodando e se o slug está correto.
    `;
  }
}

loadArticle();