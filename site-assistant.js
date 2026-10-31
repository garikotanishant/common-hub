(() => {
  const historyKey = "common.assistant.history.v1";
  const draftKey = "common.assistant.resourceDraft.v1";
  const emailKey = "common.assistant.emailDraft.v1";
  const savedKey = "common.savedResources.v1";
  const customResourcesKey = "common.customResources.v1";
  const fallbackSavedIds = [];
  const categories = [
    "Government",
    "Public Safety",
    "Parks and Outdoors",
    "Education",
    "Health and Human Services",
    "Transit and Travel",
    "Utilities and Infrastructure",
    "Community Life"
  ];
  const requiredDraftFields = ["name", "category", "type", "governance", "description", "address", "sourceUrl"];
  const fieldAliases = {
    name: ["name", "resource", "resource name"],
    category: ["category"],
    type: ["type", "resource type"],
    governance: ["organization", "organisation", "governance", "managing organization", "managing entity"],
    description: ["description", "offer", "offers", "service"],
    address: ["area", "location", "address", "service area"],
    phone: ["phone", "contact"],
    hours: ["hours", "schedule"],
    audience: ["audience", "eligibility", "who can use it"],
    requirements: ["requirements", "notes"],
    sourceUrl: ["source", "source url", "url", "website"]
  };
  const fieldLabels = {
    name: "resource name",
    category: "category",
    type: "type of resource",
    governance: "managing organization",
    description: "what the resource offers",
    address: "location or service area",
    sourceUrl: "a public source URL"
  };

  let memoryHistory = [];
  let memoryDraft = null;
  let memoryEmail = null;
  let catalogPromise = null;
  let aiReady = false;
  let aiBusy = false;
  const endpoint = window.COMMON_ASSISTANT_CONFIG?.endpoint || "/api/chat";
  const aiConsentKey = "common.assistant.geminiConsent.v1";

  async function checkAI() {
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const health = await response.json();
      aiReady = health.configured === true;
      const status = document.getElementById("assistantMode");
      if (status) status.textContent = aiReady ? "Gemini · community guide" : "Community guide";
      const consent = document.getElementById("assistantConsent");
      if (consent) consent.hidden = !aiReady;
    } catch { /* The local helper stays available on GitHub Pages without a backend. */ }
  }

  async function answerWithAI(text) {
    if (!aiReady || !document.getElementById("assistantAIConsent")?.checked) return false;
    aiBusy = true;
    const send = document.querySelector("#assistantForm button");
    const status = document.getElementById("assistantStatus");
    if (send) send.disabled = true;
    if (status) { status.hidden = false; status.textContent = "Thinking…"; }
    try {
      const history = getHistory().slice(0, -1).slice(-6).map(({ role, text }) => ({ role, text }));
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, history }), signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(response.status === 429 ? "quota" : "unavailable");
      const result = await response.json();
      if (typeof result.answer !== "string") throw new Error("unavailable");
      appendMessage("assistant", result.answer);
      const catalog = await loadCatalog();
      const ids = new Set(Array.isArray(result.resourceIds) ? result.resourceIds : []);
      showActions(catalog.filter(r => ids.has(r.id)).slice(0, 3).map(r => ({ label: r.name, action: "navigate", value: `directory.html?resource=${encodeURIComponent(r.id)}` })));
      return true;
    } catch (error) {
      appendMessage("assistant", error.message === "quota" ? "The AI request limit has been reached. You can still search and browse the directory below." : "Gemini isn’t available right now. You can still use the directory and saved places.");
      const query = text.slice(0, 200);
      showActions([{ label: "Search the directory", action: "navigate", value: `directory.html?q=${encodeURIComponent(query)}` }]);
      return true;
    } finally {
      aiBusy = false;
      if (send) send.disabled = false;
      if (status) status.hidden = true;
    }
  }

  function readSession(key, fallback) {
    try {
      const value = sessionStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.warn("The assistant could not restore this tab's saved conversation.", error);
      return fallback;
    }
  }

  function writeSession(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn("The assistant could not save this tab's conversation state.", error);
    }
  }

  function getHistory() {
    const saved = readSession(historyKey, memoryHistory);
    return Array.isArray(saved) ? saved : memoryHistory;
  }

  function saveHistory(history) {
    memoryHistory = history.slice(-16);
    writeSession(historyKey, memoryHistory);
  }

  function getDraft() {
    const saved = readSession(draftKey, memoryDraft);
    return saved && typeof saved === "object" ? saved : memoryDraft;
  }

  function saveDraft(draft) {
    memoryDraft = draft;
    writeSession(draftKey, draft);
  }

  function getEmailDraft() {
    const saved = readSession(emailKey, memoryEmail);
    return saved && typeof saved === "object" ? saved : memoryEmail;
  }

  function saveEmailDraft(draft) {
    memoryEmail = draft;
    writeSession(emailKey, draft);
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function appendMessage(role, text, history = getHistory()) {
    history.push({ role, text, time: Date.now() });
    saveHistory(history);
    renderHistory();
  }

  function renderHistory() {
    const log = document.getElementById("assistantMessages");
    if (!log) return;
    log.replaceChildren();
    for (const message of getHistory()) {
      const bubble = makeElement("p", `assistant-message assistant-message-${message.role}`, message.text);
      log.append(bubble);
    }
    log.scrollTop = log.scrollHeight;
  }

  function addActionButton(container, label, action, value = "") {
    const button = makeElement("button", "assistant-action", label);
    button.type = "button";
    button.dataset.assistantAction = action;
    if (value) button.dataset.value = value;
    container.append(button);
  }

  function showActions(actions) {
    const container = document.getElementById("assistantActions");
    if (!container) return;
    container.replaceChildren();
    for (const action of actions) {
      addActionButton(container, action.label, action.action, action.value);
    }
  }

  function setOpen(open) {
    const panel = document.getElementById("assistantPanel");
    const toggle = document.getElementById("assistantToggle");
    if (!panel || !toggle) return;
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close COMMON helper" : "Open COMMON helper");
    if (open) document.getElementById("assistantInput")?.focus();
    else toggle.focus();
  }

  function injectWidget() {
    if (document.getElementById("assistantWidget")) return;
    const widget = makeElement("div", "assistant-widget");
    widget.id = "assistantWidget";
    widget.innerHTML = `
      <section id="assistantPanel" class="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistantTitle" hidden>
        <header class="assistant-header">
          <span class="assistant-icon" aria-hidden="true">✦</span>
          <div>
            <h2 id="assistantTitle">COMMON</h2>
            <p id="assistantMode">Community guide</p>
          </div>
          <button type="button" class="assistant-close" aria-label="Close helper">×</button>
        </header>
        <div id="assistantMessages" class="assistant-messages" role="log" aria-live="polite" aria-relevant="additions text"></div>
        <div id="assistantActions" class="assistant-actions" aria-label="Suggested actions"></div>
        <div class="assistant-quick-actions" aria-label="Try asking">
          <button type="button" data-assistant-prompt="Open the directory">Browse resources</button>
          <button type="button" data-assistant-prompt="Show my saved resources">Saved resources</button>
          <button type="button" data-assistant-prompt="Help me suggest a resource">Suggest a resource</button>
        </div>
        <div id="assistantConsent" class="assistant-consent" hidden><label><input id="assistantAIConsent" type="checkbox">Use Gemini for AI answers. My question and recent chat will be sent to Google. I’ll avoid sharing personal details.</label></div>
        <p id="assistantStatus" class="assistant-status" role="status" hidden></p>
        <form id="assistantForm" class="assistant-form">
          <label class="sr-only" for="assistantInput">Ask COMMON helper</label>
          <textarea id="assistantInput" rows="2" maxlength="1200" placeholder="Ask how to use the site…" required></textarea>
          <button type="submit" aria-label="Send message">Send</button>
        </form>
        <p class="assistant-privacy">Check hours and eligibility with the organization. The guide can’t send email or verify live availability.</p>
      </section>
      <button id="assistantToggle" class="assistant-toggle" type="button" aria-expanded="false" aria-controls="assistantPanel" aria-label="Open COMMON helper">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5.75A2.75 2.75 0 0 1 7.75 3h8.5A2.75 2.75 0 0 1 19 5.75v7.5A2.75 2.75 0 0 1 16.25 16H11l-4.5 4v-4.33A2.75 2.75 0 0 1 5 13.25z"/><path d="M9 8h6M9 11.5h4"/></svg>
        <span>Ask COMMON</span>
      </button>`;
    document.body.append(widget);
    widget.addEventListener("click", handleWidgetClick);
    widget.querySelector("#assistantForm").addEventListener("submit", handleSubmit);
    const consent = widget.querySelector("#assistantAIConsent");
    consent.checked = readSession(aiConsentKey, false) === true;
    consent.addEventListener("change", () => writeSession(aiConsentKey, consent.checked));
    renderHistory();
    checkAI();
  }

  function handleWidgetClick(event) {
    const toggle = event.target.closest("#assistantToggle");
    if (toggle) {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
      return;
    }
    if (event.target.closest(".assistant-close")) {
      setOpen(false);
      return;
    }
    const prompt = event.target.closest("[data-assistant-prompt]");
    if (prompt) {
      processMessage(prompt.dataset.assistantPrompt);
      return;
    }
    const action = event.target.closest("[data-assistant-action]");
    if (action) handleAction(action.dataset.assistantAction, action.dataset.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const input = document.getElementById("assistantInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    processMessage(text);
  }

  function normalize(value) {
    return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
  }

  function includeLocalSuggestions(records) {
    let suggestions;
    try {
      const stored = localStorage.getItem(customResourcesKey);
      suggestions = stored === null ? [] : JSON.parse(stored);
      if (!Array.isArray(suggestions)) throw new TypeError("Saved suggestions are not stored as a list.");
    } catch (error) {
      console.error("Could not read locally saved resource suggestions.", error);
      throw new Error("I couldn’t access locally saved suggestions in this browser.");
    }

    const categoriesSet = new Set(categories);
    const requiredFields = [
      "name", "type", "description", "governance", "utility", "features",
      "audience", "requirements", "operational", "address", "phone", "hours"
    ];
    const knownIds = new Set(records.map((record) => record.id));
    const validSuggestions = suggestions.filter((entry) => {
      if (
        !entry
        || typeof entry.id !== "string"
        || !/^suwanee-custom-\d+$/.test(entry.id)
        || knownIds.has(entry.id)
        || !categoriesSet.has(entry.category)
        || !requiredFields.every((field) => typeof entry[field] === "string")
        || typeof entry.sourceUrl !== "string"
      ) return false;

      try {
        const source = new URL(entry.sourceUrl);
        return ["http:", "https:"].includes(source.protocol);
      } catch {
        return false;
      }
    });

    return records.concat(validSuggestions.map((entry, index) => ({
      ...entry,
      num: String(records.length + index + 1).padStart(2, "0"),
      lat: null,
      lng: null,
      cluster: null,
      gradeLevel: null,
      sourceType: entry.sourceType || "Community suggestion",
      verificationStatus: entry.verificationStatus || "needs-review",
      verificationNotes: entry.verificationNotes
        || "Visitor-suggested information saved in this browser; it has not been independently reviewed.",
      tags: [entry.name.toLowerCase(), entry.category.toLowerCase()]
    })));
  }

  function loadCatalog() {
    if (Array.isArray(window.COMMON_RESOURCE_RECORDS)) {
      try {
        return Promise.resolve(includeLocalSuggestions(window.COMMON_RESOURCE_RECORDS));
      } catch (error) {
        return Promise.reject(error);
      }
    }
    if (catalogPromise) return catalogPromise;
    catalogPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "resources-data.js?v=20261026";
      script.onload = () => {
        if (Array.isArray(window.COMMON_RESOURCE_RECORDS)) {
          try {
            resolve(includeLocalSuggestions(window.COMMON_RESOURCE_RECORDS));
          } catch (error) {
            reject(error);
          }
        }
        else reject(new Error("The resource catalog has an unexpected format."));
      };
      script.onerror = () => reject(new Error("The resource catalog could not be loaded."));
      document.head.append(script);
    });
    return catalogPromise;
  }

  function updateDirectorySearch(query, category = "") {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    window.location.href = `directory.html${params.size ? `?${params}` : ""}#main`;
  }

  function categoryMatch(text) {
    const normalized = normalize(text);
    return categories.find((category) => normalize(category) === normalized)
      || categories.find((category) => normalized.includes(normalize(category)));
  }

  function bestResourceMatches(query, records) {
    const terms = normalize(query).split(" ").filter((term) => term.length > 2);
    if (!terms.length) return [];
    return records.map((resource) => {
      const searchable = normalize([
        resource.name,
        resource.category,
        resource.type,
        resource.description,
        resource.utility,
        resource.address,
        ...(resource.tags || [])
      ].join(" "));
      const exactName = normalize(resource.name) === normalize(query) ? 20 : 0;
      const score = terms.reduce((total, term) => total + (searchable.includes(term) ? 1 : 0), exactName);
      return { resource, score };
    }).filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || a.resource.name.localeCompare(b.resource.name))
      .slice(0, 5)
      .map((result) => result.resource);
  }

  function readSavedIds() {
    try {
      const value = localStorage.getItem(savedKey);
      if (value === null) return [...fallbackSavedIds];
      const saved = JSON.parse(value);
      if (!Array.isArray(saved)) throw new TypeError("Saved resources are not stored as a list.");
      return saved.filter((id) => typeof id === "string");
    } catch (error) {
      console.error("Could not read the saved resource list.", error);
      throw new Error("I couldn’t access saved resources in this browser. Check the browser’s local storage settings.");
    }
  }

  function saveResource(resource) {
    const ids = readSavedIds();
    if (ids.includes(resource.id)) return { alreadySaved: true };
    ids.push(resource.id);
    try {
      localStorage.setItem(savedKey, JSON.stringify(ids));
      window.dispatchEvent(new StorageEvent("storage", { key: savedKey }));
      return { alreadySaved: false };
    } catch (error) {
      console.error("Could not save this resource in the browser.", error);
      throw new Error("I couldn’t save that resource. Check the browser’s local storage settings.");
    }
  }

  function routeToSavedList() {
    window.location.href = "directory.html?saved=1";
  }

  function showSavedList() {
    const ids = readSavedIds();
    return loadCatalog().then((records) => {
      const saved = records.filter((record) => ids.includes(record.id));
      if (!saved.length) {
        appendMessage("assistant", "Your saved list is empty. Ask me to save a resource, or browse the directory and use a Save button.");
        showActions([{ label: "Browse the directory", action: "navigate", value: "directory.html" }]);
        return;
      }
      const names = saved.map((record) => record.name).join("; ");
      appendMessage("assistant", `You have ${saved.length} saved resource${saved.length === 1 ? "" : "s"}: ${names}.`);
      showActions([{ label: "Open saved resources", action: "saved" }]);
    });
  }

  function startEmailDraft(text = "") {
    const draft = { body: text.trim() };
    saveEmailDraft(draft);
    if (!draft.body) {
      appendMessage("assistant", "What would you like the team to know? I’ll prepare an email draft for you to review; I won’t send it.");
      showActions([]);
      return;
    }
    appendMessage("assistant", `I can prepare this email: “${draft.body}” Choose a contact to open your email app with the message filled in. You’ll review and send it yourself.`);
    showActions([
      { label: "Draft to Vedant", action: "email", value: "vedantpanday0830@gmail.com" },
      { label: "Draft to Nishant", action: "email", value: "garikotanishant@gmail.com" }
    ]);
  }

  function openEmailDraft(address) {
    const draft = getEmailDraft();
    const subject = "COMMON community resource guide";
    const body = draft?.body || "";
    window.location.href = `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    saveEmailDraft(null);
  }

  function getDraftFromForm() {
    const form = document.getElementById("resourceSubmissionForm");
    if (!form) return;
    return Object.fromEntries([...form.elements].filter((element) => element.name).map((element) => [element.name, element.type === "checkbox" ? element.checked : element.value]));
  }

  function fillSuggestionForm(draft) {
    const form = document.getElementById("resourceSubmissionForm");
    if (!form) return;
    for (const [name, value] of Object.entries(draft.fields)) {
      const field = form.elements.namedItem(name);
      if (!field || !value || field.type === "checkbox") continue;
      if (field.tagName === "SELECT" && ![...field.options].some((option) => option.value === value || option.textContent === value)) continue;
      field.value = value;
      field.dispatchEvent(new Event(field.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
    }
  }

  function missingDraftFields(draft) {
    return requiredDraftFields.filter((field) => !String(draft.fields[field] || "").trim());
  }

  function describeNextDraftField(draft) {
    const missing = missingDraftFields(draft);
    if (missing.length) {
      const field = missing[0];
      draft.nextField = field;
      saveDraft(draft);
      const label = fieldLabels[field];
      appendMessage("assistant", `To complete the suggestion without guessing, please provide ${label}. You can also send several fields using “name: …; category: …; type: …; organization: …; description: …; area: …; source: …”.`);
      showActions([]);
      return;
    }
    draft.nextField = null;
    saveDraft(draft);
    fillSuggestionForm(draft);
    appendMessage("assistant", "I filled the resource suggestion form with the details you supplied. Please review them, check the public-information consent box, and submit the form yourself. Suggestions are saved only in this browser.");
    showActions([{ label: "Review suggestion form", action: "review-form" }]);
  }

  function normalizeCategory(value) {
    const normalized = normalize(value);
    return categories.find((category) => normalize(category) === normalized)
      || categories.find((category) => normalized === normalize(category.replace(" and ", " ")));
  }

  function parseLabeledFields(text) {
    const fields = {};
    for (const segment of text.split(/[;\n]+/)) {
      const separator = segment.indexOf(":");
      if (separator < 0) continue;
      const label = normalize(segment.slice(0, separator));
      const key = Object.keys(fieldAliases).find((field) => fieldAliases[field].some((alias) => normalize(alias) === label));
      if (key) fields[key] = segment.slice(separator + 1).trim();
    }
    if (fields.category) fields.category = normalizeCategory(fields.category) || "";
    if (fields.sourceUrl) {
      try {
        const source = new URL(fields.sourceUrl);
        fields.sourceUrl = ["http:", "https:"].includes(source.protocol) ? source.href : "";
      } catch {
        fields.sourceUrl = "";
      }
    }
    return fields;
  }

  function beginResourceDraft(initialText = "") {
    const draft = { fields: {}, nextField: "name" };
    const parsed = parseLabeledFields(initialText);
    Object.assign(draft.fields, parsed);
    saveDraft(draft);
    if (document.getElementById("resourceSubmissionForm")) {
      fillSuggestionForm(draft);
      describeNextDraftField(draft);
    } else {
      appendMessage("assistant", "I can help fill the suggestion form from details you provide. I won’t invent missing information or submit it for you.");
      showActions([{ label: "Open suggestion form", action: "navigate", value: "submit-resource.html" }]);
      if (initialText && !Object.keys(parsed).length) {
        appendMessage("user", initialText);
        appendMessage("assistant", `I’ll use that as context. Please open the form and provide the required fields: ${requiredDraftFields.map((field) => fieldLabels[field]).join(", ")}.`);
      }
    }
  }

  function continueResourceDraft(text, draft) {
    const parsed = parseLabeledFields(text);
    if (Object.keys(parsed).length) {
      Object.assign(draft.fields, parsed);
    } else if (draft.nextField) {
      let value = text.trim();
      if (draft.nextField === "category") value = normalizeCategory(value) || "";
      if (draft.nextField === "sourceUrl") {
        try {
          const source = new URL(value);
          value = ["http:", "https:"].includes(source.protocol) ? source.href : "";
        } catch {
          value = "";
        }
      }
      if (value) draft.fields[draft.nextField] = value;
      else {
        appendMessage("assistant", "I couldn’t use that value. Please send it again in the requested format; for a source, use a public http:// or https:// link.");
        return;
      }
    }
    fillSuggestionForm(draft);
    describeNextDraftField(draft);
  }

  function intentToPage(text) {
    const normalized = normalize(text);
    if (/\b(home|homepage|start page)\b/.test(normalized)) return "index.html";
    if (/\b(about|team|who made)\b/.test(normalized)) return "about.html";
    if (/\b(contact|email|message the team)\b/.test(normalized)) return "contact.html";
    if (/\b(suggest|submit|add a resource|new resource)\b/.test(normalized)) return "submit-resource.html";
    if (/\b(directory|browse|map|resource list)\b/.test(normalized)) return "directory.html";
    return "";
  }

  function handleAction(action, value) {
    if (action === "navigate") {
      window.location.href = value;
      return;
    }
    if (action === "saved") {
      routeToSavedList();
      return;
    }
    if (action === "email") {
      openEmailDraft(value);
      return;
    }
    if (action === "review-form") {
      const form = document.getElementById("resourceSubmissionForm");
      form?.scrollIntoView({ behavior: "smooth", block: "start" });
      form?.querySelector("input[required], select[required], textarea[required]")?.focus({ preventScroll: true });
      return;
    }
    if (action === "save-resource") handleResourceAction(action, value);
  }

  async function processMessage(text) {
    if (aiBusy) return;
    appendMessage("user", text);
    showActions([]);
    const normalized = normalize(text);
    const draft = getDraft();
    if (draft && document.getElementById("resourceSubmissionForm")) {
      const lower = normalized;
      if (/^(cancel|stop|never mind|nevermind)$/.test(lower)) {
        saveDraft(null);
        appendMessage("assistant", "Okay, I stopped helping with this suggestion. Anything already typed in the form remains for you to review.");
        return;
      }
      if (missingDraftFields(draft).length) {
        continueResourceDraft(text, draft);
        return;
      }
      saveDraft(null);
      if (/\b(submit|save suggestion|send it|yes,? submit)\b/.test(normalized)) {
        appendMessage("assistant", "Please review the form, confirm the public-information consent, and use its submit button when you’re ready. I never submit suggestions without your confirmation.");
        showActions([{ label: "Review suggestion form", action: "review-form" }]);
        return;
      }
    }

    if (/\b(saved resources|my saved|saved list|saved guide)\b/.test(normalized)) {
      try {
        await showSavedList();
      } catch (error) {
        appendMessage("assistant", error.message);
      }
      return;
    }

    if (/\b(save|bookmark|keep)\b/.test(normalized)) {
      const query = text.replace(/\b(save|bookmark|keep|this|that|resource|for me|please|to my list)\b/gi, "").trim();
      try {
        const matches = bestResourceMatches(query, await loadCatalog());
        if (!matches.length) {
          appendMessage("assistant", "I couldn’t match that to a directory entry. Try its exact name, or ask me to search the directory.");
          showActions([{ label: "Search the directory", action: "navigate", value: `directory.html?q=${encodeURIComponent(query)}#main` }]);
        } else if (matches.length === 1 || normalize(matches[0].name) === normalize(query)) {
          const result = saveResource(matches[0]);
          appendMessage("assistant", result.alreadySaved ? `${matches[0].name} is already in your saved list.` : `Saved ${matches[0].name} to this browser’s saved list.`);
          showActions([{ label: "Open saved resources", action: "saved" }]);
        } else {
          appendMessage("assistant", "Which of these resources should I save?");
          showActions(matches.map((resource) => ({ label: `Save ${resource.name}`, action: "save-resource", value: resource.id })));
        }
      } catch (error) {
        appendMessage("assistant", error.message || "I couldn’t load the resource list.");
      }
      return;
    }

    if (/\b(email|write an email|contact the team|message the team)\b/.test(normalized)) {
      const body = text.replace(/^(?:please\s+)?(?:(?:help me\s+)?(?:email|write an email|contact|message))(?:\s+the team)?\s*[:,.-]?\s*/i, "").trim();
      startEmailDraft(body);
      return;
    }

    if (/\b(suggest|submit|add a resource|new resource)\b/.test(normalized)) {
      window.location.href = "submit-resource.html";
      return;
    }

    const category = categoryMatch(text);
    if (/\b(search|find|look for|show me|browse)\b/.test(normalized) && !(aiReady && document.getElementById("assistantAIConsent")?.checked)) {
      let query = text.replace(/\b(search|find|look for|show me|browse|please|resources?|in the directory|directory)\b/gi, "").trim();
      if (category) query = query.replace(new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim();
      updateDirectorySearch(query, category);
      return;
    }

    if (/\b(map|locations|pinned)\b/.test(normalized)) {
      appendMessage("assistant", "The map is in the directory. It shows only resources with coordinates; listings without a verified location are not pinned.");
      showActions([{ label: "Explore the map", action: "navigate", value: "directory.html?view=map" }]);
      return;
    }

    const page = intentToPage(text);
    if (/\b(go to|open|take me|navigate)\b/.test(normalized) && page) {
      window.location.href = page;
      return;
    }

    if (await answerWithAI(text)) return;

    if (/\b(help|what can you do|how does this work)\b/.test(normalized)) {
      appendMessage("assistant", "I can find directory entries, filter the directory, save resources in this browser, show your saved list, navigate pages, prepare an email draft for a contact to review, and guide you through the resource suggestion form. I work locally, do not send email, and cannot verify current details.");
      showActions([
        { label: "Browse the directory", action: "navigate", value: "directory.html" },
        { label: "Open contact page", action: "navigate", value: "contact.html" }
      ]);
      return;
    }

    appendMessage("assistant", "I can help with searching, filters, saved resources, site pages, contact email drafts, and resource suggestions. For example: “save Suwanee Branch Library” or “email the team: I found an outdated listing.”");
    showActions([]);
  }

  function handleResourceAction(action, value) {
    if (action === "save-resource") {
      loadCatalog().then((records) => {
        const resource = records.find((record) => record.id === value);
        if (!resource) throw new Error("That resource is no longer in the catalog.");
        const result = saveResource(resource);
        appendMessage("assistant", result.alreadySaved ? `${resource.name} is already in your saved list.` : `Saved ${resource.name} to this browser’s saved list.`);
        showActions([{ label: "Open saved resources", action: "saved" }]);
      }).catch((error) => appendMessage("assistant", error.message || "I couldn’t save that resource."));
      return true;
    }
    return false;
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("assistantPanel") && !document.getElementById("assistantPanel").hidden) setOpen(false);
  });

  function init() {
    injectWidget();
    const params = new URLSearchParams(window.location.search);
    if (params.get("assistant") === "open") setOpen(true);
    const draft = getDraft();
    if (draft && document.getElementById("resourceSubmissionForm")) {
      fillSuggestionForm(draft);
      setOpen(true);
      if (missingDraftFields(draft).length && !/please provide|please send/i.test(getHistory().at(-1)?.text || "")) {
        describeNextDraftField(draft);
      }
    }
    window.addEventListener("common:resource-suggestion-saved", () => saveDraft(null));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
