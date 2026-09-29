const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const wait = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

function harness({ failCounts = false } = {}) {
  const elements = new Map();
  const get = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      value: "", hidden: selector === "#editor" || selector === "#lookup",
      textContent: "", innerHTML: "", href: "", className: "", events: {},
      addEventListener(event, callback) { this.events[event] = callback; },
      scrollIntoView() {}, focus() {}
    });
    return elements.get(selector);
  };
  const picks = ["hdd", "mouse", "database", "artificial-intelligence"].map((id) => {
    const element = get(`pick:${id}`); element.dataset = { pick: id }; return element;
  });
  const storage = new Map();
  const browser = { innerWidth: 1440 };
  const calls = [];
  const fetch = async (url) => {
    const parsed = new URL(url);
    calls.push(parsed);
    assert.equal(parsed.searchParams.get("origin"), "*");
    let data;
    if (parsed.searchParams.get("prop")?.includes("langlinks")) {
      data = { query: { pages: [{ title: parsed.searchParams.get("titles"), pageprops: { wikibase_item: "Q4439" }, langlinks: [
        { lang: "kk", title: "Қатқыл диск" }, { lang: "de", title: "Festplatte" },
        { lang: "zh", title: "硬盘" }, { lang: "ko", title: "하드 디스크 드라이브" },
        { lang: "id", title: "Cakram keras" }, { lang: "ms", title: "Cakera keras" }
      ] }] } };
    } else if (parsed.searchParams.get("action") === "wbsearchentities") {
      data = { search: [{ id: "Q999", label: "New device", description: "example concept" }] };
    } else if (parsed.searchParams.get("action") === "wbgetentities") {
      data = { entities: { Q999: { labels: { kk: { value: "Жаңа құрылғы" }, en: { value: "new device" }, ru: { value: "новое устройство" } }, sitelinks: { enwiki: { title: "New device" }, dewiki: { title: "Neues Gerät" } } } } };
    } else {
      if (failCounts) throw new Error("Network unavailable");
      assert.equal(parsed.searchParams.get("srnamespace"), "0");
      assert(parsed.searchParams.get("srsearch").startsWith('"'));
      const query = parsed.searchParams.get("srsearch");
      data = { query: { searchinfo: { totalhits: query.includes("қатқыл") ? 30 : query.includes("қатты диск") ? 10 : 5 }, search: [{ title: "Мысал беті" }] } };
    }
    return { ok: true, json: async () => data };
  };
  const context = vm.createContext({
    window: browser, document: { querySelector: get, querySelectorAll: () => picks },
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    location: { pathname: "/termin/", search: "", hash: "" }, history: { replaceState() {} },
    fetch, URL, URLSearchParams, Intl, AbortController, structuredClone, setTimeout, clearTimeout
  });
  for (const file of ["catalog.js", "catalog-user.js", "core.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return { get, picks, calls, browser, context };
}

async function until(check) {
  for (let i = 0; i < 60; i += 1) { if (check()) return; await wait(); }
  throw new Error("User-facing result did not settle");
}

(async () => {
  const h = harness();
  assert.equal(h.browser.TermCatalog.terms.length, 133);
  await until(() => h.get("#status").textContent.includes("іздеу сұрауы аяқталды"));
  assert.equal(h.get("#results-title").textContent, "қатқыл диск");
  assert(h.get("#country-grid").innerHTML.includes("Оңтүстік Корея"));
  assert(h.get("#recommend-body").innerHTML.includes("қатқыл диск"));
  assert(h.calls.some((call) => call.hostname === "zh.wikipedia.org"));

  h.picks[1].events.click();
  await until(() => h.get("#confidence").textContent === "РЕСМИ ДЕРЕК" && h.get("#status").textContent.includes("іздеу сұрауы аяқталды"));
  assert(h.get("#recommend-source").innerHTML.includes("termincom.kz"));

  h.get("#term-input").value = "жаңа құрылғы";
  h.get("#search-form").events.submit({ preventDefault() {} });
  await until(() => h.get("#lookup-options").innerHTML.includes("Q999"));
  await vm.runInContext('chooseWikidata("Q999")', h.context);
  await until(() => h.get("#results-title").textContent === "Жаңа құрылғы" && h.get("#status").textContent.includes("іздеу сұрауы аяқталды"));
  assert(h.get("#country-grid").innerHTML.includes("Neues Gerät"));
  assert(h.get("#recommend-body").innerHTML.includes("Тексерілген жалғыз нұсқа"));

  const imported = vm.runInContext('addImportedRows("category,kk,kk_alt,ru,en,wiki\\nhardware,ойын контроллері,геймпад,геймпад,game controller,Game controller\\n")', h.context);
  assert.equal(imported.count, 1);
  assert.equal(imported.persisted, true);
  const withoutEnglish = vm.runInContext('addImportedRows("category,kk,kk_alt,ru,en,wiki\\nnetwork,жаңа желілік атау,балама,новый сетевой термин,,\\n")', h.context);
  assert.equal(withoutEnglish.count, 1);
  h.get("#term-input").value = "жаңа желілік атау";
  h.get("#term-input").events.input();
  assert(h.get("#term-list").innerHTML.includes("жаңа желілік атау"));

  const errors = harness({ failCounts: true });
  await until(() => errors.get("#status").textContent.includes("дерек алынбады"));
  assert(errors.get("#kazakh-list").innerHTML.includes("Дерек алынбады"));
  assert(errors.get("#recommend-body").innerHTML.includes("дерек жеткіліксіз"));
  console.log("Catalog, linked languages, recommendation, import, and unavailable-source states passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
