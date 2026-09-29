"use strict";

const TermCore = (() => {
  const normalize = (value) => String(value || "").toLocaleLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();

  function unique(values, limit = 5) {
    const seen = new Set();
    return values.map((value) => String(value || "").trim()).filter((value) => {
      const key = normalize(value);
      if (!key || seen.has(key) || value.length > 90) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  }

  function splitVariants(value) {
    return unique(String(value || "").split(/[,;，\n]+/));
  }

  function recommend(record, results) {
    const variants = unique(record.kk || []);
    const rows = variants.map((phrase) => ({ phrase, data: results[`kk:${phrase}`] }));
    const ready = rows.filter((row) => row.data?.state === "ready");
    const complete = ready.length === rows.length && rows.length > 0;
    const ordered = [...ready].sort((a, b) => b.data.hits - a.data.hits);
    const top = ordered[0];
    const tied = Boolean(ordered[1] && top.data.hits === ordered[1].data.hits);

    if (record.verified) {
      const observed = ready.find((row) => normalize(row.phrase) === normalize(record.verified.variant));
      return {
        type: "verified", phrase: record.verified.variant,
        title: "Ресми мәтінге арналған нұсқа",
        reason: `«${record.verified.variant}» салалық терминдер жинағында көрсетілген. ${observed ? `Таңдалған мәтін қорында ${observed.data.hits} мақалада табылды.` : "Қолданыс саны қазір алынбады."} Басқа нұсқалардың жиілігі бұл дереккөздегі атаудың мәртебесін өзгертпейді.`,
        source: record.verified.source,
        sourceLabel: record.verified.label
      };
    }
    if (!complete) return { type: "insufficient", title: "Ұсынысқа дерек жеткіліксіз", reason: "Қазақша нұсқалардың бәрі тексерілгенде ғана басым қолданысты анықтай аламыз." };
    if (!top || top.data.hits === 0) return { type: "insufficient", title: "Ұсынысқа дерек жеткіліксіз", reason: "Бұл мәтін қорында ұсынылған қазақша нұсқалар табылмады. Басқа дереккөз керек." };
    if (variants.length === 1) return {
      type: "tentative", phrase: top.phrase,
      title: "Тексерілген жалғыз нұсқа",
      reason: `«${top.phrase}» ${top.data.hits} мақалада табылды. Басқа қазақша балама енгізілмегендіктен қайсысы басым екенін салыстыра алмаймыз.`
    };
    if (tied) return { type: "tie", title: "Нұсқалар тең түсті", reason: "Таңдалған мәтін қорындағы көрсеткіш бірдей. Мағына дәлдігін және ресми термин базасын бөлек тексеріңіз." };
    return {
      type: top.data.hits >= 10 && (!ordered[1] || top.data.hits >= ordered[1].data.hits * 1.5) ? "observed" : "tentative",
      phrase: top.phrase,
      title: "Осы мәтін қорында басым нұсқа",
      reason: `«${top.phrase}» ${top.data.hits} мақалада табылды${ordered[1] ? `, ал «${ordered[1].phrase}» ${ordered[1].data.hits} мақалада` : ""}. Бұл тек қолданыс байқауы; ресми бекітілген термин деген тұжырым емес.`
    };
  }

  function countrySummary(items, results) {
    const rows = items.map((phrase) => ({ phrase, data: results[phrase] })).filter((row) => row.data?.state === "ready");
    if (!rows.length) return null;
    return rows.sort((a, b) => b.data.hits - a.data.hits)[0];
  }

  // RFC 4180 style CSV parsing for the administrator import command.
  function parseCSV(text) {
    const rows = []; let row = []; let field = ""; let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === '"' && quoted && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { row.push(field); field = ""; }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && text[i + 1] === "\n") i += 1;
        row.push(field); field = "";
        if (row.some((item) => item.trim())) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field);
    if (row.some((item) => item.trim())) rows.push(row);
    return rows;
  }

  return { normalize, unique, splitVariants, recommend, countrySummary, parseCSV };
})();

if (typeof module !== "undefined") module.exports = TermCore;
if (typeof window !== "undefined") window.TermCore = TermCore;
