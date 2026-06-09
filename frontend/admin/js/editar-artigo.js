const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");

const editPageTitle = document.getElementById("editPageTitle");
const editPageDescription = document.getElementById("editPageDescription");

const articleTitle = document.getElementById("articleTitle");
const articleSlug = document.getElementById("articleSlug");
const articleCategory = document.getElementById("articleCategory");
const articleStatus = document.getElementById("articleStatus");
const articleProtected = document.getElementById("articleProtected");
const articleUpdatedAt = document.getElementById("articleUpdatedAt");
const articleSummary = document.getElementById("articleSummary");
const articleContent = document.getElementById("articleContent");

const viewPublicArticleButton = document.getElementById("viewPublicArticleButton");
const articleEditMessage = document.getElementById("articleEditMessage");

function getToken() {
  return localStorage.getItem("adminToken");
}

function clearSession() {
  localStorage.removeItem("adminToken");
  localStorage.removeItem("adminUser");
}

function redirectToLogin() {
  window.location.href = "./login.html";
}

function logout() {
  clearSession();
  redirectToLogin();
}

function getAuthHeaders() {
  const token = getToken();

  return {
    Authorization: `Bearer ${token}`,
  };
}

function getArticleIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function requestAdmin(endpoint) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: getAuthHeaders(),
  });

  const data = await response.json();

  if (response.status === 401 || response.status === 403) {
    clearSession();
    redirectToLogin();
    return null;
  }

  if (!response.ok) {
    throw new Error(data.error || "Erro ao carregar dados administrativos.");
  }

  return data;
}

async function validateSession() {
  const token = getToken();

  if (!token) {
    redirectToLogin();
    return false;
  }

  await requestAdmin("/admin/me");
  return true;
}

function formatDate(dateValue) {
  if (!dateValue) {
    return "-";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(status) {
  const statusMap = {
    PUBLISHED: "Publicado",
    DRAFT: "Rascunho",
    ARCHIVED: "Arquivado",
  };

  return statusMap[status] || status || "-";
}

function getProtectedLabel(value) {
  return value ? "Sim" : "Não";
}

function getCategoryName(article) {
  return article.category?.name || "Sem categoria";
}

function getPublicArticleUrl(article) {
  return `../artigo.html?slug=${encodeURIComponent(article.slug)}`;
}

function fillArticleForm(article) {
  editPageTitle.textContent = article.title || "Artigo sem título";

  editPageDescription.textContent =
    "Dados carregados com sucesso. A edição será liberada na próxima etapa.";

  articleTitle.value = article.title || "";
  articleSlug.value = article.slug || "";
  articleCategory.value = getCategoryName(article);
  articleStatus.value = getStatusLabel(article.status);
  articleProtected.value = getProtectedLabel(article.protected);
  articleUpdatedAt.value = formatDate(article.updatedAt || article.modifiedAt);
  articleSummary.value = article.summary || "";
  articleContent.value = article.contentHtml || "";

  viewPublicArticleButton.href = getPublicArticleUrl(article);

  articleEditMessage.textContent =
    "Artigo carregado corretamente. Por enquanto, os campos estão bloqueados para edição.";
}

async function loadArticle() {
  const articleId = getArticleIdFromUrl();

  if (!articleId) {
    throw new Error("ID do artigo não informado na URL.");
  }

  articleEditMessage.textContent = "Carregando dados do artigo...";

  const data = await requestAdmin(`/admin/articles/${encodeURIComponent(articleId)}`);

  if (!data) {
    return;
  }

  fillArticleForm(data.article);
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);
}

async function initEditPage() {
  try {
    setupEvents();

    const isSessionValid = await validateSession();

    if (!isSessionValid) {
      return;
    }

    await loadArticle();
  } catch (error) {
    editPageTitle.textContent = "Erro ao carregar artigo";
    editPageDescription.textContent = "Não foi possível carregar os dados do artigo selecionado.";
    articleEditMessage.textContent = error.message;
  }
}

initEditPage();