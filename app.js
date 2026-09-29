"use strict";

// Curated starting points only. Live counts always come from the API below.
const EXAMPLES = {
  "hard-disk": {
    name: "Қатқыл диск",
    description: "Дерек сақтау құрылғысы · hard disk drive",
    aliases: ["жесткий диск", "жёсткий диск", "қатқыл диск", "қатты диск", "hard disk", "hard drive", "hdd", "винчестер"],
    source: "https://www.wikidata.org/wiki/Q4439",
    variants: { kk: ["қатқыл диск", "қатты диск", "жесткий диск"], id: ["cakram keras", "hard disk"], ms: ["cakera keras", "hard disk"], zh: ["硬盘", "hard disk"] }
  },
  mouse: {
    name: "Тінтуір",
    description: "Компьютердің меңзегіш құрылғысы · computer mouse",
    aliases: ["тінтуір", "компьютерлік тышқан", "мышка", "компьютерная мышь", "mouse", "computer mouse"],
    source: "https://www.wikidata.org/wiki/Q7987",
    variants: { kk: ["тінтуір", "компьютерлік тышқан", "мышка"], id: ["tetikus", "mouse komputer"], ms: ["tetikus", "mouse komputer"], zh: ["鼠标", "滑鼠"] }
  }
};

const LANGUAGES = [
  { code: "kk", label: "Қазақстан", language: "Қазақ тілі" },
  { code: "id", label: "Индонезия", language: "Индонез тілі" },
  { code: "ms", label: "Малайзия", language: "Малай тілі" },
  { code: "zh", label: "Қытай", language: "Қытай тілі" }
];
const $ = (selector) => document.querySelector(selector);
const fmt = new Intl.NumberFormat("kk-KZ");
let current = cloneExample("hard-disk");
let currentKey = "hard-disk";
let results = {};
let requestNumber = 0;
let controllers = [];
let committed = null;

function cloneExample(key) {
  const example = EXAMPLES[key];
  return { ...example, variants: Object.fromEntries(Object.entries(example.variants).map(([lang, words]) => [lang, [...words]])) };
}

function safeText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function normalize(value) {
  return value.toLocaleLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function queryUrl(lang, phrase, api = false) {
  const clean = phrase.replace(/["\\]/g, "").trim();
  if (api) {
    const parameters = new URLSearchParams({ action: "query", list: "search", srsearch: `"${clean}"`, srwhat: "text", srnamespace: "0", srinfo: "totalhits", srlimit: "2", format: "json", formatversion: "2", origin: "*" });
    return `https://${lang}.wikipedia.org/w/api.php?${parameters}`;
  }
  const parameters = new URLSearchParams({ search: `"${clean}"`, fulltext: "1", ns0: "1" });
  return `https://${lang}.wikipedia.org/wiki/Special:Search?${parameters}`;
}

function pageUrl(lang, title) {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

function fieldVariants(value) {
  const seen = new Set();
  return value.split(/[,;，\n]+/).map((item) => item.trim()).filter((item) => {
    const key = normalize(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function showEditor(open) {
  $("#editor").hidden = !open;
  if (open) {
    for (const { code } of LANGUAGES) $(`#variants-${code}`).value = (current.variants[code] || []).join(", ");
    $("#editor-error").textContent = "";
    $("#editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
    $("#variants-kk").focus({ preventScroll: true });
  }
}

function selectExample(key) {
  if (key === "custom-filter") {
    currentKey = null;
    current = { name: "Желілік сүзгі", description: "Мағынасы мен шетел тіліндегі дәл баламасын енгізіңіз", source: null, variants: { kk: ["желілік сүзгі", "сетевой фильтр"], id: [], ms: [], zh: [] } };
    $("#term-input").value = "Желілік сүзгі";
    showEditor(true);
    $(".results").hidden = true;
    return;
  }
  currentKey = key;
  current = cloneExample(key);
  $("#term-input").value = key === "hard-disk" ? "Жесткий диск" : "Тінтуір";
  showEditor(false);
  const parameters = new URLSearchParams(location.search);
  parameters.set("term", key);
  history.replaceState(null, "", `${location.pathname}?${parameters}${location.hash}`);
  analyze();
}

function renderVariant(phrase, lang, groupMax) {
  const key = `${lang}:${phrase}`;
  const result = results[key] || { state: "pending" };
  const label = result.state === "ready" ? fmt.format(result.hits) : result.state === "error" ? "—" : "…";
  const note = result.state === "error" ? "Дерек алынбады" : result.state === "pending" ? "Ізделіп жатыр" : "мақала";
  const width = result.state === "ready" && groupMax ? Math.max(0, result.hits / groupMax * 100) : 0;
  const searchLink = `<a href="${safeText(queryUrl(lang, phrase))}" target="_blank" rel="noopener noreferrer">Іздеуді ашу ↗</a>`;
  const pages = (result.pages || []).map((title) => `<a href="${safeText(pageUrl(lang, title))}" target="_blank" rel="noopener noreferrer">${safeText(title)} ↗</a>`).join("");
  return `<div class="variant-item"><div class="variant-line"><div><div class="variant-name">${safeText(phrase)}</div><div class="variant-note">${note}</div></div><div class="variant-count ${result.state === "pending" ? "pending" : ""}">${label}</div></div><div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${width}%"></div></div><div class="variant-links">${searchLink}${pages}</div></div>`;
}

function renderGroup(phrases, lang) {
  const hits = phrases.map((phrase) => results[`${lang}:${phrase}`]?.hits || 0);
  const max = Math.max(...hits, 0);
  return phrases.map((phrase) => renderVariant(phrase, lang, max)).join("");
}

function buildAnalysis() {
  const kk = current.variants.kk;
  const rows = kk.map((phrase) => ({ phrase, ...(results[`kk:${phrase}`] || { state: "pending" }) }));
  if (rows.some((row) => row.state === "pending")) return "<p>Қазақша және басқа тілдердегі мәтіндерден дерек алынып жатыр…</p>";
  const available = rows.filter((row) => row.state === "ready");
  if (!available.length) return "<p>Қазақ тіліндегі дереккөзге қосылу мүмкін болмады. Қайта тексеріп көріңіз немесе әр нұсқаның іздеу сілтемесін ашыңыз.</p>";
  if (available.every((row) => row.hits === 0)) return "<p>Енгізілген қазақша тіркестер бұл дереккөзден табылмады. Бұл олардың жалпы қолданыста жоқ екенін білдірмейді: қамтылған мәтіндер шектеулі.</p>";

  const ordered = [...available].sort((a, b) => b.hits - a.hits);
  const top = ordered.filter((row) => row.hits === ordered[0].hits);
  const leader = top.length > 1
    ? `Қазақша Wikipedia іздеуінде <strong>${top.map((row) => `«${safeText(row.phrase)}»`).join(" және ")}</strong> бірдей нәтиже берді (${fmt.format(top[0].hits)} мақала).`
    : `Қазақша Wikipedia іздеуінде <strong>«${safeText(top[0].phrase)}»</strong> осы нұсқалардың ішінде көбірек мақалада табылды (${fmt.format(top[0].hits)}).`;
  const otherLanguages = LANGUAGES.slice(1).map(({ code, label }) => {
    const options = current.variants[code] || [];
    if (!options.length) return null;
    const values = options.map((phrase) => ({ phrase, ...(results[`${code}:${phrase}`] || { state: "pending" }) }));
    if (values.some((row) => row.state !== "ready")) return null;
    const biggest = [...values].sort((a, b) => b.hits - a.hits)[0];
    return biggest.hits > 0 ? `${label}: «${safeText(biggest.phrase)}» (${fmt.format(biggest.hits)})` : null;
  }).filter(Boolean);
  const international = otherLanguages.length ? `<p>Өз тілдік жинақтарындағы ең көп нәтиже: ${otherLanguages.join("; ")}.</p>` : "";
  const partial = rows.some((row) => row.state === "error") ? "<p>Кейбір қазақша нұсқалардың дерегі алынбады, сондықтан бұл салыстыру толық емес.</p>" : "";
  return `<p>${leader}</p>${international}${partial}<p>Бұл байқау тек таңдалған Wikipedia мәтіндеріне қатысты.</p>`;
}

function render() {
  $("#results-title").textContent = current.name;
  $("#concept-description").textContent = current.description;
  $("#term-source").hidden = !current.source;
  if (current.source) $("#term-source").href = current.source;
  $("#kazakh-list").innerHTML = renderGroup(current.variants.kk, "kk");
  $("#analysis-body").innerHTML = buildAnalysis();
  $("#country-grid").innerHTML = LANGUAGES.slice(1).map(({ code, label, language }) => {
    const phrases = current.variants[code] || [];
    const contents = phrases.length ? `<div class="variant-list">${renderGroup(phrases, code)}</div>` : `<p class="country-empty">Бұл тіл үшін балама енгізілмеген. «Нұсқаларды өзгерту» батырмасы арқылы қосыңыз.</p>`;
    return `<article class="country-card" aria-label="${safeText(label)}"><div class="country-top"><div><div class="country-name">${safeText(label)}</div><div class="country-lang">${safeText(language)} · ${code}.wikipedia.org</div></div><span class="country-code">${code.toUpperCase()}</span></div>${contents}</article>`;
  }).join("");
  const all = Object.values(results);
  const pending = all.filter((item) => item.state === "pending").length;
  const failed = all.filter((item) => item.state === "error").length;
  $("#status").textContent = pending ? `Тексеріліп жатыр: ${all.length - pending}/${all.length} сұрау аяқталды` : failed ? `${failed} сұраудан дерек алынбады. Сілтеме арқылы тексеруге болады.` : `Тексеру аяқталды · ${all.length} іздеу сұрауы`;
}

async function fetchCount(lang, phrase, signal) {
  const response = await fetch(queryUrl(lang, phrase, true), { signal, credentials: "omit" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (data.error || !Number.isFinite(data.query?.searchinfo?.totalhits)) throw new Error("Іздеу нәтижесі жоқ");
  return { hits: data.query.searchinfo.totalhits, pages: (data.query.search || []).map((page) => page.title).filter(Boolean) };
}

function analyze() {
  controllers.forEach((controller) => controller.abort());
  controllers = [];
  const run = ++requestNumber;
  results = {};
  const searches = LANGUAGES.flatMap(({ code }) => (current.variants[code] || []).map((phrase) => ({ code, phrase })));
  committed = { term: structuredClone(current), key: currentKey, input: $("#term-input").value };
  $(".results").hidden = false;
  searches.forEach(({ code, phrase }) => { results[`${code}:${phrase}`] = { state: "pending" }; });
  $("#result-date").textContent = new Intl.DateTimeFormat("kk-KZ", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Qyzylorda" }).format(new Date());
  render();
  searches.forEach(async ({ code, phrase }) => {
    const controller = new AbortController();
    controllers.push(controller);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const data = await fetchCount(code, phrase, controller.signal);
      if (run === requestNumber) results[`${code}:${phrase}`] = { state: "ready", ...data };
    } catch (_error) {
      if (run === requestNumber) results[`${code}:${phrase}`] = { state: "error" };
    } finally {
      clearTimeout(timeout);
      if (run === requestNumber) render();
    }
  });
}

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = $("#term-input").value.trim();
  if (!input) return;
  const match = Object.entries(EXAMPLES).find(([, record]) => record.aliases.some((alias) => normalize(alias) === normalize(input)));
  if (match) return selectExample(match[0]);
  currentKey = null;
  current = { name: input, description: "Қазақша және басқа тілдердегі нұсқаларды енгізіңіз", source: null, variants: { kk: [], id: [], ms: [], zh: [] } };
  showEditor(true);
  $(".results").hidden = true;
});

document.querySelectorAll("[data-example]").forEach((button) => button.addEventListener("click", () => selectExample(button.dataset.example)));
$("#edit-button").addEventListener("click", () => showEditor(true));
$("#close-editor").addEventListener("click", () => {
  if ($(".results").hidden && committed) {
    current = structuredClone(committed.term);
    currentKey = committed.key;
    $("#term-input").value = committed.input;
    $(".results").hidden = false;
  }
  showEditor(false);
});
$("#refresh-button").addEventListener("click", analyze);
$("#variants-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const variants = Object.fromEntries(LANGUAGES.map(({ code }) => [code, fieldVariants($(`#variants-${code}`).value)]));
  if (!variants.kk.length) {
    $("#editor-error").textContent = "Кемінде бір қазақша нұсқа енгізіңіз.";
    return;
  }
  if (Object.values(variants).some((items) => items.length > 5 || items.some((item) => item.length > 80))) {
    $("#editor-error").textContent = "Әр тілге 5 нұсқаға дейін, әр нұсқаға 80 таңбаға дейін енгізіңіз.";
    return;
  }
  current.variants = variants;
  current.description = currentKey ? EXAMPLES[currentKey].description : "Пайдаланушы енгізген баламалар";
  showEditor(false);
  analyze();
});

const initial = new URLSearchParams(location.search).get("term");
selectExample(Object.hasOwn(EXAMPLES, initial) ? initial : "hard-disk");
