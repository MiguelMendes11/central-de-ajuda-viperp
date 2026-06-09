const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");

const statTotal = document.getElementById("statTotal");
const statPublished = document.getElementById("statPublished");
const statDraft = document.getElementById("statDraft");
const statArchived = document.getElementById("statArchived");

const adminSearchInput = document.getElementById("adminSearchInput");
const statusFilter = document.getElementById("statusFilter");
const protectedFilter = document.getElementById("protectedFilter");

const adminArticlesStatus = document.getElementById("adminArticlesStatus");
const adminArticlesTableBody = document.getElementById("adminArticlesTableBody");

let allArticles = [];

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

function getStatusClass(status) {
  const statusMap = {
    PUBLISHED: "published",
    DRAFT: "draft",
    ARCHIVED: "archived",
  };

  return statusMap[status] || "default";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getArticleCategoryName(article) {
  return article.category?.name || "Sem categoria";
}

function getFilteredArticles() {
  const searchTerm = adminSearchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;
  const selectedProtected = protectedFilter.value;

  return allArticles.filter((article) => {
    const searchableText = [
      article.title,
      article.slug,
      article.summary,
      article.contentHtml,
      article.category?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch = !searchTerm || searchableText.includes(searchTerm);
    const matchesStatus = !selectedStatus || article.status === selectedStatus;

    const matchesProtected =
      selectedProtected === "" ||
      String(Boolean(article.protected)) === selectedProtected;

    return matchesSearch && matchesStatus && matchesProtected;
  });
}

function updateStats(articles) {
  const total = articles.length;
  const published = articles.filter((article) => article.status === "PUBLISHED").length;
  const draft = articles.filter((article) => article.status === "DRAFT").length;
  const archived = articles.filter((article) => article.status === "ARCHIVED").length;

  statTotal.textContent = total;
  statPublished.textContent = published;
  statDraft.textContent = draft;
  statArchived.textContent = archived;
}

function renderArticlesTable() {
  const filteredArticles = getFilteredArticles();

  updateStats(filteredArticles);

  if (!filteredArticles.length) {
    adminArticlesStatus.textContent = "Nenhum artigo encontrado com os filtros atuais.";

    adminArticlesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty-cell">
          Nenhum artigo encontrado.
        </td>
      </tr>
    `;

    return;
  }

  adminArticlesStatus.textContent = `${filteredArticles.length} artigo(s) encontrado(s).`;

  adminArticlesTableBody.innerHTML = filteredArticles
    .map((article) => {
      const statusClass = getStatusClass(article.status);
      const protectedText = article.protected ? "Sim" : "Não";
      const protectedClass = article.protected ? "protected" : "public";

      return `
        <tr>
          <td>
            <div class="admin-article-title">
              <strong>${escapeHtml(article.title)}</strong>
              <span>${escapeHtml(article.slug)}</span>
            </div>
          </td>

          <td>${escapeHtml(getArticleCategoryName(article))}</td>

          <td>
            <span class="admin-badge ${statusClass}">
              ${escapeHtml(getStatusLabel(article.status))}
            </span>
          </td>

          <td>
            <span class="admin-badge ${protectedClass}">
              ${protectedText}
            </span>
          </td>

          <td>${article.videoCount || 0}</td>

          <td>${article.imageCount || 0}</td>

          <td>${formatDate(article.updatedAt || article.modifiedAt)}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadArticles() {
  adminArticlesStatus.textContent = "Carregando artigos...";

  const data = await requestAdmin("/admin/articles");

  if (!data) {
    return;
  }

  allArticles = Array.isArray(data.articles) ? data.articles : [];

  renderArticlesTable();
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);

  adminSearchInput.addEventListener("input", renderArticlesTable);
  statusFilter.addEventListener("change", renderArticlesTable);
  protectedFilter.addEventListener("change", renderArticlesTable);
}

async function initAdminPanel() {
  try {
    setupEvents();

    const isSessionValid = await validateSession();

    if (!isSessionValid) {
      return;
    }

    await loadArticles();
  } catch (error) {
    adminArticlesStatus.textContent = error.message;
    adminArticlesTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="admin-empty-cell">
          ${escapeHtml(error.message)}
        </td>
      </tr>
    `;
  }
}

initAdminPanel();