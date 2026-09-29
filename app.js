"use strict";

const { terms: SEED_TERMS, categories: CATEGORIES, foreignOverrides: CURATED_FOREIGN } = window.TermCatalog;
const { normalize, unique, splitVariants, recommend, parseCSV } = window.TermCore;
const LANGUAGES = [
  { code: "en", country: "АҚШ", language: "Ағылшын тілі" },
  { code: "de", country: "Германия", language: "Неміс тілі" },
  { code: "zh", country: "Қытай", language: "Қытай тілі" },
  { code: "ko", country: "Оңтүстік Корея", language: "Корей тілі" },
  { code: "id", country: "Индонезия", language: "Индонез тілі" },
  { code: "ms", country: "Малайзия", language: "Малай тілі" }
];
const WIKI_CODES = ["kk", ...LANGUAGES.map((item) => item.code)];
const $ = (selector) => document.querySelector(selector);
const numberFormat = new Intl.NumberFormat("kk-KZ");
const CACHE_PREFIX = "terminlab-v2:";
const COUNT_TTL = 12 * 60 * 60 * 1000;
const LINK_TTL = 7 * 24 * 60 * 60 * 1000;
const CUSTOM_KEY = "terminlab-custom-v2";
let localTerms = readLocal(CUSTOM_KEY) || [];
if (!Array.isArray(localTerms)) localTerms = [];
let catalog = dedupeCatalog([...SEED_TERMS, ...(window.UserCatalog || []), ...localTerms]);
let selected = null;
let results = {};
let category = "all";
let visibleLimit = 18;
let activeRun = 0;
let requests = [];
let lookupItems = new Map();
let lastSearch = "";
let metadataError = false;
let previousSelected = null;
let webStats = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function readLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; }
}
function writeLocal(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; }
  catch (_) { return false; }
}
function cacheRead(key, ttl) {
  const item = readLocal(CACHE_PREFIX + key);
  return item && Date.now() - item.saved < ttl ? item.value : null;
}
function cacheWrite(key, value) {
  writeLocal(CACHE_PREFIX + key, { saved: Date.now(), value });
}
function dedupeCatalog(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || !item.id || !Array.isArray(item.kk) || !item.kk.length || seen.has(item.id)) return false;
    seen.add(item.id);
    item.searchIndex = normalize([...item.kk, ...(item.ru || []), item.en || ""].join(" "));
    return true;
  });
}
function cleanTitle(title) { return String(title || "").replace(/\s*\([^)]*\)\s*$/, "").replace(/_/g, " ").trim(); }
function sourceUrl(lang, phrase) {
  const params = new URLSearchParams({ search: `"${phrase.replace(/["\\]/g, "")}"`, fulltext: "1", ns0: "1" });
  return `https://${lang}.wikipedia.org/wiki/Special:Search?${params}`;
}
function googleUrl(phrase) {
  return `https://www.google.com/search?${new URLSearchParams({ q: `"${phrase.replace(/["\\]/g, "")}"` })}`;
}
function pageUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
function apiUrl(host, params) {
  return `https://${host}/w/api.php?${new URLSearchParams({ ...params, format: "json", formatversion: "2", origin: "*" })}`;
}
function stopRequests() {
  requests.forEach((request) => request.abort());
  requests = [];
  activeRun += 1;
  return activeRun;
}
async function getJSON(url) {
  const controller = new AbortController();
  requests.push(controller);
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.info || data.error.code || "API қатесі");
    return data;
  } finally {
    clearTimeout(timer);
    requests = requests.filter((item) => item !== controller);
  }
}
function cloneTerm(term) {
  const record = structuredClone(term);
  record.kk = unique(record.kk || []);
  record.ru = unique(record.ru || []);
  record.variants = { kk: [...record.kk], en: record.en ? [record.en] : [], de: [], zh: [], ko: [], id: [], ms: [] };
  record.links = record.links || {};
  return record;
}
function filterCatalog() {
  const q = normalize($("#term-input").value);
  return catalog.filter((term) => {
    if (category !== "all" && term.category !== category) return false;
    const haystack = term.searchIndex.includes(q);
    return !q || haystack;
  });
}
function renderCategories() {
  const counts = Object.fromEntries(Object.keys(CATEGORIES).map((code) => [code, catalog.filter((item) => item.category === code).length]));
  const labels = [["all", "Барлығы", catalog.length], ...Object.entries(CATEGORIES).map(([code, label]) => [code, label, counts[code]])];
  $("#category-list").innerHTML = labels.map(([code, label, count]) => `<button type="button" class="category-button ${category === code ? "active" : ""}" data-category="${escapeHTML(code)}" aria-pressed="${category === code}"><span>${escapeHTML(label)}</span><small>${numberFormat.format(count)}</small></button>`).join("");
  $("#catalog-count").textContent = numberFormat.format(catalog.length);
}
function renderCatalog() {
  const filtered = filterCatalog();
  $("#list-count").textContent = `${numberFormat.format(filtered.length)} термин`;
  $("#clear-filter").hidden = category === "all" && !$("#term-input").value;
  $("#term-list").innerHTML = filtered.slice(0, visibleLimit).map((term) => `<button type="button" class="term-row ${selected?.id === term.id ? "selected" : ""}" data-term="${escapeHTML(term.id)}" aria-current="${selected?.id === term.id ? "true" : "false"}"><span class="term-row-name">${escapeHTML(term.kk[0])}</span><span class="term-row-meta">${escapeHTML(term.ru?.[0] || term.en || "")}</span></button>`).join("") || `<p class="empty-list">Каталогта сәйкес жазба табылмады. Іздеу батырмасы арқылы Wikidata-дан қараңыз.</p>`;
  $("#show-more").hidden = filtered.length <= visibleLimit;
}
function resultKey(lang, phrase) { return `${lang}:${normalize(phrase)}`; }
function resultFor(lang, phrase) { return results[resultKey(lang, phrase)] || { state: "pending" }; }
function recommendationResults() {
  const lookup = {};
  for (const phrase of selected.variants.kk) lookup[`kk:${phrase}`] = resultFor("kk", phrase);
  return lookup;
}
function variantRow(lang, phrase, max) {
  const data = resultFor(lang, phrase);
  const count = data.state === "ready" ? numberFormat.format(data.hits) : data.state === "error" ? "—" : "…";
  const note = data.state === "error" ? "Дерек алынбады" : data.state === "pending" ? "Ізделіп жатыр" : data.fromCache ? "12 сағаттық кэш · мақала" : "мақала";
  const width = data.state === "ready" && max ? Math.round(data.hits / max * 100) : 0;
  const examples = (data.pages || []).slice(0, 2).map((title) => `<a href="${escapeHTML(pageUrl(lang, title))}" target="_blank" rel="noopener noreferrer">${escapeHTML(title)} ↗</a>`).join("");
  return `<div class="variant-item"><div class="variant-line"><div class="variant-name">${escapeHTML(phrase)}</div><div class="variant-count">${count}</div></div><div class="variant-note">${note}</div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div><div class="variant-links"><a href="${escapeHTML(sourceUrl(lang, phrase))}" target="_blank" rel="noopener noreferrer">Wikipedia іздеуі ↗</a><a href="${escapeHTML(googleUrl(phrase))}" target="_blank" rel="noopener noreferrer">Google-да ашу ↗</a>${examples}</div></div>`;
}
function variantGroup(lang, phrases) {
  const max = Math.max(0, ...phrases.map((phrase) => resultFor(lang, phrase).hits || 0));
  return phrases.map((phrase) => variantRow(lang, phrase, max)).join("");
}
function renderRecommendation() {
  const decision = recommend({ ...selected, kk: selected.variants.kk }, recommendationResults());
  const style = { verified: "РЕСМИ ДЕРЕК", observed: "АЙҚЫН БАЙҚАУ", tentative: "ШЕКТЕУЛІ БАЙҚАУ", tie: "БІРДЕЙ НӘТИЖЕ", insufficient: "ДЕРЕК ЖЕТКІЛІКСІЗ" };
  $("#confidence").textContent = style[decision.type];
  $("#confidence").className = `confidence confidence-${decision.type}`;
  $("#recommend-body").innerHTML = `${decision.phrase ? `<div class="recommended-word">${escapeHTML(decision.phrase)}</div>` : ""}<div class="recommend-title">${escapeHTML(decision.title)}</div><p>${escapeHTML(decision.reason)}</p>`;
  $("#recommend-source").innerHTML = decision.source ? `<a href="${escapeHTML(decision.source)}" target="_blank" rel="noopener noreferrer">Дереккөз: ${escapeHTML(decision.sourceLabel || "салалық тізім")} ↗</a>` : `<span>Ресми мәртебені Termincom базасынан бөлек тексеріңіз.</span>`;
}
function renderCountries() {
  $("#country-grid").innerHTML = LANGUAGES.map(({ code, country, language }) => {
    const phrases = selected.variants[code] || [];
    const title = selected.links[code];
    const note = title ? "Wikipedia-дағы байланысқан ұғым" : phrases.length ? "Енгізілген балама" : selected.metadataPending ? "Ұғым байланысы ізделіп жатыр" : "Бұл тілде байланысқан мақала табылмады";
    const available = phrases.map((phrase) => ({ phrase, data: resultFor(code, phrase) })).filter((row) => row.data.state === "ready");
    const winner = phrases.length > 1 && available.length === phrases.length ? [...available].sort((a, b) => b.data.hits - a.data.hits)[0] : null;
    const summary = winner?.data.hits ? `<div class="country-summary">Осы тілдегі ең көп нәтиже: <strong>${escapeHTML(winner.phrase)}</strong></div>` : "";
    return `<article class="country-card"><div class="country-top"><div><h3>${escapeHTML(country)}</h3><span>${escapeHTML(language)} · ${code}.wikipedia.org</span></div><b>${code.toUpperCase()}</b></div><div class="country-origin">${escapeHTML(note)}</div>${phrases.length ? `<div class="variant-list">${variantGroup(code, phrases)}</div>${summary}` : `<p class="country-empty">Атауды қосу үшін «Атауларды түзету» түймесін басыңыз.</p>`}</article>`;
  }).join("");
  const comparable = LANGUAGES.filter(({ code }) => code !== "en").map(({ code }) => {
    const phrases = selected.variants[code] || [];
    const local = selected.links[code] && cleanTitle(selected.links[code]);
    const english = phrases.find((phrase) => normalize(phrase) === normalize(selected.en));
    if (!local || !english || normalize(local) === normalize(english)) return null;
    const a = resultFor(code, local), b = resultFor(code, english);
    return a.state === "ready" && b.state === "ready" ? { local: a.hits, borrowed: b.hits } : null;
  }).filter(Boolean);
  const localLeads = comparable.filter((item) => item.local > item.borrowed).length;
  $("#cross-language").textContent = comparable.length ? `${comparable.length} тілдік жинақта жергілікті атау мен ағылшынша атауды салыстыру мүмкін болды. ${localLeads} жинақта жергілікті атау көбірек мақалада табылды. Бұл елдердің тіл саясатына баға емес.` : "Тілдер арасындағы шолу тек бір ұғымға байланысқан беттер мен осы мәтін қоры шегінде жасалады.";
}
function renderResults() {
  if (!selected) return;
  $("#results-title").textContent = selected.kk[0] || selected.en || "Жаңа термин";
  $("#result-subtitle").textContent = `${selected.ru?.[0] || "Орысша атау жоқ"} · ${selected.en || "Ағылшынша атау жоқ"}`;
  $("#kazakh-list").innerHTML = variantGroup("kk", selected.variants.kk);
  renderRecommendation();
  renderCountries();
  const values = Object.values(results);
  const pending = values.filter((item) => item.state === "pending").length;
  const errors = values.filter((item) => item.state === "error").length;
  $("#status").textContent = selected.metadataPending ? "Тілдік атаулар ізделіп жатыр…" : pending ? `${values.length - pending}/${values.length} сұрау аяқталды` : errors ? `${errors} сұраудан дерек алынбады` : `${values.length} іздеу сұрауы аяқталды`;
  if (metadataError && !selected.metadataPending && !pending) $("#status").textContent += " · Тілдік байланыс алынбады";
  const termParam = selected.ru?.[0] || selected.kk[0];
  $("#termincom-link").href = `https://termincom.kz/search/?${new URLSearchParams({ termin: termParam })}`;
  $("#wikidata-link").hidden = !selected.qid;
  if (selected.qid) $("#wikidata-link").href = `https://www.wikidata.org/wiki/${selected.qid}`;
  renderWebStats();
}
function renderWebStats() {
  const data = selected && webStats?.terms?.[selected.id];
  const records = Array.isArray(data?.records) ? data.records.filter((item) => Number.isFinite(item.estimate) && item.estimate >= 0) : [];
  $("#web-panel").hidden = !records.length;
  if (!records.length) return;
  $("#web-data").innerHTML = records.slice(0, 20).map((item) => `<div class="web-figure"><span>${escapeHTML(item.lang.toUpperCase())} · ${escapeHTML(item.phrase)}</span><strong>≈ ${numberFormat.format(item.estimate)}</strong></div>`).join("");
  $("#web-date").textContent = `Жиналған күні: ${webStats.generated_at || "белгісіз"}. Іздеу орны мен тілі нәтижеге әсер етеді.`;
}
async function resolveLanguages(record, run) {
  if (record.links && Object.keys(record.links).length) return record.links;
  if (!record.wiki) return {};
  const key = `links:${record.wiki}`;
  const saved = cacheRead(key, LINK_TTL);
  if (saved) { record.qid = saved.qid; return saved.links; }
  const url = apiUrl("en.wikipedia.org", { action: "query", prop: "langlinks|pageprops", titles: record.wiki, redirects: "1", lllimit: "max", ppprop: "wikibase_item" });
  const data = await getJSON(url);
  if (run !== activeRun) return {};
  const page = data.query?.pages?.[0];
  if (!page || page.missing) throw new Error("Ағылшынша мақала табылмады");
  const links = { en: page.title };
  for (const item of page.langlinks || []) if (WIKI_CODES.includes(item.lang)) links[item.lang] = item.title;
  record.qid = page.pageprops?.wikibase_item || null;
  cacheWrite(key, { links, qid: record.qid });
  return links;
}
function populateVariants(record, links) {
  record.links = links;
  const existing = record.variants || {};
  const official = record.verified;
  record.variants = { kk: unique([...(existing.kk || record.kk), ...(links.kk ? [cleanTitle(links.kk)] : [])], 5) };
  for (const { code } of LANGUAGES) {
    if (code === "en") {
      record.variants.en = unique([...(existing.en || []), record.en], 3);
      continue;
    }
    const linked = links[code] ? cleanTitle(links[code]) : "";
    const curated = CURATED_FOREIGN[record.id]?.[code] || [];
    record.variants[code] = linked || curated.length ? unique([linked, ...curated, record.en], 3) : [];
  }
  const edited = readLocal(`terminlab-overrides-v2:${record.id}`);
  if (edited && typeof edited === "object") for (const code of WIKI_CODES) if (Array.isArray(edited[code])) record.variants[code] = unique(edited[code]);
  record.verified = official;
}
async function fetchCount(lang, phrase, force) {
  const cacheKey = `count:${lang}:${normalize(phrase)}`;
  const saved = !force && cacheRead(cacheKey, COUNT_TTL);
  if (saved) return { ...saved, state: "ready", fromCache: true };
  const url = apiUrl(`${lang}.wikipedia.org`, { action: "query", list: "search", srsearch: `"${phrase.replace(/["\\]/g, "")}"`, srnamespace: "0", srwhat: "text", srinfo: "totalhits", srlimit: "2" });
  const data = await getJSON(url);
  const hits = data.query?.searchinfo?.totalhits;
  if (!Number.isFinite(hits)) throw new Error("Іздеу саны жоқ");
  const value = { hits, pages: (data.query.search || []).map((page) => page.title).filter(Boolean) };
  cacheWrite(cacheKey, value);
  return { ...value, state: "ready", fromCache: false };
}
async function runCounts(run, force = false) {
  const searches = WIKI_CODES.flatMap((code) => (selected.variants[code] || []).map((phrase) => ({ code, phrase })));
  results = Object.fromEntries(searches.map(({ code, phrase }) => [resultKey(code, phrase), { state: "pending" }]));
  $("#result-date").textContent = `Тексеру: ${new Intl.DateTimeFormat("kk-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qyzylorda" }).format(new Date())}`;
  renderResults();
  let next = 0;
  async function worker() {
    while (next < searches.length && run === activeRun) {
      const { code, phrase } = searches[next++];
      try {
        const value = await fetchCount(code, phrase, force);
        if (run === activeRun) results[resultKey(code, phrase)] = value;
      } catch (_) {
        if (run === activeRun) results[resultKey(code, phrase)] = { state: "error" };
      }
      if (run === activeRun) renderResults();
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, searches.length) }, worker));
}
async function selectTerm(term, { scroll = false, force = false } = {}) {
  const run = stopRequests();
  hideLookup();
  hideEditor();
  metadataError = false;
  selected = cloneTerm(term);
  selected.metadataPending = Boolean(selected.wiki || Object.keys(selected.links).length);
  $("#result-date").textContent = "";
  results = {};
  $(".results").hidden = false;
  renderCatalog();
  renderResults();
  if (!term.id.startsWith("custom-") && !term.id.startsWith("Q")) {
    const parameters = new URLSearchParams(location.search);
    parameters.set("term", term.id);
    history.replaceState(null, "", `${location.pathname}?${parameters}${location.hash}`);
  }
  if (scroll && window.innerWidth < 960) $(".results").scrollIntoView({ behavior: "smooth", block: "start" });
  let links = selected.links;
  try { links = await resolveLanguages(selected, run); }
  catch (_) { metadataError = true; links = {}; }
  if (run !== activeRun) return;
  populateVariants(selected, links);
  selected.metadataPending = false;
  await runCounts(run, force);
}
function showEditor() {
  if (!selected) return;
  $("#editor").hidden = false;
  for (const code of WIKI_CODES) $(`#variants-${code}`).value = (selected.variants[code] || []).join(", ");
  $("#editor-error").textContent = "";
  $("#editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
  $("#variants-kk").focus({ preventScroll: true });
}
function hideEditor() { $("#editor").hidden = true; }
function hideLookup() { $("#lookup").hidden = true; }
async function searchWikidata(input) {
  const run = stopRequests();
  lastSearch = input;
  hideEditor();
  $("#lookup").hidden = false;
  $("#lookup-status").textContent = `«${input}» атауы бойынша ұғым ізделіп жатыр…`;
  $("#lookup-options").innerHTML = "";
  $("#lookup").scrollIntoView({ behavior: "smooth", block: "nearest" });
  const languages = /[а-яәіңғүұқөһё]/i.test(input) ? ["kk", "ru"] : ["en"];
  try {
    const batches = await Promise.allSettled(languages.map(async (language) => {
      const url = apiUrl("www.wikidata.org", { action: "wbsearchentities", search: input, language, type: "item", limit: "6" });
      const data = await getJSON(url);
      return data.search || [];
    }));
    if (run !== activeRun) return;
    if (!batches.some((batch) => batch.status === "fulfilled")) throw new Error("Wikidata жауап бермеді");
    lookupItems = new Map(batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []).filter((item) => /^Q\d+$/.test(item.id)).map((item) => [item.id, item]));
    $("#lookup-status").textContent = lookupItems.size ? `${lookupItems.size} ықтимал ұғым табылды. Мағынасы дәл келетінін таңдаңыз.` : "Сәйкес ұғым табылмады. Баламаларды өзіңіз енгізе аласыз.";
    $("#lookup-options").innerHTML = [...lookupItems.values()].map((item) => `<button class="lookup-option" type="button" data-qid="${item.id}"><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.description || "Сипаттама берілмеген")} · ${item.id}</small></button>`).join("");
  } catch (_) {
    if (run === activeRun) $("#lookup-status").textContent = "Wikidata-ға қосылу мүмкін болмады. Баламаларды қолмен енгізіңіз.";
  }
}
async function chooseWikidata(qid) {
  if (!lookupItems.has(qid)) return;
  const run = stopRequests();
  $("#lookup-status").textContent = "Байланысқан тілдік атаулар тексеріліп жатыр…";
  try {
    const url = apiUrl("www.wikidata.org", { action: "wbgetentities", ids: qid, props: "labels|sitelinks", languages: "kk|ru|en|de|zh|ko|id|ms", sitefilter: WIKI_CODES.map((code) => `${code}wiki`).join("|") });
    const data = await getJSON(url);
    if (run !== activeRun) return;
    const entity = data.entities?.[qid];
    if (!entity || entity.missing) throw new Error("Ұғым табылмады");
    const label = (code) => entity.labels?.[code]?.value || "";
    const links = Object.fromEntries(WIKI_CODES.map((code) => [code, entity.sitelinks?.[`${code}wiki`]?.title]).filter(([, value]) => value));
    const record = { id: qid, category: "external", kk: unique([label("kk"), cleanTitle(links.kk)]), ru: unique([label("ru")]), en: label("en") || cleanTitle(links.en), wiki: links.en || "", links, qid, sourceType: "Wikidata" };
    if (!record.kk.length) {
      previousSelected = selected && structuredClone(selected);
      selected = cloneTerm({ ...record, kk: [lastSearch] });
      selected.variants.kk = [];
      hideLookup();
      $(".results").hidden = true;
      showEditor();
      $("#editor-error").textContent = "Қазақша балама табылмады. Дәл қазақша нұсқаны енгізіңіз.";
      return;
    }
    await selectTerm(record, { scroll: true });
  } catch (_) {
    if (run === activeRun) $("#lookup-status").textContent = "Ұғым байланысы алынбады. Баламаларды қолмен енгізе аласыз.";
  }
}
function newManualTerm() {
  const phrase = lastSearch || $("#term-input").value.trim();
  previousSelected = selected && structuredClone(selected);
  selected = cloneTerm({ id: `custom-${Date.now()}`, category: "external", kk: [phrase], ru: [], en: "", wiki: "", sourceType: "пайдаланушы енгізген" });
  selected.variants.kk = /[әіңғүұқөһ]/i.test(phrase) ? [phrase] : [];
  hideLookup();
  $(".results").hidden = true;
  showEditor();
}
function addImportedRows(text) {
  const rows = parseCSV(text.replace(/^\uFEFF/, ""));
  const header = rows.shift()?.map((cell) => cell.trim().toLowerCase());
  const required = ["category", "kk", "kk_alt", "ru", "en", "wiki"];
  if (!header || required.some((field) => !header.includes(field))) throw new Error(`CSV бағандары: ${required.join(", ")}`);
  const entries = rows.map((row, index) => {
    const get = (field) => (row[header.indexOf(field)] || "").trim();
    const kk = unique([get("kk"), ...splitVariants(get("kk_alt"))]);
    const ru = splitVariants(get("ru"));
   const en = get("en");
    if (!kk.length || en.length > 90) throw new Error(`${index + 2}-жол: қазақша атау қажет; ағылшынша атау 90 таңбадан аспасын`);
    const name = get("category");
    const identity = [en, kk[0], ru[0]].map((part) => normalize(part || "")).join("|");
    const suffix = [...identity].reduce((hash, char) => Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0, 2166136261).toString(36);
    return { id: `import-${suffix}`, category: CATEGORIES[name] ? name : "other", kk, ru, en, wiki: get("wiki"), sourceType: "CSV импорт" };
  });
  if (entries.length > 2000) throw new Error("Браузерге бір жолы 2000 терминге дейін жүктеңіз; үлкен қорды жариялау үшін tools/build_catalog.py пайдаланыңыз");
  localTerms = dedupeCatalog([...entries, ...localTerms]).slice(0, 2000);
  const persisted = writeLocal(CUSTOM_KEY, localTerms);
  catalog = dedupeCatalog([...SEED_TERMS, ...(window.UserCatalog || []), ...localTerms]);
  renderCategories(); renderCatalog();
  return { count: entries.length, persisted };
}

$("#term-input").addEventListener("input", () => { visibleLimit = 18; renderCatalog(); });
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const query = $("#term-input").value.trim();
  if (!query) return;
  const exact = catalog.find((term) => [...term.kk, ...(term.ru || []), term.en || ""].some((word) => normalize(word) === normalize(query)));
  if (exact) { selectTerm(exact, { scroll: true }); return; }
  const matches = filterCatalog();
  if (matches.length === 1) { selectTerm(matches[0], { scroll: true }); return; }
  if (matches.length > 1) { $("#catalogue").scrollIntoView({ behavior: "smooth" }); return; }
  searchWikidata(query);
});
$("#category-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  category = button.dataset.category;
  visibleLimit = 18;
  renderCategories(); renderCatalog();
});
$("#term-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-term]");
  if (!button) return;
  const term = catalog.find((item) => item.id === button.dataset.term);
  if (term) selectTerm(term, { scroll: true });
});
$("#show-more").addEventListener("click", () => { visibleLimit += 30; renderCatalog(); });
$("#clear-filter").addEventListener("click", () => { category = "all"; $("#term-input").value = ""; visibleLimit = 18; renderCategories(); renderCatalog(); });
$("#edit-button").addEventListener("click", showEditor);
$("#refresh-button").addEventListener("click", () => { if (selected) selectTerm(selected, { force: true }); });
$("#close-editor").addEventListener("click", () => {
  hideEditor();
  if ($(".results").hidden && previousSelected) { selected = previousSelected; previousSelected = null; renderResults(); }
  $(".results").hidden = false;
});
$("#close-lookup").addEventListener("click", hideLookup);
$("#manual-button").addEventListener("click", newManualTerm);
$("#lookup-options").addEventListener("click", (event) => {
  const button = event.target.closest("[data-qid]");
  if (button) chooseWikidata(button.dataset.qid);
});
$("#variants-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!selected) return;
  const variants = Object.fromEntries(WIKI_CODES.map((code) => [code, splitVariants($(`#variants-${code}`).value)]));
  if (!variants.kk.length) { $("#editor-error").textContent = "Кемінде бір қазақша атауды енгізіңіз."; return; }
  selected.variants = variants;
  selected.kk = variants.kk;
  if (variants.en.length) selected.en = variants.en[0];
  writeLocal(`terminlab-overrides-v2:${selected.id}`, variants);
  if (selected.id.startsWith("custom-")) {
    localTerms.push({ id: selected.id, category: "other", kk: selected.kk, ru: selected.ru, en: selected.en, wiki: selected.wiki || "", sourceType: "пайдаланушы енгізген" });
    writeLocal(CUSTOM_KEY, localTerms);
    catalog = dedupeCatalog([...SEED_TERMS, ...(window.UserCatalog || []), ...localTerms]);
    renderCategories();
  }
  hideEditor();
  previousSelected = null;
  $(".results").hidden = false;
  renderCatalog();
  runCounts(stopRequests());
});
$("#csv-import").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error("CSV 2 МБ-тан аспауы керек");
    const added = addImportedRows(await file.text());
    $("#import-status").textContent = `${added.count} термин қосылды${added.persisted ? " және осы браузерде сақталды" : "; браузер жадына сақтау мүмкін болмады"}.`;
  } catch (error) { $("#import-status").textContent = `Импорт қатесі: ${error.message}`; }
  event.target.value = "";
});
document.querySelectorAll("[data-pick]").forEach((button) => button.addEventListener("click", () => {
  const term = catalog.find((item) => item.id === button.dataset.pick);
  if (term) { $("#term-input").value = ""; selectTerm(term, { scroll: true }); }
}));

renderCategories();
const requested = new URLSearchParams(location.search).get("term");
selectTerm(catalog.find((item) => item.id === requested) || catalog[0]);
fetch("./data/web-stats.json").then((response) => response.ok ? response.json() : null).then((data) => {
  if (data?.provider === "SerpApi Google Search" && data.terms) { webStats = data; renderWebStats(); }
}).catch(() => { /* Web estimates are optional. */ });
