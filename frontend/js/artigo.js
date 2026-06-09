const API_URL = "http://localhost:3001";

const articleStatus = document.getElementById("articleStatus");
const articleContainer = document.getElementById("articleContainer");
const articleMeta = document.getElementById("articleMeta");
const articleTitle = document.getElementById("articleTitle");
const articleInfo = document.getElementById("articleInfo");
const articleContent = document.getElementById("articleContent");

const YOUTUBE_URL_REGEX =
  /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/|youtu\.be\/)[^\s<"]+)/gi;

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

  if (Number(article.videoCount || 0) > 0) {
    details.push(`${article.videoCount} vídeo(s)`);
  }

  if (Number(article.imageCount || 0) > 0) {
    details.push(`${article.imageCount} imagem(ns)`);
  }

  articleInfo.textContent = details.length
    ? details.join(" • ")
    : "Conteúdo da Central de Ajuda VipERP";
}

function getSafePageOrigin() {
  if (window.location.origin && window.location.origin !== "null") {
    return window.location.origin;
  }

  return "";
}

function cleanYouTubeUrl(url) {
  return String(url || "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/[),.;\]]+$/g, "");
}

function getYouTubeVideoId(url) {
  const cleanUrl = cleanYouTubeUrl(url);

  if (!cleanUrl) return null;

  try {
    const parsedUrl = new URL(cleanUrl);
    const hostname = parsedUrl.hostname.replace("www.", "");

    if (hostname === "youtu.be") {
      return parsedUrl.pathname.replace("/", "").split("?")[0] || null;
    }

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.replace("/embed/", "").split("/")[0] || null;
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.replace("/shorts/", "").split("/")[0] || null;
      }

      if (parsedUrl.pathname.startsWith("/live/")) {
        return parsedUrl.pathname.replace("/live/", "").split("/")[0] || null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function createYouTubeWatchLink(originalUrl) {
  const safeUrl = escapeHtml(cleanYouTubeUrl(originalUrl));

  return `
    <p class="youtube-watch-wrapper">
      <a
        class="youtube-watch-link"
        href="${safeUrl}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Clique para assistir o vídeo no YouTube
        <span>↗</span>
      </a>
    </p>
  `;
}

function createYouTubeEmbed(videoId, originalUrl) {
  if (!videoId) return "";

  const origin = getSafePageOrigin();

  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });

  if (origin) {
    params.set("origin", origin);
  }

  return `
    <div class="youtube-video-block">
      <div class="youtube-embed">
        <iframe
          src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}"
          title="Vídeo do YouTube"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      ${createYouTubeWatchLink(originalUrl)}
    </div>
  `;
}

function getYouTubeUrlsFromText(text) {
  const matches = String(text || "").match(YOUTUBE_URL_REGEX);

  if (!matches) {
    return [];
  }

  return matches.map(cleanYouTubeUrl);
}

function replaceYouTubeAnchorLinks() {
  const links = Array.from(articleContent.querySelectorAll("a"));

  links.forEach((link) => {
    if (link.closest(".youtube-video-block")) return;

    const href = link.getAttribute("href");
    const videoId = getYouTubeVideoId(href);

    if (!videoId) return;

    const embedHtml = createYouTubeEmbed(videoId, href);
    const paragraph = link.closest("p");

    if (paragraph) {
      paragraph.outerHTML = embedHtml;
      return;
    }

    link.outerHTML = embedHtml;
  });
}

function replacePlainYouTubeLinks() {
  const elements = Array.from(articleContent.querySelectorAll("p, div, li"));

  elements.forEach((element) => {
    if (element.closest(".youtube-video-block")) return;
    if (element.querySelector(".youtube-video-block")) return;
    if (element.querySelector("iframe")) return;

    const urls = getYouTubeUrlsFromText(element.textContent);

    if (urls.length === 0) return;

    const embeds = urls
      .map((url) => {
        const videoId = getYouTubeVideoId(url);

        if (!videoId) return "";

        return createYouTubeEmbed(videoId, url);
      })
      .filter(Boolean)
      .join("");

    if (!embeds) return;

    const textWithoutUrls = element.textContent
      .replace(YOUTUBE_URL_REGEX, "")
      .trim();

    YOUTUBE_URL_REGEX.lastIndex = 0;

    if (!textWithoutUrls) {
      element.outerHTML = embeds;
      return;
    }

    element.innerHTML = element.innerHTML.replace(YOUTUBE_URL_REGEX, "");
    YOUTUBE_URL_REGEX.lastIndex = 0;
    element.insertAdjacentHTML("afterend", embeds);
  });
}

function renderVideosFromArticleField(article) {
  if (!article.videos) return;

  const existingVideos = articleContent.querySelectorAll(".youtube-video-block");

  if (existingVideos.length > 0) {
    return;
  }

  const possibleUrls = String(article.videos)
    .split(/[\n,;|]+/)
    .map((item) => cleanYouTubeUrl(item))
    .filter(Boolean);

  const embeds = possibleUrls
    .map((url) => {
      const videoId = getYouTubeVideoId(url);

      if (!videoId) return "";

      return createYouTubeEmbed(videoId, url);
    })
    .filter(Boolean)
    .join("");

  if (!embeds) return;

  articleContent.insertAdjacentHTML(
    "afterbegin",
    `
      <h2>Vídeo tutorial</h2>
      ${embeds}
    `
  );
}

function removeRawYouTubeLinksFromTextNodes() {
  const walker = document.createTreeWalker(
    articleContent,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;

        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest(".youtube-video-block")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest(".youtube-watch-wrapper")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (YOUTUBE_URL_REGEX.test(node.nodeValue)) {
          YOUTUBE_URL_REGEX.lastIndex = 0;
          return NodeFilter.FILTER_ACCEPT;
        }

        YOUTUBE_URL_REGEX.lastIndex = 0;
        return NodeFilter.FILTER_REJECT;
      },
    }
  );

  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    node.nodeValue = node.nodeValue.replace(YOUTUBE_URL_REGEX, "").trim();
    YOUTUBE_URL_REGEX.lastIndex = 0;
  });
}

function removeEmbedPlaceholders() {
  const walker = document.createTreeWalker(
    articleContent,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;

        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest(".youtube-video-block")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.closest(".youtube-watch-wrapper")) {
          return NodeFilter.FILTER_REJECT;
        }

        if (String(node.nodeValue || "").includes("{embed}")) {
          return NodeFilter.FILTER_ACCEPT;
        }

        return NodeFilter.FILTER_REJECT;
      },
    }
  );

  const textNodes = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    node.nodeValue = String(node.nodeValue || "")
      .replaceAll("{embed}", "")
      .replaceAll("{ embed }", "")
      .trim();
  });
}

function removeEmptyParagraphsAfterYoutubeCleanup() {
  const elements = Array.from(articleContent.querySelectorAll("p, div, li"));

  elements.forEach((element) => {
    if (element.closest(".youtube-video-block")) return;
    if (element.querySelector("img, iframe, a, button, ul, ol, table")) return;

    const text = element.textContent.trim();

    if (!text) {
      element.remove();
    }
  });
}

function fixYouTubeVideos(article) {
  replaceYouTubeAnchorLinks();
  replacePlainYouTubeLinks();
  renderVideosFromArticleField(article);
  removeRawYouTubeLinksFromTextNodes();
  removeEmbedPlaceholders();
  removeEmptyParagraphsAfterYoutubeCleanup();
}

function normalizeImagePath(src) {
  if (!src) return src;

  let cleanSrc = String(src)
    .trim()
    .replace(/\\/g, "/")
    .replace(/%5C/g, "/");

  if (cleanSrc.startsWith("data:")) {
    return cleanSrc;
  }

  if (cleanSrc.startsWith("http://") || cleanSrc.startsWith("https://")) {
    return cleanSrc;
  }

  const uploadsIndex = cleanSrc.toLowerCase().indexOf("/uploads/");

  if (uploadsIndex !== -1) {
    const relativePath = cleanSrc.substring(uploadsIndex + "/uploads/".length);
    return `./uploads/${relativePath}`;
  }

  if (cleanSrc.startsWith("uploads/")) {
    return `./${cleanSrc}`;
  }

  if (cleanSrc.startsWith("/uploads/")) {
    return `.${cleanSrc}`;
  }

  return cleanSrc;
}

function hasUsefulText(element) {
  return String(element.textContent || "").trim().length > 0;
}

function copyParagraphAttributes(source, target) {
  Array.from(source.attributes).forEach((attribute) => {
    target.setAttribute(attribute.name, attribute.value);
  });
}

function isImageNode(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const element = node;

  if (element.tagName.toLowerCase() === "img") {
    return true;
  }

  if (
    element.tagName.toLowerCase() === "a" &&
    element.querySelector("img") &&
    element.textContent.trim() === ""
  ) {
    return true;
  }

  return false;
}

function createImageBlock(imageNode) {
  const figure = document.createElement("figure");

  figure.className = "article-image-block";
  figure.style.display = "block";
  figure.style.clear = "both";
  figure.style.width = "100%";
  figure.style.margin = "22px 0";
  figure.style.textAlign = "center";

  figure.appendChild(imageNode);

  return figure;
}

function splitParagraphsWithImages() {
  const paragraphs = Array.from(articleContent.querySelectorAll("p"));

  paragraphs.forEach((paragraph) => {
    const images = paragraph.querySelectorAll("img");

    if (images.length === 0) {
      return;
    }

    const hasOnlyImagesAndEmptyText =
      paragraph.textContent.trim() === "" && images.length > 0;

    const fragment = document.createDocumentFragment();
    let currentParagraph = document.createElement("p");
    copyParagraphAttributes(paragraph, currentParagraph);

    function flushCurrentParagraph() {
      if (currentParagraph.childNodes.length === 0) {
        return;
      }

      if (!hasUsefulText(currentParagraph) && !currentParagraph.querySelector("br")) {
        currentParagraph = document.createElement("p");
        copyParagraphAttributes(paragraph, currentParagraph);
        return;
      }

      fragment.appendChild(currentParagraph);

      currentParagraph = document.createElement("p");
      copyParagraphAttributes(paragraph, currentParagraph);
    }

    const childNodes = Array.from(paragraph.childNodes);

    childNodes.forEach((node) => {
      if (isImageNode(node)) {
        flushCurrentParagraph();
        fragment.appendChild(createImageBlock(node));
        return;
      }

      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node.querySelector("img") &&
        !isImageNode(node)
      ) {
        const wrapper = node;
        const wrapperChildren = Array.from(wrapper.childNodes);

        wrapperChildren.forEach((child) => {
          if (isImageNode(child)) {
            flushCurrentParagraph();
            fragment.appendChild(createImageBlock(child));
          } else {
            currentParagraph.appendChild(child);
          }
        });

        return;
      }

      currentParagraph.appendChild(node);
    });

    flushCurrentParagraph();

    if (hasOnlyImagesAndEmptyText && fragment.childNodes.length > 0) {
      paragraph.replaceWith(fragment);
      return;
    }

    if (fragment.childNodes.length > 0) {
      paragraph.replaceWith(fragment);
    }
  });
}

function fixImageStyle(img) {
  img.removeAttribute("align");

  img.style.float = "none";
  img.style.clear = "both";
  img.style.display = "block";
  img.style.maxWidth = "100%";
  img.style.width = "auto";
  img.style.height = "auto";
  img.style.objectFit = "contain";
  img.style.verticalAlign = "middle";
  img.style.borderRadius = "12px";
  img.style.margin = "0 auto";

  const parent = img.parentElement;

  if (parent) {
    parent.style.float = "none";
    parent.style.clear = "both";
  }
}

function fixImages() {
  splitParagraphsWithImages();

  const images = Array.from(articleContent.querySelectorAll("img"));

  images.forEach((img) => {
    img.setAttribute("loading", "lazy");

    const originalSrc = img.getAttribute("src");

    if (!originalSrc) return;

    const fixedSrc = normalizeImagePath(originalSrc);

    img.setAttribute("src", fixedSrc);

    fixImageStyle(img);

    img.onerror = () => {
      img.insertAdjacentHTML(
        "afterend",
        `
          <p class="error-box">
            Imagem não encontrada. Verifique se a pasta uploads está dentro de frontend/uploads.
          </p>
        `
      );
    };
  });
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

async function loadArticle() {
  const slug = getSlugFromUrl();

  if (!slug) {
    articleStatus.className = "error-box";
    articleStatus.textContent = "Slug do artigo não informado.";
    return;
  }

  try {
    const response = await fetch(`${API_URL}/articles/${encodeURIComponent(slug)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Artigo não encontrado.");
    }

    const article = data.article || data;

    document.title = `${article.title} | Central de Ajuda VipERP`;

    renderMeta(article);

    articleTitle.textContent = article.title;
    renderInfo(article);

    articleContent.innerHTML = article.contentHtml || "<p>Conteúdo não disponível.</p>";

    fixYouTubeVideos(article);
    fixImages();
    fixContentLinks();

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