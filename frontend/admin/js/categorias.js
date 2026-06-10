const API_URL = "http://localhost:3001";

const logoutButton = document.getElementById("logoutButton");
const categorySearchInput = document.getElementById("categorySearchInput");
const categoriesStatus = document.getElementById("categoriesStatus");
const categoriesTableBody = document.getElementById("categoriesTableBody");

const editCategoryModal = document.getElementById("editCategoryModal");
const closeCategoryModalButton = document.getElementById("closeCategoryModalButton");
const cancelCategoryEditButton = document.getElementById("cancelCategoryEditButton");
const editCategoryForm = document.getElementById("editCategoryForm");
const saveCategoryButton = document.getElementById("saveCategoryButton");

const categoryName = document.getElementById("categoryName");
const categoryDescription = document.getElementById("categoryDescription");

const confirmEditCategoryModal = document.getElementById("confirmEditCategoryModal");
const closeConfirmEditModalButton = document.getElementById("closeConfirmEditModalButton");
const cancelConfirmEditButton = document.getElementById("cancelConfirmEditButton");
const confirmEditCategoryButton = document.getElementById("confirmEditCategoryButton");
const confirmEditCategoryOldName = document.getElementById("confirmEditCategoryOldName");
const confirmEditCategoryOldSlug = document.getElementById("confirmEditCategoryOldSlug");
const confirmEditCategoryNewName = document.getElementById("confirmEditCategoryNewName");

let allCategories = [];
let filteredCategories = [];
let categoryBeingEdited = null;
let pendingCategoryPayload = null;
let toastTimeout = null;

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

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

function getArticleCount(category) {
  return Number(category._count?.articles || 0);
}

function showToast(message, type = "success") {
  let toast = document.getElementById("adminToastMessage");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "adminToastMessage";
    toast.className = "admin-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `admin-toast ${type} visible`;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3200);
}

function renderCategoriesStatus() {
  const total = filteredCategories.length;

  if (!allCategories.length) {
    categoriesStatus.textContent = "Nenhuma categoria encontrada.";
    return;
  }

  if (total === allCategories.length) {
    categoriesStatus.textContent = `${total} categoria(s) carregada(s).`;
    return;
  }

  categoriesStatus.textContent = `${total} categoria(s) encontrada(s) no filtro.`;
}

function renderEmptyState() {
  categoriesTableBody.innerHTML = `
    <tr>
      <td colspan="6" class="admin-empty-cell">
        Nenhuma categoria encontrada.
      </td>
    </tr>
  `;
}

function renderCategories() {
  renderCategoriesStatus();

  if (!filteredCategories.length) {
    renderEmptyState();
    return;
  }

  const rows = filteredCategories
    .map((category) => {
      const description = category.description || "-";
      const articleCount = getArticleCount(category);

      return `
        <tr data-category-id="${category.id}">
          <td>
            <div class="admin-article-title">
              <strong>${category.name || "Sem nome"}</strong>
              <span>ID: ${category.id}</span>
            </div>
          </td>

          <td>${category.slug || "-"}</td>

          <td>${description}</td>

          <td>${articleCount}</td>

          <td>${formatDate(category.updatedAt || category.createdAt)}</td>

          <td>
            <div class="admin-actions">
              <button
                type="button"
                class="admin-action-btn edit"
                data-edit-category-id="${category.id}"
                title="Editar categoria"
              >
                Editar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  categoriesTableBody.innerHTML = rows;
}

function categoryMatchesSearch(category, searchTerm) {
  if (!searchTerm) {
    return true;
  }

  const normalizedSearch = normalizeText(searchTerm);

  const searchableContent = [
    category.name,
    category.slug,
    category.description,
  ]
    .map(normalizeText)
    .join(" ");

  return searchableContent.includes(normalizedSearch);
}

function applyFilters() {
  const searchTerm = categorySearchInput.value.trim();

  filteredCategories = allCategories.filter((category) => {
    return categoryMatchesSearch(category, searchTerm);
  });

  renderCategories();
}

async function loadCategories() {
  categoriesStatus.textContent = "Carregando categorias...";

  const data = await requestAdmin("/admin/categories");

  if (!data) {
    return;
  }

  allCategories = Array.isArray(data.categories) ? data.categories : [];
  filteredCategories = [...allCategories];

  applyFilters();
}

function getCategoryById(categoryId) {
  return allCategories.find((category) => category.id === categoryId);
}

function openEditCategoryModal(category) {
  categoryBeingEdited = category;

  categoryName.value = category.name || "";
  categoryDescription.value = category.description || "";

  editCategoryModal.classList.remove("hidden");
  document.body.classList.add("admin-modal-open");

  setTimeout(() => {
    categoryName.focus();
    categoryName.select();
  }, 50);
}

function closeEditCategoryModal() {
  categoryBeingEdited = null;
  editCategoryForm.reset();
  editCategoryModal.classList.add("hidden");
  document.body.classList.remove("admin-modal-open");
}

function openConfirmEditModal(payload) {
  pendingCategoryPayload = payload;

  confirmEditCategoryOldName.textContent = categoryBeingEdited?.name || "Sem nome";
  confirmEditCategoryOldSlug.textContent = categoryBeingEdited?.slug || "sem-slug";
  confirmEditCategoryNewName.textContent = payload.name || "Sem nome";

  confirmEditCategoryModal.classList.remove("hidden");
  document.body.classList.add("admin-modal-open");
}

function closeConfirmEditModal() {
  pendingCategoryPayload = null;
  confirmEditCategoryModal.classList.add("hidden");

  if (editCategoryModal.classList.contains("hidden")) {
    document.body.classList.remove("admin-modal-open");
  }
}

function validateCategoryForm() {
  const name = categoryName.value.trim();

  if (!name) {
    throw new Error("Informe o nome da categoria.");
  }

  return {
    name,
    description: categoryDescription.value.trim(),
  };
}

function setSaving(isSaving) {
  saveCategoryButton.disabled = isSaving;
  confirmEditCategoryButton.disabled = isSaving;

  saveCategoryButton.textContent = isSaving ? "Salvando..." : "Salvar categoria";
  confirmEditCategoryButton.textContent = isSaving ? "Salvando..." : "Confirmar edição";
}

async function saveCategoryConfirmed() {
  if (!categoryBeingEdited) {
    throw new Error("Nenhuma categoria selecionada para edição.");
  }

  if (!pendingCategoryPayload) {
    throw new Error("Nenhuma alteração pendente para salvar.");
  }

  setSaving(true);
  categoriesStatus.textContent = "Salvando categoria...";

  const response = await fetch(`${API_URL}/admin/categories/${encodeUrlValue(categoryBeingEdited.id)}`, {
    method: "PUT",
    headers: getJsonAuthHeaders(),
    body: JSON.stringify(pendingCategoryPayload),
  });

  const data = await response.json();

  if (response.status === 401 || response.status === 403) {
    clearSession();
    redirectToLogin();
    return;
  }

  if (!response.ok) {
    throw new Error(data.error || "Erro ao salvar categoria.");
  }

  const updatedCategory = data.category;

  allCategories = allCategories.map((category) => {
    if (category.id === updatedCategory.id) {
      return updatedCategory;
    }

    return category;
  });

  applyFilters();

  closeConfirmEditModal();
  closeEditCategoryModal();

  categoriesStatus.textContent = "Categoria atualizada com sucesso.";
  showToast("Categoria atualizada com sucesso.", "success");
}

function setupEvents() {
  logoutButton.addEventListener("click", logout);

  categorySearchInput.addEventListener("input", applyFilters);

  categoriesTableBody.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit-category-id]");

    if (!editButton) {
      return;
    }

    const categoryId = editButton.getAttribute("data-edit-category-id");

    if (!categoryId) {
      return;
    }

    const category = getCategoryById(categoryId);

    if (!category) {
      showToast("Categoria não encontrada na listagem.", "error");
      return;
    }

    openEditCategoryModal(category);
  });

  closeCategoryModalButton.addEventListener("click", closeEditCategoryModal);
  cancelCategoryEditButton.addEventListener("click", closeEditCategoryModal);

  editCategoryModal.addEventListener("click", (event) => {
    if (event.target === editCategoryModal) {
      closeEditCategoryModal();
    }
  });

  closeConfirmEditModalButton.addEventListener("click", closeConfirmEditModal);
  cancelConfirmEditButton.addEventListener("click", closeConfirmEditModal);

  confirmEditCategoryModal.addEventListener("click", (event) => {
    if (event.target === confirmEditCategoryModal) {
      closeConfirmEditModal();
    }
  });

  confirmEditCategoryButton.addEventListener("click", async () => {
    try {
      await saveCategoryConfirmed();
    } catch (error) {
      categoriesStatus.textContent = error.message;
      showToast(error.message, "error");
    } finally {
      setSaving(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!confirmEditCategoryModal.classList.contains("hidden")) {
      closeConfirmEditModal();
      return;
    }

    if (!editCategoryModal.classList.contains("hidden")) {
      closeEditCategoryModal();
    }
  });

  editCategoryForm.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      const payload = validateCategoryForm();
      openConfirmEditModal(payload);
    } catch (error) {
      categoriesStatus.textContent = error.message;
      showToast(error.message, "error");
    }
  });
}

async function initCategoriesPage() {
  try {
    setupEvents();

    const isSessionValid = await validateSession();

    if (!isSessionValid) {
      return;
    }

    await loadCategories();
  } catch (error) {
    categoriesStatus.textContent = error.message;
    showToast(error.message, "error");
  }
}

initCategoriesPage();