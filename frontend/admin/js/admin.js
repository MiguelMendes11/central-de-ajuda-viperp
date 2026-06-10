const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");
const adminSearchInput = document.getElementById("adminSearchInput");
const statusFilter = document.getElementById("statusFilter");
const protectedFilter = document.getElementById("protectedFilter");

const statTotal = document.getElementById("statTotal");
const statPublished = document.getElementById("statPublished");
const statDraft = document.getElementById("statDraft");
const statArchived = document.getElementById("statArchived");

const adminArticlesStatus = document.getElementById("adminArticlesStatus");
const adminArticlesTableBody = document.getElementById("adminArticlesTableBody");

const deleteArticleModal = document.getElementById("deleteArticleModal");
const deleteArticleTitle = document.getElementById("deleteArticleTitle");
const deleteArticleSlug = document.getElementById("deleteArticleSlug");
const closeDeleteModalButton = document.getElementById("closeDeleteModalButton");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");

let allArticles = [];
let filteredArticles = [];
let articleToDelete = null;

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

function encodeUrlValue(value) {
  return encodeURIComponent(String(value || ""));
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

function getCategoryName(article) {
  if (!article.category) {
    return "Sem categoria";
  }

  return article.category.name || "Sem categoria";
}

function getStatusLabel(status) {
  const labels = {
    PUBLISHED: "Publicado",
    DRAFT: "Rascunho",
    ARCHIVED: "Arquivado",
  };

  return labels[status] || status || "-";
}

function getStatusClass(status) {
  const classes = {
    PUBLISHED: "published",
    DRAFT: "draft",
    ARCHIVED: "archived",
  };

  return classes[status] || "archived";
}

function getProtectedLabel(article) {
  return article.protected ? "Sim" : "Não";
}

function getProtectedClass(article) {
  return article.protected ? "protected" : "public";
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getPublicArticleUrl(article) {
  const slug = encodeUrlValue(article.slug);
  return `${window.location.origin}/frontend/artigo.html?slug=${slug}`;
}

function getEditArticleUrl(article) {
  const id = encodeUrlValue(article.id);
  return `./editar-artigo.html?id=${id}`;
}

function articleCanBeViewedPublicly(article) {
  return article.status === "PUBLISHED" && Boolean(article.slug);
}

function renderPublicArticleButton(article) {
  if (articleCanBeViewedPublicly(article)) {
    return `
      <a
        href="${getPublicArticleUrl(article)}"
        target="_blank"
        rel="noopener noreferrer"
        class="admin-action-btn view"
        title="Visualizar artigo público"
      >
        Ver
      </a>
    `;
  }

  return `
    <span
      class="admin-action-btn unavailable"
      title="Este artigo não está publicado ou não possui slug"
    >
      Indisponível
    </span>
  `;
}

function renderArticlesStatus() {
  const total = filteredArticles.length;

  if (!allArticles.length) {
    adminArticlesStatus.textContent = "Nenhum artigo encontrado.";
    return;
  }

  if (total === allArticles.length) {
    adminArticlesStatus.textContent = `${total} artigo(s) carregado(s).`;
    return;
  }

  adminArticlesStatus.textContent = `${total} artigo(s) encontrado(s) no filtro.`;
}

function updateStats() {
  const total = allArticles.length;
  const published = allArticles.filter((article) => article.status === "PUBLISHED").length;
  const draft = allArticles.filter((article) => article.status === "DRAFT").length;
  const archived = allArticles.filter((article) => article.status === "ARCHIVED").length;

  statTotal.textContent = total;
  statPublished.textContent = published;
  statDraft.textContent = draft;
  statArchived.textContent = archived;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function articleMatchesSearch(article, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const normalizedSearch = normalizeText(searchTerm);

  const searchableContent = [
    article.title,
    article.slug,
    article.summary,
    article.contentHtml,
    getCategoryName(article),
  ]
    .map(normalizeText)
    .join(" ");

  return searchableContent.includes(normalizedSearch);
}

function articleMatchesStatus(article, selectedStatus) {
  if (!selectedStatus) {
    return true;
  }

  return article.status === selectedStatus;
}

function articleMatchesProtected(article, selectedProtected) {
  if (!selectedProtected) {
    return true;
  }

  return String(Boolean(article.protected)) === selectedProtected;
}

function applyFilters() {
  const searchTerm = adminSearchInput.value.trim();
  const selectedStatus = statusFilter.value;
  const selectedProtected = protectedFilter.value;

  filteredArticles = allArticles.filter((article) => {
    return (
      articleMatchesSearch(article, searchTerm) &&
      articleMatchesStatus(article, selectedStatus) &&
      articleMatchesProtected(article, selectedProtected)
    );
  });

  renderArticles();
}

function renderEmptyState() {
  adminArticlesTableBody.innerHTML = `
    <tr>
      <td colspan="8" class="admin-empty-cell">
        Nenhum artigo encontrado.
      </td>
    </tr>
  `;
}

function renderArticles() {
  renderArticlesStatus();

  if (!filteredArticles.length) {
    renderEmptyState();
    return;
  }

  const rows = filteredArticles
    .map((article) => {
      const videoCount = Number(article.videoCount || 0);
      const imageCount = Number(article.imageCount || 0);

      return `
        <tr data-article-id="${article.id}">
          <td>
            <div class="admin-article-title">
              <strong>${article.title || "Sem título"}</strong>
              <span>${article.slug || "sem-slug"}</span>
            </div>
          </td>

          <td>${getCategoryName(article)}</td>

          <td>
            <span class="admin-badge ${getStatusClass(article.status)}">
              ${getStatusLabel(article.status)}
            </span>
          </td>

          <td>
            <span class="admin-badge ${getProtectedClass(article)}">
              ${getProtectedLabel(article)}
            </span>
          </td>

          <td>${videoCount}</td>

          <td>${imageCount}</td>

          <td>${formatDate(article.updatedAt || article.modifiedAt)}</td>

          <td>
            <div class="admin-actions">
              ${renderPublicArticleButton(article)}

              <a
                href="${getEditArticleUrl(article)}"
                class="admin-action-btn edit"
                title="Editar artigo"
              >
                Editar
              </a>

              <button
                type="button"
                class="admin-action-btn delete"
                data-delete-article-id="${article.id}"
                title="Excluir artigo"
              >
                Excluir
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  adminArticlesTableBody.innerHTML = rows;
}

async function loadArticles() {
  adminArticlesStatus.textContent = "Carregando artigos...";

  const data = await requestAdmin("/admin/articles");

  if (!data) {
    return;
  }

  allArticles = Array.isArray(data.articles) ? data.articles : [];
  filteredArticles = [...allArticles];

  updateStats();
  applyFilters();
}

function getArticleById(articleId) {
  return allArticles.find((article) => article.id === articleId);
}

function openDeleteModal(article) {
  articleToDelete = article;

  deleteArticleTitle.textContent = article.title || "Sem título";
  deleteArticleSlug.textContent = article.slug || "sem-slug";

  deleteArticleModal.classList.remove("hidden");
  document.body.classList.add("admin-modal-open");
}

function closeDeleteModal() {
  articleToDelete = null;
  deleteArticleModal.classList.add("hidden");
  document.body.classList.remove("admin-modal-open");
}

async function confirmDeleteArticle() {
  if (!articleToDelete) {
    return;
  }

  try {
    confirmDeleteButton.disabled = true;
    confirmDeleteButton.textContent = "Excluindo...";
    adminArticlesStatus.textContent = "Excluindo artigo...";

    const response = await fetch(`${API_URL}/admin/articles/${encodeUrlValue(articleToDelete.id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (response.status === 401 || response.status === 403) {
      clearSession();
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(data.error || "Erro ao excluir artigo.");
    }

    allArticles = allArticles.filter((item) => item.id !== articleToDelete.id);
    filteredArticles = filteredArticles.filter((item) => item.id !== articleToDelete.id);

    updateStats();
    applyFilters();
    closeDeleteModal();

    adminArticlesStatus.textContent = "Artigo excluído com sucesso.";
  } catch (error) {
    adminArticlesStatus.textContent = error.message;
    alert(error.message);
  } finally {
    confirmDeleteButton.disabled = false;
    confirmDeleteButton.textContent = "Excluir artigo";
  }
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);

  adminSearchInput.addEventListener("input", applyFilters);
  statusFilter.addEventListener("change", applyFilters);
  protectedFilter.addEventListener("change", applyFilters);

  adminArticlesTableBody.addEventListener("click", async (event) => {
    const deleteButton = event.target.closest("[data-delete-article-id]");

    if (!deleteButton) {
      return;
    }

    const articleId = deleteButton.getAttribute("data-delete-article-id");

    if (!articleId) {
      return;
    }

    const article = getArticleById(articleId);

    if (!article) {
      alert("Artigo não encontrado na listagem.");
      return;
    }

    openDeleteModal(article);
  });

  closeDeleteModalButton.addEventListener("click", closeDeleteModal);
  cancelDeleteButton.addEventListener("click", closeDeleteModal);
  confirmDeleteButton.addEventListener("click", confirmDeleteArticle);

  deleteArticleModal.addEventListener("click", (event) => {
    if (event.target === deleteArticleModal) {
      closeDeleteModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !deleteArticleModal.classList.contains("hidden")) {
      closeDeleteModal();
    }
  });
}

async function initAdminPage() {
  try {
    setupEvents();

    const isSessionValid = await validateSession();

    if (!isSessionValid) {
      return;
    }

    await loadArticles();
  } catch (error) {
    adminArticlesStatus.textContent = error.message;
  }
}

initAdminPage();