const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");
const backToArticlesButton = document.getElementById("backToArticlesButton");
const cancelCreateButton = document.getElementById("cancelCreateButton");

const articleCreateForm = document.getElementById("articleCreateForm");
const createArticleButton = document.getElementById("createArticleButton");

const articleTitle = document.getElementById("articleTitle");
const articleSlug = document.getElementById("articleSlug");
const articleStatus = document.getElementById("articleStatus");
const articleProtected = document.getElementById("articleProtected");
const articleFeatured = document.getElementById("articleFeatured");
const articleSummary = document.getElementById("articleSummary");
const articleContent = document.getElementById("articleContent");

const articleCreateMessage = document.getElementById("articleCreateMessage");

let hasUnsavedChanges = false;
let isSaving = false;

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

function goToArticlesList() {
  window.location.href = "./index.html";
}

function goToEditArticle(articleId) {
  window.location.href = `./editar-artigo.html?id=${encodeURIComponent(articleId)}`;
}

function logout() {
  if (!confirmLeaveWithUnsavedChanges()) {
    return;
  }

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

function setMessage(message, type = "info") {
  articleCreateMessage.textContent = message;
  articleCreateMessage.className = "admin-edit-message";

  if (type) {
    articleCreateMessage.classList.add(type);
  }
}

function setLoading(isLoading) {
  isSaving = isLoading;
  createArticleButton.disabled = isLoading;
  createArticleButton.textContent = isLoading ? "Criando..." : "Criar artigo";
}

function stringToBoolean(value) {
  return String(value) === "true";
}

function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
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

function hasFormContent() {
  const payload = getPayloadFromForm();

  return Boolean(
    payload.title ||
      payload.slug ||
      payload.summary ||
      payload.contentHtml ||
      payload.status !== "DRAFT" ||
      payload.protected ||
      payload.isFeatured
  );
}

function checkUnsavedChanges() {
  hasUnsavedChanges = hasFormContent();

  if (hasUnsavedChanges) {
    setMessage("Existem dados ainda não salvos neste novo artigo.", "info");
    document.title = "* Novo Artigo | Central de Ajuda VipERP";
    return;
  }

  document.title = "Novo Artigo | Central de Ajuda VipERP";
  setMessage("Preencha os dados do novo artigo. Por segurança, ele inicia como rascunho.", "info");
}

function confirmLeaveWithUnsavedChanges() {
  if (!hasUnsavedChanges) {
    return true;
  }

  return window.confirm(
    "Existem dados não salvos neste novo artigo. Deseja sair mesmo assim?"
  );
}

async function createArticle() {
  const payload = getPayloadFromForm();

  validatePayload(payload);

  setLoading(true);
  setMessage("Criando artigo...");

  const response = await fetch(`${API_URL}/admin/articles`, {
    method: "POST",
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
    throw new Error(data.error || "Erro ao criar artigo.");
  }

  hasUnsavedChanges = false;

  setMessage("Artigo criado com sucesso. Redirecionando para edição...", "success");

  setTimeout(() => {
    goToEditArticle(data.article.id);
  }, 700);
}

function setupAutoSlug() {
  articleTitle.addEventListener("input", () => {
    if (articleSlug.dataset.edited === "true") {
      checkUnsavedChanges();
      return;
    }

    articleSlug.value = slugify(articleTitle.value);
    checkUnsavedChanges();
  });

  articleSlug.addEventListener("input", () => {
    articleSlug.dataset.edited = "true";
    articleSlug.value = slugify(articleSlug.value);
    checkUnsavedChanges();
  });
}

function setupChangeDetection() {
  const fields = [
    articleStatus,
    articleProtected,
    articleFeatured,
    articleSummary,
    articleContent,
  ];

  fields.forEach((field) => {
    field.addEventListener("input", checkUnsavedChanges);
    field.addEventListener("change", checkUnsavedChanges);
  });
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);

  backToArticlesButton.addEventListener("click", (event) => {
    if (!confirmLeaveWithUnsavedChanges()) {
      event.preventDefault();
    }
  });

  cancelCreateButton.addEventListener("click", () => {
    if (!confirmLeaveWithUnsavedChanges()) {
      return;
    }

    goToArticlesList();
  });

  articleCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await createArticle();
    } catch (error) {
      setMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges || isSaving) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  setupAutoSlug();
  setupChangeDetection();
}

async function initCreatePage() {
  try {
    setupEvents();

    const isSessionValid = await validateSession();

    if (!isSessionValid) {
      return;
    }

    setMessage("Preencha os dados do novo artigo. Por segurança, ele inicia como rascunho.", "info");
  } catch (error) {
    setMessage(error.message, "error");
  }
}

initCreatePage();