
(() => {
  "use strict";

  const CONFIG = {
    API_URL: "https://deep-scout-1.onrender.com",

    STAGE_DELAYS_MS: [600, 3200, 6200, 9200],
    TOAST_DURATION_MS: 4200,
  };

  const dom = {
    form: document.getElementById("research-form"),
    input: document.getElementById("topic-input"),
    submitBtn: document.getElementById("submit-btn"),
    hintChips: document.querySelectorAll(".hint-chip"),

    hero: document.getElementById("hero"),
    depthConsole: document.getElementById("depth-console"),
    depthTopic: document.getElementById("depth-topic"),
    depthGauge: document.getElementById("depth-gauge"),
    stages: document.querySelectorAll(".depth-gauge__stage"),

    errorState: document.getElementById("error-state"),
    errorMessage: document.getElementById("error-message"),
    retryBtn: document.getElementById("retry-btn"),

    results: document.getElementById("results"),
    resultsTopic: document.getElementById("results-topic"),
    reportContent: document.getElementById("report-content"),
    findingsContent: document.getElementById("findings-content"),
    sourcesContent: document.getElementById("sources-content"),
    criticContent: document.getElementById("critic-content"),
    trailSearch: document.getElementById("trail-search"),
    trailScrape: document.getElementById("trail-scrape"),

    copyBtn: document.getElementById("copy-btn"),
    downloadBtn: document.getElementById("download-btn"),
    newSearchBtn: document.getElementById("new-search-btn"),

    toastStack: document.getElementById("toast-stack"),
  };


  let state = {
    topic: "",
    report: "",
    stageTimers: [],
  };



  function showView(view) {
    // view: 'hero' | 'loading' | 'error' | 'results'
    dom.hero.hidden = view !== "hero";
    dom.depthConsole.hidden = view !== "loading";
    dom.errorState.hidden = view !== "error";
    dom.results.hidden = view !== "results";
  }


  function toast(message, type = "info") {
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.setAttribute("role", "status");
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    dom.toastStack.appendChild(el);

    setTimeout(() => {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    }, CONFIG.TOAST_DURATION_MS);
  }


  function resetGauge() {
    dom.stages.forEach((stage) => {
      stage.classList.remove("is-active", "is-done");
    });
  }

  function clearStageTimers() {
    state.stageTimers.forEach((id) => clearTimeout(id));
    state.stageTimers = [];
  }

  function runGaugeSequence() {
    resetGauge();
    const stageEls = Array.from(dom.stages);

    stageEls.forEach((stage, i) => {
      const timerId = setTimeout(() => {
        // mark previous stages as done, this one as active
        stageEls.forEach((s, j) => {
          if (j < i) {
            s.classList.remove("is-active");
            s.classList.add("is-done");
          }
        });
        stage.classList.add("is-active");
      }, CONFIG.STAGE_DELAYS_MS[i] || i * 3000);

      state.stageTimers.push(timerId);
    });
  }

  function completeGaugeInstantly() {
    clearStageTimers();
    dom.stages.forEach((stage) => {
      stage.classList.remove("is-active");
      stage.classList.add("is-done");
    });
  }

 

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }


  function renderMarkdown(raw) {
    if (!raw) return "";
    const lines = raw.split("\n");
    let html = "";
    let inList = false;

    const closeList = () => {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
    };

    const inlineFormat = (text) => {
      let out = escapeHtml(text);
      // markdown links [label](url)
      out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
      );
      // bare URLs
      out = out.replace(/(^|[\s(])(https?:\/\/[^\s)]+)/g, (_, pre, url) =>
        `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
      out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      out = out.replace(/(^|[^*])\*(?!\*)([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
      return out;
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList();
        return;
      }

      const headingMatch = trimmed.match(/^#{1,4}\s+(.*)$/);
      const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*:?$/);

      if (headingMatch) {
        closeList();
        html += `<h4>${inlineFormat(headingMatch[1])}</h4>`;
        return;
      }
      if (boldHeadingMatch && trimmed.length < 60) {
        closeList();
        html += `<h4>${inlineFormat(boldHeadingMatch[1])}</h4>`;
        return;
      }

      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${inlineFormat(bulletMatch[1])}</li>`;
        return;
      }

      closeList();
      html += `<p>${inlineFormat(trimmed)}</p>`;
    });

    closeList();
    return html;
  }


  function parseReportSections(report) {
    const sectionNames = ["Introduction", "Key Findings", "Conclusion", "Sources"];
    const pattern = new RegExp(
      `^(?:#{1,4}\\s*|\\*\\*)?(${sectionNames.join("|")})(?:\\*\\*)?:?\\s*$`,
      "i"
    );

    const lines = report.split("\n");
    const sections = {};
    let current = null;

    lines.forEach((line) => {
      const match = line.trim().match(pattern);
      if (match) {
        current = match[1].toLowerCase().replace(/\s+/g, "_");
        sections[current] = sections[current] || [];
        return;
      }
      if (current) {
        sections[current].push(line);
      }
    });

    const result = {};
    Object.keys(sections).forEach((key) => {
      result[key] = sections[key].join("\n").trim();
    });
    return result;
  }

  function extractFindings(keyFindingsText) {
    if (!keyFindingsText) return [];
    const bullets = [];
    keyFindingsText.split("\n").forEach((line) => {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/) || trimmed.match(/^\d+[.)]\s+(.*)$/);
      if (bulletMatch) {
        bullets.push(bulletMatch[1].replace(/\*\*/g, ""));
      }
    });
    return bullets;
  }

  function extractUrls(text) {
    if (!text) return [];
    const matches = text.match(/https?:\/\/[^\s)\]"']+/g) || [];
    // de-duplicate while preserving order
    return [...new Set(matches.map((u) => u.replace(/[.,]+$/, "")))];
  }

  function extractCriticScore(feedback) {
    if (!feedback) return null;
    const match = feedback.match(/Score:\s*(\d{1,2})\s*\/\s*10/i);
    return match ? match[1] : null;
  }

  function extractCriticVerdict(feedback) {
    if (!feedback) return "";
    const match = feedback.match(/one\s*line\s*verdict:?\s*\n?([\s\S]*)$/i);
    return match ? match[1].trim() : "";
  }

  

  function renderResults(data) {
    const { topic, search_results, scraped_content, report, feedback } = data;

    dom.resultsTopic.textContent = topic || "—";
    state.report = report || "";

    // Full report (rendered as light markdown)
    dom.reportContent.innerHTML = report
      ? renderMarkdown(report)
      : `<p class="empty-note">No report was returned for this topic.</p>`;

    // Parse structured sections out of the report
    const sections = parseReportSections(report || "");

    // Key findings
    const findings = extractFindings(sections.key_findings);
    if (findings.length) {
      dom.findingsContent.innerHTML = `<ul class="findings-list">${findings
        .map(
          (f, i) =>
            `<li><span class="finding-tick">${String(i + 1).padStart(2, "0")}</span><span>${escapeHtml(
              f
            )}</span></li>`
        )
        .join("")}</ul>`;
    } else {
      dom.findingsContent.innerHTML = `<p class="empty-note">No distinct findings section was detected in the report.</p>`;
    }


    let urls = extractUrls(sections.sources);
    if (!urls.length) urls = extractUrls(report);
    if (!urls.length) urls = extractUrls(search_results);

    if (urls.length) {
      dom.sourcesContent.innerHTML = `<ul class="sources-list">${urls
        .map((u) => `<li><a href="${u}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a></li>`)
        .join("")}</ul>`;
    } else {
      dom.sourcesContent.innerHTML = `<p class="empty-note">No source URLs were found in the research.</p>`;
    }

    // Critic feedback
    const score = extractCriticScore(feedback);
    const verdict = extractCriticVerdict(feedback);
    let criticHtml = "";
    if (score) {
      criticHtml += `<div class="critic-score">${score}<small>/10</small></div>`;
    }
    criticHtml += feedback
      ? renderMarkdown(feedback.replace(/one\s*line\s*verdict:?[\s\S]*$/i, ""))
      : `<p class="empty-note">No critic feedback was returned.</p>`;
    if (verdict) {
      criticHtml += `<p class="critic-verdict">"${escapeHtml(verdict)}"</p>`;
    }
    dom.criticContent.innerHTML = criticHtml;

    // Research trail
    dom.trailSearch.textContent = search_results || "No search results returned.";
    dom.trailScrape.textContent = scraped_content || "No scraped content returned.";
  }


  function copyReport() {
    if (!state.report) {
      toast("There's no report to copy yet.", "error");
      return;
    }
    navigator.clipboard
      .writeText(state.report)
      .then(() => toast("Report copied to clipboard.", "success"))
      .catch(() => toast("Couldn't copy — your browser blocked clipboard access.", "error"));
  }

  function downloadReport() {
    if (!state.report) {
      toast("There's no report to download yet.", "error");
      return;
    }
    const filenameSafeTopic = (state.topic || "research-report")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60);

    const blob = new Blob([state.report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameSafeTopic || "research-report"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Report downloaded.", "success");
  }

  function resetToHero() {
    clearStageTimers();
    resetGauge();
    dom.input.value = "";
    showView("hero");
    dom.input.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }



  async function runResearch(topic) {
    state.topic = topic;
    dom.depthTopic.textContent = topic;
    dom.submitBtn.disabled = true;

    showView("loading");
    runGaugeSequence();

    try {
      const response = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        let detail = `Request failed with status ${response.status}.`;
        try {
          const errJson = await response.json();
          if (errJson?.detail) detail = String(errJson.detail);
        } catch (_) {
          /* response body wasn't JSON — keep default message */
        }
        throw new Error(detail);
      }

      const data = await response.json();

      completeGaugeInstantly();
      // brief pause on the completed gauge so the user registers it
      await new Promise((resolve) => setTimeout(resolve, 450));

      renderResults(data);
      showView("results");
      toast(`Research complete for "${topic}".`, "success");

      requestAnimationFrame(() => {
        dom.results.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      clearStageTimers();
      const message =
        err?.name === "TypeError"
          ? "Couldn't reach the backend at 127.0.0.1:8000. Is it running?"
          : err?.message || "Something went wrong while researching that topic.";
      dom.errorMessage.textContent = message;
      showView("error");
      toast(message, "error");
    } finally {
      dom.submitBtn.disabled = false;
    }
  }


  dom.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = dom.input.value.trim();
    if (!topic) {
      toast("Enter a topic to research first.", "error");
      dom.input.focus();
      return;
    }
    runResearch(topic);
  });

  dom.hintChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      dom.input.value = chip.dataset.topic;
      dom.input.focus();
    });
  });

  dom.retryBtn.addEventListener("click", () => {
    if (state.topic) {
      runResearch(state.topic);
    } else {
      resetToHero();
    }
  });

  dom.copyBtn.addEventListener("click", copyReport);
  dom.downloadBtn.addEventListener("click", downloadReport);
  dom.newSearchBtn.addEventListener("click", resetToHero);

  /* Initial state */
  showView("hero");
})();
