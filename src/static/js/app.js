/* ==========================================================
   MoneyPrinter V2 — Frontend Application Logic
   ========================================================== */

const API = "";  // same origin

// ---- Helpers ----

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.onclick = () => el.remove();
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ---- Navigation ----

function showPage(name) {
  $$(".page").forEach(p => p.classList.remove("active"));
  $$(".nav-btn").forEach(b => b.classList.remove("active"));
  const page = $(`#page-${name}`);
  if (page) page.classList.add("active");
  const btn = $(`.nav-btn[data-page="${name}"]`);
  if (btn) btn.classList.add("active");

  // Load data when navigating
  if (name === "dashboard") loadDashboard();
  if (name === "youtube")   loadYouTubeAccounts();
  if (name === "twitter")   loadTwitterAccounts();
  if (name === "afm")       loadAFM();
  if (name === "settings")  loadSettings();
}

document.addEventListener("DOMContentLoaded", () => {
  // Sidebar nav
  $$(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showPage(btn.dataset.page));
  });

  // Dash card shortcuts
  $$(".dash-card[data-goto]").forEach(card => {
    card.addEventListener("click", () => showPage(card.dataset.goto));
  });

  // Init
  showPage("dashboard");
});

// ---- Task polling ----

function pollTask(taskId, statusEl, resultEl, cardEl, onComplete) {
  cardEl.classList.remove("hidden");
  statusEl.textContent = "Running…";
  statusEl.className = "task-status running";
  resultEl.textContent = "";

  const interval = setInterval(async () => {
    try {
      const task = await api("GET", `/api/tasks/${taskId}`);
      if (task.status === "running") return;
      clearInterval(interval);

      if (task.status === "completed") {
        statusEl.textContent = "Completed!";
        statusEl.className = "task-status completed";
        resultEl.textContent = JSON.stringify(task.result, null, 2);
        toast("Task completed!", "success");
        if (onComplete) onComplete(task.result);
      } else {
        statusEl.textContent = "Failed";
        statusEl.className = "task-status failed";
        resultEl.textContent = task.error || "Unknown error";
        toast("Task failed: " + (task.error || ""), "error");
      }
    } catch (e) {
      clearInterval(interval);
      statusEl.textContent = "Error polling task";
      statusEl.className = "task-status failed";
      resultEl.textContent = e.message;
    }
  }, 2000);
}

// ==========================================================
// DASHBOARD
// ==========================================================

async function loadDashboard() {
  try {
    const [yt, tw, afm, models] = await Promise.all([
      api("GET", "/api/accounts/youtube"),
      api("GET", "/api/accounts/twitter"),
      api("GET", "/api/afm/products"),
      api("GET", "/api/models"),
    ]);

    $("#yt-account-count").textContent = `${yt.accounts.length} account${yt.accounts.length !== 1 ? "s" : ""}`;
    $("#tw-account-count").textContent = `${tw.accounts.length} account${tw.accounts.length !== 1 ? "s" : ""}`;
    $("#afm-product-count").textContent = `${afm.products.length} product${afm.products.length !== 1 ? "s" : ""}`;

    // Models selector
    const sel = $("#dash-model-select");
    sel.innerHTML = "";
    for (const m of models.models) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === models.active) opt.selected = true;
      sel.appendChild(opt);
    }

    // Update sidebar badge
    $("#model-badge").textContent = models.active || "No model";
  } catch (e) {
    toast("Dashboard load error: " + e.message, "error");
  }
}

// Activate model
document.addEventListener("DOMContentLoaded", () => {
  $("#dash-model-btn").addEventListener("click", async () => {
    const model = $("#dash-model-select").value;
    if (!model) return;
    try {
      await api("POST", "/api/models/select", { model });
      toast(`Model set to ${model}`, "success");
      $("#model-badge").textContent = model;
    } catch (e) {
      toast(e.message, "error");
    }
  });
});

// ==========================================================
// YOUTUBE
// ==========================================================

let _ytAccounts = [];

async function loadYouTubeAccounts() {
  try {
    const data = await api("GET", "/api/accounts/youtube");
    _ytAccounts = data.accounts;
    renderYTAccounts();
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderYTAccounts() {
  const tbody = $("#yt-accounts-table tbody");
  tbody.innerHTML = "";
  const empty = $("#yt-empty");

  if (_ytAccounts.length === 0) {
    empty.classList.remove("hidden");
    $("#yt-accounts-table").classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  $("#yt-accounts-table").classList.remove("hidden");

  for (const acc of _ytAccounts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(acc.nickname)}</td>
      <td>${esc(acc.niche)}</td>
      <td>${esc(acc.language)}</td>
      <td>${(acc.videos || []).length}</td>
      <td class="row gap">
        <button class="btn btn-primary btn-sm yt-gen" data-id="${acc.id}">Generate</button>
        <button class="btn btn-ghost btn-sm yt-vids" data-id="${acc.id}" data-nick="${esc(acc.nickname)}">Videos</button>
        <button class="btn btn-danger btn-sm yt-del" data-id="${acc.id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }

  // Wire buttons
  $$(".yt-gen").forEach(b => b.addEventListener("click", () => ytGenerate(b.dataset.id)));
  $$(".yt-vids").forEach(b => b.addEventListener("click", () => ytShowVideos(b.dataset.id, b.dataset.nick)));
  $$(".yt-del").forEach(b => b.addEventListener("click", () => ytDelete(b.dataset.id)));
}

async function ytGenerate(accountId) {
  try {
    const { task_id } = await api("POST", "/api/youtube/generate", { account_id: accountId });
    pollTask(
      task_id,
      $("#yt-task-status"),
      $("#yt-task-result"),
      $("#yt-task-card"),
      (result) => {
        // Offer upload
        if (result && result.video_path) {
          const uploadBtn = document.createElement("button");
          uploadBtn.className = "btn btn-success mt";
          uploadBtn.textContent = "Upload to YouTube";
          uploadBtn.addEventListener("click", () => ytUpload(accountId, result.video_path, { title: result.title, description: result.description }));
          $("#yt-task-result").appendChild(uploadBtn);
        }
      }
    );
  } catch (e) {
    toast(e.message, "error");
  }
}

async function ytUpload(accountId, videoPath, metadata) {
  try {
    const { task_id } = await api("POST", "/api/youtube/upload", {
      account_id: accountId,
      video_path: videoPath,
      metadata,
    });
    pollTask(task_id, $("#yt-task-status"), $("#yt-task-result"), $("#yt-task-card"));
  } catch (e) {
    toast(e.message, "error");
  }
}

async function ytShowVideos(accountId, nickname) {
  try {
    const { videos } = await api("GET", `/api/youtube/${accountId}/videos`);
    $("#yt-videos-nick").textContent = nickname;
    const tbody = $("#yt-videos-table tbody");
    tbody.innerHTML = "";

    if (videos.length === 0) {
      $("#yt-videos-empty").classList.remove("hidden");
      $("#yt-videos-table").classList.add("hidden");
    } else {
      $("#yt-videos-empty").classList.add("hidden");
      $("#yt-videos-table").classList.remove("hidden");
      for (const v of videos) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${esc(v.title || "")}</td><td>${esc(v.date || "")}</td><td><a href="${esc(v.url || "")}" target="_blank">${esc(v.url || "N/A")}</a></td>`;
        tbody.appendChild(tr);
      }
    }
    $("#yt-videos-section").classList.remove("hidden");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function ytDelete(accountId) {
  if (!confirm("Delete this YouTube account?")) return;
  try {
    await api("DELETE", `/api/accounts/youtube/${accountId}`);
    toast("Account deleted", "success");
    loadYouTubeAccounts();
  } catch (e) {
    toast(e.message, "error");
  }
}

// YT form
document.addEventListener("DOMContentLoaded", () => {
  $("#yt-add-btn").addEventListener("click", () => {
    $("#yt-form").classList.remove("hidden");
  });
  $("#yt-cancel-btn").addEventListener("click", () => {
    $("#yt-form").classList.add("hidden");
  });
  $("#yt-save-btn").addEventListener("click", async () => {
    try {
      await api("POST", "/api/accounts/youtube", {
        nickname: $("#yt-nickname").value,
        firefox_profile: $("#yt-profile").value,
        niche: $("#yt-niche").value,
        language: $("#yt-language").value,
      });
      toast("Account created!", "success");
      $("#yt-form").classList.add("hidden");
      $("#yt-nickname").value = "";
      $("#yt-profile").value = "";
      $("#yt-niche").value = "";
      loadYouTubeAccounts();
    } catch (e) {
      toast(e.message, "error");
    }
  });
  $("#yt-back-btn").addEventListener("click", () => {
    $("#yt-videos-section").classList.add("hidden");
  });
});

// ==========================================================
// TWITTER
// ==========================================================

let _twAccounts = [];

async function loadTwitterAccounts() {
  try {
    const data = await api("GET", "/api/accounts/twitter");
    _twAccounts = data.accounts;
    renderTWAccounts();
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderTWAccounts() {
  const tbody = $("#tw-accounts-table tbody");
  tbody.innerHTML = "";
  const empty = $("#tw-empty");

  if (_twAccounts.length === 0) {
    empty.classList.remove("hidden");
    $("#tw-accounts-table").classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  $("#tw-accounts-table").classList.remove("hidden");

  for (const acc of _twAccounts) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${esc(acc.nickname)}</td>
      <td>${esc(acc.topic)}</td>
      <td>${(acc.posts || []).length}</td>
      <td class="row gap">
        <button class="btn btn-primary btn-sm tw-post" data-id="${acc.id}">Post Tweet</button>
        <button class="btn btn-ghost btn-sm tw-posts-btn" data-id="${acc.id}" data-nick="${esc(acc.nickname)}">Posts</button>
        <button class="btn btn-danger btn-sm tw-del" data-id="${acc.id}">Delete</button>
      </td>`;
    tbody.appendChild(tr);
  }

  $$(".tw-post").forEach(b => b.addEventListener("click", () => twPost(b.dataset.id)));
  $$(".tw-posts-btn").forEach(b => b.addEventListener("click", () => twShowPosts(b.dataset.id, b.dataset.nick)));
  $$(".tw-del").forEach(b => b.addEventListener("click", () => twDelete(b.dataset.id)));
}

async function twPost(accountId) {
  try {
    const { task_id } = await api("POST", "/api/twitter/post", { account_id: accountId });
    pollTask(task_id, $("#tw-task-status"), $("#tw-task-result"), $("#tw-task-card"));
  } catch (e) {
    toast(e.message, "error");
  }
}

async function twShowPosts(accountId, nickname) {
  try {
    const { posts } = await api("GET", `/api/twitter/${accountId}/posts`);
    $("#tw-posts-nick").textContent = nickname;
    const tbody = $("#tw-posts-table tbody");
    tbody.innerHTML = "";

    if (posts.length === 0) {
      $("#tw-posts-empty").classList.remove("hidden");
      $("#tw-posts-table").classList.add("hidden");
    } else {
      $("#tw-posts-empty").classList.add("hidden");
      $("#tw-posts-table").classList.remove("hidden");
      for (const p of posts) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${esc(p.content || "")}</td><td>${esc(p.date || "")}</td>`;
        tbody.appendChild(tr);
      }
    }
    $("#tw-posts-section").classList.remove("hidden");
  } catch (e) {
    toast(e.message, "error");
  }
}

async function twDelete(accountId) {
  if (!confirm("Delete this Twitter account?")) return;
  try {
    await api("DELETE", `/api/accounts/twitter/${accountId}`);
    toast("Account deleted", "success");
    loadTwitterAccounts();
  } catch (e) {
    toast(e.message, "error");
  }
}

// TW form
document.addEventListener("DOMContentLoaded", () => {
  $("#tw-add-btn").addEventListener("click", () => {
    $("#tw-form").classList.remove("hidden");
  });
  $("#tw-cancel-btn").addEventListener("click", () => {
    $("#tw-form").classList.add("hidden");
  });
  $("#tw-save-btn").addEventListener("click", async () => {
    try {
      await api("POST", "/api/accounts/twitter", {
        nickname: $("#tw-nickname").value,
        firefox_profile: $("#tw-profile").value,
        topic: $("#tw-topic").value,
      });
      toast("Account created!", "success");
      $("#tw-form").classList.add("hidden");
      $("#tw-nickname").value = "";
      $("#tw-profile").value = "";
      $("#tw-topic").value = "";
      loadTwitterAccounts();
    } catch (e) {
      toast(e.message, "error");
    }
  });
  $("#tw-back-btn").addEventListener("click", () => {
    $("#tw-posts-section").classList.add("hidden");
  });
});

// ==========================================================
// AFFILIATE MARKETING
// ==========================================================

async function loadAFM() {
  try {
    const [products, twData] = await Promise.all([
      api("GET", "/api/afm/products"),
      api("GET", "/api/accounts/twitter"),
    ]);

    // Populate twitter account dropdown
    const sel = $("#afm-twitter-select");
    sel.innerHTML = '<option value="">— select account —</option>';
    for (const acc of twData.accounts) {
      const opt = document.createElement("option");
      opt.value = acc.id;
      opt.textContent = `${acc.nickname} (${acc.topic})`;
      sel.appendChild(opt);
    }

    // Render products table
    const tbody = $("#afm-products-table tbody");
    tbody.innerHTML = "";
    if (products.products.length === 0) {
      $("#afm-empty").classList.remove("hidden");
      $("#afm-products-table").classList.add("hidden");
    } else {
      $("#afm-empty").classList.add("hidden");
      $("#afm-products-table").classList.remove("hidden");
      for (const p of products.products) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><a href="${esc(p.affiliate_link)}" target="_blank">${esc(p.affiliate_link)}</a></td><td>${esc(p.twitter_uuid)}</td>`;
        tbody.appendChild(tr);
      }
    }
  } catch (e) {
    toast(e.message, "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#afm-run-btn").addEventListener("click", async () => {
    const link = $("#afm-link").value.trim();
    const twUuid = $("#afm-twitter-select").value;
    if (!link || !twUuid) {
      toast("Please provide an affiliate link and select a Twitter account.", "error");
      return;
    }
    try {
      const { task_id } = await api("POST", "/api/afm/run", {
        affiliate_link: link,
        twitter_uuid: twUuid,
      });
      pollTask(task_id, $("#afm-task-status"), $("#afm-task-result"), $("#afm-task-card"), () => loadAFM());
    } catch (e) {
      toast(e.message, "error");
    }
  });
});

// ==========================================================
// OUTREACH
// ==========================================================

document.addEventListener("DOMContentLoaded", () => {
  $("#outreach-run-btn").addEventListener("click", async () => {
    try {
      const { task_id } = await api("POST", "/api/outreach/start");
      pollTask(task_id, $("#outreach-task-status"), $("#outreach-task-result"), $("#outreach-task-card"));
    } catch (e) {
      toast(e.message, "error");
    }
  });
});

// ==========================================================
// SETTINGS
// ==========================================================

let _configData = {};

async function loadSettings() {
  try {
    _configData = await api("GET", "/api/config");
    renderSettings(_configData);
  } catch (e) {
    toast(e.message, "error");
  }
}

function renderSettings(cfg, prefix = "", container = null) {
  const grid = container || $("#settings-form");
  if (!container) grid.innerHTML = "";

  for (const [key, value] of Object.entries(cfg)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Section header
      const header = document.createElement("div");
      header.className = "full-width";
      header.innerHTML = `<h4 style="margin:12px 0 4px; color: var(--accent); font-size:0.85rem; text-transform: uppercase;">${esc(key)}</h4>`;
      grid.appendChild(header);
      renderSettings(value, fullKey, grid);
      continue;
    }

    const label = document.createElement("label");
    const inputType = typeof value === "boolean" ? "text" : (typeof value === "number" ? "number" : "text");
    label.innerHTML = `${esc(key)} <input type="${inputType}" data-key="${fullKey}" value="${esc(String(value))}" />`;
    grid.appendChild(label);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("#settings-save-btn").addEventListener("click", async () => {
    const inputs = $$("#settings-form input");
    const updates = {};

    for (const input of inputs) {
      const keys = input.dataset.key.split(".");
      let target = updates;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!target[keys[i]]) target[keys[i]] = {};
        target = target[keys[i]];
      }
      let val = input.value;
      // Attempt type coercion
      if (input.type === "number") val = Number(val);
      else if (val === "true") val = true;
      else if (val === "false") val = false;
      target[keys[keys.length - 1]] = val;
    }

    try {
      await api("POST", "/api/config", updates);
      toast("Settings saved!", "success");
    } catch (e) {
      toast(e.message, "error");
    }
  });

  $("#settings-reload-btn").addEventListener("click", () => loadSettings());
});

// ==========================================================
// Utilities
// ==========================================================

function esc(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
