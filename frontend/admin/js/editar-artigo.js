const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");

const articleEditForm = document.getElementById("articleEditForm");
const saveArticleButton = document.getElementById("saveArticleButton");

const editPageTitle = document.getElementById("editPageTitle");
const editPageDescription = document.getElementById("editPageDescription");

const articleTitle = document.getElementById("articleTitle");
const articleSlug = document.getElementById("articleSlug");
const articleCategory = document.getElementById("articleCategory");
const articleStatus = document.getElementById("articleStatus");
const articleProtected = document.getElementById("articleProtected");
const articleFeatured = document.getElementById("articleFeatured");
const articleUpdatedAt = document.getElementById("articleUpdatedAt");
const articleSummary = document.getElementById("articleSummary");
const articleContent = document.getElementById("articleContent");

const viewPublicArticleButton = document.getElementById("viewPublicArticleButton");
const articleEditMessage = document.getElementById("articleEditMessage");

let currentArticle = null;

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

function getJsonAuthHeaders() {
  return {
    ...getAuthHeaders(),
    "Content-Type": "application/json",
  };
}

function getArticleIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

async function requestAdmin(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
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

function getCategoryName(article) {
  return article.category?.name || "Sem categoria";
}

function getPublicArticleUrl(article) {
  return `${window.location.origin}/frontend/artigo.html?slug=${encodeURIComponent(article.slug)}`;
}

function setMessage(message, type = "") {
  articleEditMessage.textContent = message;
  articleEditMessage.className = "admin-edit-message";

  if (type) {
    articleEditMessage.classList.add(type);
  }
}

function setLoading(isLoading) {
  saveArticleButton.disabled = isLoading;
  saveArticleButton.textContent = isLoading ? "Salvando..." : "Salvar alterações";
}

function stringToBoolean(value) {
  return String(value) === "true";
}

function fillArticleForm(article) {
  currentArticle = article;

  editPageTitle.textContent = article.title || "Artigo sem título";

  editPageDescription.textContent =
    "Altere os dados do artigo e salve para atualizar a Central de Ajuda.";

  articleTitle.value = article.title || "";
  articleSlug.value = article.slug || "";
  articleCategory.value = getCategoryName(article);
  articleStatus.value = article.status || "DRAFT";
  articleProtected.value = String(Boolean(article.protected));
  articleFeatured.value = String(Boolean(article.isFeatured));
  articleUpdatedAt.value = formatDate(article.updatedAt || article.modifiedAt);
  articleSummary.value = article.summary || "";
  articleContent.value = article.contentHtml || "";

  if (article.status === "PUBLISHED" && article.slug) {
    viewPublicArticleButton.href = getPublicArticleUrl(article);
    viewPublicArticleButton.style.display = "inline-flex";
  } else {
    viewPublicArticleButton.href = "#";
    viewPublicArticleButton.style.display = "none";
  }

  setMessage("Artigo carregado. Faça as alterações necessárias e clique em salvar.", "info");
}

function getPayloadFromForm() {
  return {
    title: articleTitle.value.trim(),
    slug: articleSlug.value.trim(),
    summary: articleSummary.value.trim(),
    contentHtml: articleContent.value.trim(),
    status: articleStatus.value,
    protected: stringToBoolean(articleProtected.value),
    isFeatured: stringToBoolean(articleFeatured.value),
  };
}

function validatePayload(payload) {
  if (!payload.title) {
    throw new Error("Informe o título do artigo.");
  }

  if (!payload.slug) {
    throw new Error("Informe o slug do artigo.");
  }

  if (!payload.contentHtml) {
    throw new Error("Informe o conteúdo HTML do artigo.");
  }

  const allowedStatus = ["PUBLISHED", "DRAFT", "ARCHIVED"];

  if (!allowedStatus.includes(payload.status)) {
    throw new Error("Status inválido.");
  }
}

async function loadArticle() {
  const articleId = getArticleIdFromUrl();

  if (!articleId) {
    throw new Error("ID do artigo não informado na URL.");
  }

  setMessage("Carregando dados do artigo...");

  const data = await requestAdmin(`/admin/articles/${encodeURIComponent(articleId)}`);

  if (!data) {
    return;
  }

  fillArticleForm(data.article);
}

async function saveArticle() {
  const articleId = getArticleIdFromUrl();

  if (!articleId) {
    throw new Error("ID do artigo não informado na URL.");
  }

  const payload = getPayloadFromForm();

  validatePayload(payload);

  setLoading(true);
  setMessage("Salvando alterações...");

  const response = await fetch(`${API_URL}/admin/articles/${encodeURIComponent(articleId)}`, {
    method: "PUT",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (response.status === 401 || response.status === 403) {
    clearSession();
    redirectToLogin();
    return;
  }

  if (!response.ok) {
    throw new Error(data.error || "Erro ao salvar alterações.");
  }

  fillArticleForm(data.article);

  setMessage("Artigo atualizado com sucesso.", "success");
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);

  articleEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await saveArticle();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  });
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
    setMessage(error.message, "error");
  }
}

initEditPage();