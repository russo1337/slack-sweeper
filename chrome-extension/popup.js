const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const fileInput = document.getElementById("csvFile");
const runBtn = document.getElementById("runBtn");

function setStatus(message) {
  statusEl.textContent = message;
}

function logLine(message) {
  logEl.textContent += `${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSessionData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id || !tab.url) {
    throw new Error("No active tab found.");
  }

  const url = new URL(tab.url);
  if (!url.hostname.endsWith(".slack.com")) {
    throw new Error("Open the Slack admin page in the active tab.");
  }
  if (!/^\/admin(\/|$)/.test(url.pathname)) {
    throw new Error("Open a Slack admin page (URL path starting with /admin) in the active tab.");
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const data = window.boot_data || window.BOOT_DATA || window.__boot_data__;
      let token = data && data.api_token ? data.api_token : null;
      let teamId = data && data.team_id ? data.team_id : null;

      const tryParse = (value) => {
        if (!value) return null;
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      };

      if (!token || !teamId) {
        const localConfig =
          tryParse(window.localStorage.getItem("localConfig_v2")) ||
          tryParse(window.localStorage.getItem("localConfig"));
        if (localConfig) {
          token = token || localConfig.api_token || localConfig.token || null;
          teamId = teamId || localConfig.team_id || localConfig.teamId || null;
        }
      }

      if (!token || !teamId) {
        const sessConfig = tryParse(window.sessionStorage.getItem("localConfig_v2"));
        if (sessConfig) {
          token = token || sessConfig.api_token || sessConfig.token || null;
          teamId = teamId || sessConfig.team_id || sessConfig.teamId || null;
        }
      }

      return {
        token,
        teamId,
        hostname: window.location.hostname,
      };
    },
  });

  const result = results && results[0] ? results[0].result : null;
  if (!result || !result.token || !result.teamId) {
    throw new Error(
      "Could not read session token. Refresh the Slack admin page and try again."
    );
  }

  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/);
  const ids = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "id") {
      continue;
    }
    const first = trimmed.split(",")[0].replace(/"/g, "").trim();
    if (first) {
      ids.push(first);
    }
  }
  return ids;
}

function validateUserIds(ids) {
  const invalid = ids.filter((id) => !/^[UW][A-Z0-9]+$/i.test(id));
  if (invalid.length) {
    const sample = invalid.slice(0, 5).join(", ");
    throw new Error(
      `Invalid Slack user ID(s) in CSV (must start with U or W): ${sample}${invalid.length > 5 ? "..." : ""}`
    );
  }
}

function confirmDeactivation(hostname, count) {
  return window.confirm(
    `Deactivate ${count} user${count === 1 ? "" : "s"} in ${hostname}?\n\nThis action is destructive and cannot be undone from this extension.`
  );
}

async function deactivateUser(session, userId) {
  const form = new FormData();
  form.append("token", session.token);
  form.append("user", userId);
  form.append("target_team", session.teamId);
  form.append("_x_reason", "manage-member-remove-from-workspace");
  form.append("_x_mode", "online");

  const response = await fetch(
    `https://${session.hostname}/api/users.admin.setInactive`,
    {
      method: "POST",
      body: form,
      credentials: "include",
    }
  );

  const payload = await response.json();
  return payload;
}

runBtn.addEventListener("click", async () => {
  logEl.textContent = "";
  setStatus("Loading CSV…");
  runBtn.disabled = true;

  try {
    const file = fileInput.files[0];
    if (!file) {
      throw new Error("Select a CSV file first.");
    }

    const text = await file.text();
    const ids = parseCsv(text);
    if (!ids.length) {
      throw new Error("No user IDs found in the CSV.");
    }
    validateUserIds(ids);

    setStatus("Reading Slack session…");
    const session = await getSessionData();

    setStatus("Waiting for confirmation…");
    if (!confirmDeactivation(session.hostname, ids.length)) {
      throw new Error("Operation cancelled.");
    }

    setStatus(`Deactivating ${ids.length} users…`);
    let success = 0;
    let failed = 0;

    for (const userId of ids) {
      try {
        const payload = await deactivateUser(session, userId);
        if (payload && payload.ok) {
          logLine(`Deactivated ${userId}`);
          success += 1;
        } else {
          const error = payload && payload.error ? payload.error : "unknown_error";
          logLine(`Failed ${userId}: ${error}`);
          failed += 1;
        }
      } catch (err) {
        logLine(`Failed ${userId}: ${err.message}`);
        failed += 1;
      }

      await sleep(600);
    }

    setStatus(`Done. Success: ${success}, Failed: ${failed}`);
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    runBtn.disabled = false;
  }
});
