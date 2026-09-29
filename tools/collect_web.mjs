// Optional administrator job. Uses a private SerpApi key and writes only
// published estimates; no key is ever sent to the browser or stored in JSON.
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES = {
  kk: { gl: "kz", hl: "kk-kz" }, en: { gl: "us", hl: "en" },
  de: { gl: "de", hl: "de" }, zh: { gl: "cn", hl: "zh-cn" },
  ko: { gl: "kr", hl: "ko" }, id: { gl: "id", hl: "id" }, ms: { gl: "my", hl: "ms" }
};

export function parseEstimate(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

export function buildQueryPlan(term, links, overrides = {}) {
  const result = [];
  const used = new Set();
  const add = (lang, phrase) => {
    const clean = String(phrase || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    const key = `${lang}:${clean.toLocaleLowerCase()}`;
    if (!clean || clean.length > 90 || used.has(key)) return;
    used.add(key);
    result.push({ lang, phrase: clean, ...LOCALES[lang] });
  };
  for (const phrase of term.kk) add("kk", phrase);
  add("en", term.en);
  for (const lang of ["de", "zh", "ko", "id", "ms"]) {
    const local = links[lang];
    if (!local && !overrides[lang]) continue;
    add(lang, local);
    for (const phrase of overrides[lang] || []) add(lang, phrase);
    add(lang, term.en);
  }
  return result;
}

async function catalog() {
  const context = { window: {} };
  vm.runInNewContext(await fs.readFile(path.join(ROOT, "catalog.js"), "utf8"), context);
  vm.runInNewContext(await fs.readFile(path.join(ROOT, "catalog-user.js"), "utf8"), context);
  return {
    terms: [...context.window.TermCatalog.terms, ...(context.window.UserCatalog || [])],
    overrides: context.window.TermCatalog.foreignOverrides
  };
}

async function linkedTitles(term) {
  if (!term.wiki) return {};
  const params = new URLSearchParams({ action: "query", prop: "langlinks", titles: term.wiki, redirects: "1", lllimit: "max", format: "json", formatversion: "2" });
  const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, { signal: AbortSignal.timeout(16000) });
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  const body = await response.json();
  const page = body.query?.pages?.[0];
  if (!page || page.missing) return {};
  return Object.fromEntries((page.langlinks || []).filter((item) => item.lang in LOCALES).map((item) => [item.lang, item.title]));
}

async function estimate(query, key) {
  const params = new URLSearchParams({ engine: "google", q: `"${query.phrase.replace(/["\\]/g, "")}"`, gl: query.gl, hl: query.hl, api_key: key });
  const response = await fetch(`https://serpapi.com/search.json?${params}`, { signal: AbortSignal.timeout(35000) });
  if (!response.ok) throw new Error(`SerpApi HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`SerpApi: ${String(body.error).slice(0, 100)}`);
  const count = parseEstimate(body.search_information?.total_results);
  if (count === null) throw new Error("Іздеу бағасы берілмеді");
  return { lang: query.lang, phrase: query.phrase, estimate: count, gl: query.gl, hl: query.hl };
}

async function main() {
  const chosen = (process.env.TERM_IDS || "hdd").split(",").map((item) => item.trim()).filter(Boolean);
  const maximum = Number(process.env.MAX_QUERIES || "20");
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100) throw new Error("MAX_QUERIES 1–100 аралығында болуы керек");
  if (!chosen.length || chosen.length > 15) throw new Error("1–15 термин ID көрсетіңіз");
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY құпия кілті қажет; браузер кодының ішіне жазбаңыз");
  const { terms, overrides } = await catalog();
  const directory = path.join(ROOT, "data");
  const file = path.join(directory, "web-stats.json");
  let old = { provider: "SerpApi Google Search", generated_at: null, terms: {} };
  try { old = JSON.parse(await fs.readFile(file, "utf8")); } catch (_) { /* First run. */ }
  if (!old.terms || typeof old.terms !== "object") old.terms = {};
  let used = 0;
  for (const id of chosen) {
    const term = terms.find((item) => item.id === id);
    if (!term) throw new Error(`Термин каталогта жоқ: ${id}`);
    let links = {};
    try { links = await linkedTitles(term); }
    catch (error) { console.error(`${id}: тілдік байланыс алынбады (${error.message})`); }
    const records = [];
    let errors = 0;
    for (const query of buildQueryPlan(term, links, overrides[id])) {
      if (used >= maximum) break;
      used += 1;
      try { records.push(await estimate(query, apiKey)); }
      catch (error) { errors += 1; console.error(`${id} / ${query.lang}: ${error.message}`); }
    }
    if (records.length) old.terms[id] = { records, errors };
    console.log(`${id}: ${records.length} нәтиже, ${errors} қате, ${used}/${maximum} сұрау`);
    if (used >= maximum) break;
  }
  old.provider = "SerpApi Google Search";
  old.generated_at = new Date().toISOString();
  await fs.mkdir(directory, { recursive: true });
  const temporary = `${file}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(old, null, 2) + "\n", "utf8");
  await fs.rename(temporary, file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
