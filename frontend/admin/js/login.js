const API_URL = "http://localhost:3001";

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

function setMessage(message, type = "") {
  loginMessage.textContent = message;
  loginMessage.className = "login-message";

  if (type) {
    loginMessage.classList.add(type);
  }
}

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginButton.textContent = isLoading ? "Entrando..." : "Entrar no painel";
}

function saveSession(data) {
  localStorage.setItem("adminToken", data.token);
  localStorage.setItem("adminUser", JSON.stringify(data.user));
}

async function login(email, password) {
  const response = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Não foi possível realizar o login.");
  }

  return data;
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setMessage("Informe e-mail e senha.", "error");
    return;
  }

  try {
    setLoading(true);
    setMessage("Validando acesso...");

    const data = await login(email, password);

    saveSession(data);

    setMessage("Login realizado com sucesso. Redirecionando...", "success");

    setTimeout(() => {
      window.location.href = "./index.html";
    }, 700);
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    setLoading(false);
  }
});

(function checkExistingSession() {
  const token = localStorage.getItem("adminToken");

  if (token) {
    window.location.href = "./index.html";
  }
})();