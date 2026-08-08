/* Halstead Glass — Product Advice Guide
 * v1.1.0
 *
 * Runs on two pages:
 *   1. The product overview page, where #window-guide exists — the full tool.
 *   2. The form success page, where it does not — renders the product links the
 *      tool stashed on submit, and nothing else.
 *
 * Why the split: the form redirects to /windows-advice-success on success, so
 * Webflow's inline .w-form-done block never appears. Anything shown "after
 * conversion" has to live on the success page instead, and gets there via
 * sessionStorage rather than a query string, so the redirect URL stays clean.
 */
window.Webflow = window.Webflow || [];
window.Webflow.push(function () {

  // Handoff between the two pages. sessionStorage rather than localStorage on
  // purpose — it should not outlive the browsing session.
  const HANDOFF_KEY = "wg_handoff";

  // Needed by both the guide and the success page, so it is declared before the
  // branch below.
  const PRODUCT = {
    rehau: { key: "rehau", name: "REHAU Flush uPVC Casement Windows", url: "/windows/rehau-upvc-windows", desc: "Excellent all-round performance and strong value with flush styling suited to many homes.", priceBand: "Cost-effective" },
    quickslide: { key: "quickslide", name: "Quickslide uPVC Sliding Sash Windows", url: "/windows/quickslide-sash-windows", desc: "Traditional sash styling with modern performance and strong value.", priceBand: "Mid-range" },
    masterframe: { key: "masterframe", name: "Masterframe NEOsash uPVC Windows", url: "/windows/masterframe-sash-windows", desc: "Premium timber-style sash appearance with long guarantees and modern engineering.", priceBand: "Mid-range" },
    origin: { key: "origin", name: "Origin Aluminium Windows", url: "/windows/origin-aluminium-windows", desc: "Slim contemporary aluminium frames with exceptional durability and long guarantees.", priceBand: "Premium" },
    granada: { key: "granada", name: "Granada Secondary Glazing", url: "/windows/granada-secondary-glazing", desc: "A discreet secondary pane that improves insulation and comfort while keeping existing windows.", priceBand: "Mid-range" }
  };

  // Clones the #wg-done-links prototype once per product key. Used by the
  // success page, and by the inline fallback on the guide page.
  function renderProductLinks(wrap, keys) {
    if (!wrap) return false;
    const proto = wrap.querySelector(".wg-result-link");
    if (!proto) return false;
    const template = proto.cloneNode(true);
    const items = (keys || []).map(k => PRODUCT[k]).filter(Boolean);
    Array.from(wrap.querySelectorAll(".wg-result-link")).forEach(el => el.remove());
    if (!items.length) {
      wrap.style.display = "none";
      return false;
    }
    items.forEach(p => {
      const a = template.cloneNode(true);
      a.setAttribute("href", p.url);
      a.textContent = p.name;
      wrap.appendChild(a);
    });
    wrap.style.display = "";
    return true;
  }

  const guideEl = document.getElementById("window-guide");

  // ---------------------------------------------------------------------------
  // SUCCESS PAGE BRANCH
  // No #window-guide here. Show all three products the customer was recommended
  // — not just the ones they ticked — so there is more to explore now they have
  // already converted. The payload is left in place rather than cleared, so a
  // page refresh still works; sessionStorage disappears with the tab anyway.
  // ---------------------------------------------------------------------------
  if (!guideEl) {
    const wrap = document.getElementById("wg-done-links");
    if (!wrap) return;
    let payload = null;
    try { payload = JSON.parse(sessionStorage.getItem(HANDOFF_KEY) || "null"); } catch (e) {}
    const keys = payload && Array.isArray(payload.recommended) ? payload.recommended : [];
    // Someone landing here directly, or with storage blocked, sees nothing
    // rather than a broken or empty block.
    if (!renderProductLinks(wrap, keys)) wrap.style.display = "none";
    return;
  }

  // ---------------------------------------------------------------------------
  // Auto-scroll when stepping through questions is OFF. The page stays put and
  // the user scrolls themselves. To re-enable, set AUTO_SCROLL to true — the
  // scroll code below measures any sticky/fixed header and leaves SCROLL_GAP px
  // of clearance beneath it, so start by tuning SCROLL_GAP.
  const AUTO_SCROLL = false;
  const SCROLL_GAP = 24;
  // ---------------------------------------------------------------------------
  const answers = { property: null, priority: null, budget: null, style: null };
  const STEP_KEYS = ["property", "priority", "budget", "style"];
  // ---------------------------------------------------------------------------
  // Working state lives here, NOT in the hidden form fields.
  // Those fields carry human-readable prose for the enquiry email, so they can
  // no longer be parsed back into product keys. Anything the script needs to
  // remember between events is held in these two variables instead.
  //   lastRecommendedKeys — the three products we put in front of the customer
  //   defaultSelectedKeys — which of them were pre-ticked, so the email can say
  //                         whether the customer actively chose or just left it
  // ---------------------------------------------------------------------------
  let lastRecommendedKeys = [];
  let defaultSelectedKeys = [];
  // LABELS is used only by prettyValue(), which is used only when writing the
  // hidden fields. So these strings appear in the enquiry email and nowhere else
  // — the on-page stage summaries use the button text instead. Safe to word
  // these for whoever reads the email rather than for the customer.
  const LABELS = {
    property: { period: "Period / traditional", modern: "Modern", conservation: "Conservation / planning restrictions" },
    priority: { value: "Best value for money", traditional: "Traditional appearance", contemporary: "Contemporary / slim frames", guarantee: "Low maintenance & long guarantees" },
    budget: { cost_effective: "Most cost-effective", mid_range: "Mid-range", premium: "Premium finish", open: "Open to options" },
    style: { casement: "Casement", sash: "Sliding sash", tilt_turn: "Tilt & turn", bay: "Bay", gable: "Gable", secondary: "Secondary glazing", guide: "Not sure — asked to be guided" }
  };
  // Short chip labels for the "why recommended" tags (concise versions of LABELS).
  const TAG_LABELS = {
    property: { period: "Period property", modern: "Modern property", conservation: "Conservation area" },
    priority: { value: "Best value", traditional: "Traditional look", contemporary: "Slim / contemporary", guarantee: "Low maintenance" },
    budget: { cost_effective: "Cost-effective", mid_range: "Mid-range budget", premium: "Premium budget", open: "Open budget" },
    style: { casement: "Casement", sash: "Sliding sash", tilt_turn: "Tilt & turn", bay: "Bay", gable: "Gable", secondary: "Secondary glazing", guide: "Guide me" }
  };
  // --- Recommendation model metadata ---
  const META = {
    rehau:       { band: 1, styles: ["casement", "bay"], material: "uPVC" },
    quickslide:  { band: 2, styles: ["sash"], material: "uPVC" },
    masterframe: { band: 2, styles: ["sash"], material: "uPVC" },
    origin:      { band: 3, styles: ["casement", "tilt_turn", "bay", "gable"], material: "Aluminium" },
    granada:     { band: 2, styles: ["secondary"], material: "Secondary glazing" }
  };
  const PRODUCT_ORDER = ["rehau", "quickslide", "masterframe", "origin", "granada"];
  const BUDGET_TARGET = { cost_effective: 1, mid_range: 2, premium: 3, open: null };
  const qs = (sel, root = guideEl) => root.querySelector(sel);
  const qsa = (sel, root = guideEl) => Array.from(root.querySelectorAll(sel));
  const startBtn = qs('[data-wg="start"]');
  const progressText = document.getElementById("wg-progress-text");
  const progressFill = qs(".wg-progress-fill");
  const progressEl = qs(".wg-progress");
  const stagesEl = qs(".wg-stages");
  const resultEl = document.getElementById("wg-result");
  const resultOptionsContainer = qs(".wg-result-options"); // required
  // The card sitting inside .wg-result-options in the Designer ("Result Card
  // Template") is the single source of truth for result markup. It is captured
  // here before the container is cleared, then cloned once per recommendation.
  // To restyle the cards, edit that element in the Designer — no JS changes.
  const templateSrc = resultOptionsContainer ? resultOptionsContainer.querySelector(".wg-result-option") : null;
  const cardTemplate = templateSrc ? templateSrc.cloneNode(true) : null;
  // Product links deliberately do NOT appear on the result cards — sending
  // people to a product page before they submit costs conversions.
  //
  // With a redirect configured on the form (the current setup), the customer
  // never sees this block — the success page renders the links instead, from the
  // sessionStorage handoff written on submit. It is kept as a fallback for
  // deployments with no redirect, where Webflow's inline .w-form-done shows.
  const doneLinksEl = document.getElementById("wg-done-links");
  let doneLinkProto = null;
  if (doneLinksEl) {
    const proto = doneLinksEl.querySelector(".wg-result-link");
    if (proto) doneLinkProto = proto.cloneNode(true);
    doneLinksEl.style.display = "none";
  }
  const formEl = qs("form") || qs(".w-form form");
  // ---------------------------------------------------------------------------
  // Hidden fields are OUTPUT ONLY. Each becomes a labelled line in the Webflow
  // notification email, using the field's name attribute as the label — which is
  // why the names are single readable words. Webflow collapses newlines inside a
  // single field value, so the summary is spread across fields rather than built
  // as one block of text.
  //
  // Set each in the Designer as an Input with custom attributes:
  //   type = hidden
  //   name = Property   (etc.)
  // ---------------------------------------------------------------------------
  const hidden = {
    property:    qs('input[name="Property"]'),
    priority:    qs('input[name="Priority"]'),
    budget:      qs('input[name="Budget"]'),
    style:       qs('input[name="Style"]'),
    recommended: qs('input[name="Recommended"]'),
    selected:    qs('input[name="Selected"]'),
    changed:     qs('input[name="Changed"]'),
    source:      qs('input[name="Source"]')
  };
  // The questions and progress bar stay hidden until the guide is started, and
  // the start button swaps out at the same moment.
  // NOTE: this hides directly rather than via an .is-hidden class. Both
  // .wg-stages and .wg-progress set display:flex and .wg-start sets
  // display:inline-block, so a single-class .is-hidden rule only beats them if
  // Webflow happens to emit it later in the stylesheet — which is not
  // guaranteed, and broke when this guide was pasted into another site. Setting
  // display here always wins. (.is-hidden is still used for the card caveat,
  // where the base class sets no display and there is nothing to conflict with.)
  function setGuideVisible(visible) {
    [stagesEl, progressEl].forEach(el => {
      if (el) el.style.display = visible ? "" : "none";
    });
    if (startBtn) startBtn.style.display = visible ? "none" : "";
  }
  // Progress bar fill is driven here; its colour and size live on .wg-progress-fill.
  function setFill(pct) {
    if (progressFill) progressFill.style.width = pct + "%";
  }
  function setProgress(n) {
    setFill((n - 1) * 25);
    if (!progressText) return;
    progressText.textContent = `Question ${n} of 4`;
  }
  function setProgressResults() {
    setFill(100);
    if (!progressText) return;
    progressText.textContent = "Results";
  }
  function clearProgress() {
    setFill(0);
    if (!progressText) return;
    progressText.textContent = "";
  }
  // Stage badge shows the step number, or a tick once the step is answered.
  function setBadge(stage, text) {
    const badge = qs(".wg-badge", stage);
    if (badge) badge.textContent = text;
  }
  // Measures whatever sticky/fixed header is currently pinned to the top of the
  // viewport, so a scroll can clear it. Only used when AUTO_SCROLL is on.
  function stickyOffset() {
    let offset = 0;
    const candidates = document.querySelectorAll("header, nav, .w-nav, [class*='navbar'], [class*='nav-bar'], [class*='header']");
    candidates.forEach(el => {
      if (guideEl.contains(el)) return;
      const cs = window.getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      if (cs.display === "none" || cs.visibility === "hidden") return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      // Only count it if it is currently pinned against the top of the viewport.
      if (rect.top > 1) return;
      if (rect.bottom > offset) offset = rect.bottom;
    });
    return offset;
  }
  // No-op while AUTO_SCROLL is false — the page does not move when stepping.
  function scrollNice(el) {
    if (!AUTO_SCROLL || !el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - stickyOffset() - SCROLL_GAP;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }
  function stageEl(n) {
    return qs(`.wg-stage[data-step="${n}"]`);
  }
  function hideStageOptions(stage) {
    const options = qs(".wg-options", stage);
    if (options) options.style.display = "none";
  }
  function showStageOptions(stage) {
    const options = qs(".wg-options", stage);
    if (options) options.style.display = "";
  }
  function hideStageSummary(stage) {
    const summary = qs(".wg-summary", stage);
    if (summary) summary.style.display = "none";
  }
  function showStageSummary(stage) {
    const summary = qs(".wg-summary", stage);
    if (summary) summary.style.display = "";
  }
  function setStageSummaryText(stage, text) {
    const summaryText = qs(".wg-summary-text", stage);
    if (summaryText) summaryText.textContent = text || "";
  }
  function setStageActive(n) {
    qsa(".wg-stage").forEach(s => s.classList.remove("is-active"));
    const s = stageEl(n);
    if (!s) return;
    s.classList.add("is-active");
    setProgress(n);
    scrollNice(s);
  }
  function collapseStage(n, summaryText) {
    const s = stageEl(n);
    if (!s) return;
    s.classList.add("is-complete");
    s.classList.remove("is-active");
    setBadge(s, "✓");
    setStageSummaryText(s, summaryText);
    showStageSummary(s);
    hideStageOptions(s);
  }
  function expandStage(n) {
    const s = stageEl(n);
    if (!s) return;
    s.classList.remove("is-complete");
    s.classList.add("is-active");
    setBadge(s, String(n));
    hideStageSummary(s);
    showStageOptions(s);
    setStageActive(n);
  }
  // Blanks every output field except Source, which is set once and never changes.
  function clearOutputFields() {
    [hidden.property, hidden.priority, hidden.budget, hidden.style,
     hidden.recommended, hidden.selected, hidden.changed].forEach(el => {
      if (el) el.value = "";
    });
  }
  function initUI() {
    qsa(".wg-stage").forEach(stage => {
      stage.classList.remove("is-active", "is-complete");
      setBadge(stage, stage.dataset.step || "");
      hideStageSummary(stage);
      hideStageOptions(stage);
      qsa(".wg-option", stage).forEach(btn => btn.classList.remove("is-selected"));
    });
    if (resultEl) resultEl.style.display = "none";
    if (resultOptionsContainer) resultOptionsContainer.innerHTML = "";
    setGuideVisible(false);
    clearProgress();
    lastRecommendedKeys = [];
    defaultSelectedKeys = [];
    if (hidden.source) hidden.source.value = location.pathname || "/windows/windows-overview";
    clearOutputFields();
  }
  function resetFromStep(stepNum) {
    for (let i = stepNum - 1; i < STEP_KEYS.length; i++) {
      answers[STEP_KEYS[i]] = null;
    }
    for (let s = stepNum; s <= 4; s++) {
      const stage = stageEl(s);
      if (!stage) continue;
      stage.classList.remove("is-active", "is-complete");
      setBadge(stage, String(s));
      hideStageSummary(stage);
      showStageOptions(stage);
      qsa(".wg-option", stage).forEach(btn => btn.classList.remove("is-selected"));
    }
    if (resultEl) resultEl.style.display = "none";
    if (resultOptionsContainer) resultOptionsContainer.innerHTML = "";
    lastRecommendedKeys = [];
    defaultSelectedKeys = [];
    clearOutputFields();
  }
  function propertyScores() {
    const s = { rehau: 0, quickslide: 0, masterframe: 0, origin: 0, granada: 0 };
    switch (answers.property) {
      case "period":
        s.masterframe += 3; s.quickslide += 2; s.rehau += 1; s.granada += 1; break;
      case "modern":
        s.origin += 3; s.rehau += 2; break;
      case "conservation":
        s.granada += 5; s.masterframe += 1; s.quickslide += 1; break;
    }
    return s;
  }
  function priorityScores() {
    const s = { rehau: 0, quickslide: 0, masterframe: 0, origin: 0, granada: 0 };
    switch (answers.priority) {
      case "value":
        s.rehau += 3; s.quickslide += 2; s.granada += 1; break;
      case "traditional":
        s.masterframe += 3; s.quickslide += 2; s.rehau += 1; break;
      case "contemporary":
        s.origin += 3; s.rehau += 1; break;
      case "guarantee":
        s.origin += 3; s.masterframe += 2; break;
    }
    return s;
  }
  function budgetFit(key) {
    const target = BUDGET_TARGET[answers.budget];
    if (target == null) return 0;
    const diff = Math.abs(META[key].band - target);
    return diff === 0 ? 3 : diff === 1 ? 0 : -3;
  }
  function scoreProducts() {
    const prop = propertyScores();
    const pri = priorityScores();
    const score = { rehau: 0, quickslide: 0, masterframe: 0, origin: 0, granada: 0 };
    PRODUCT_ORDER.forEach(k => { score[k] = prop[k] + pri[k] + budgetFit(k); });
    if (answers.property === "conservation") {
      score.origin -= 4;
      score.rehau  -= 2;
    }
    return score;
  }
  function styleEligible(key) {
    const style = answers.style;
    if (!style || style === "guide") {
      return key !== "granada" || answers.property === "conservation";
    }
    if (META[key].styles.includes(style)) return true;
    if (key === "granada" && answers.property === "conservation") return true;
    return false;
  }
  function rankByScore(keys, score) {
    return keys.slice().sort((a, b) => {
      if (score[b] !== score[a]) return score[b] - score[a];
      const fb = budgetFit(b), fa = budgetFit(a);
      if (fb !== fa) return fb - fa;
      return PRODUCT_ORDER.indexOf(a) - PRODUCT_ORDER.indexOf(b);
    });
  }
  function matchTags(key) {
    const prop = propertyScores();
    const pri = priorityScores();
    const tags = [];
    if (prop[key] > 0 && TAG_LABELS.property[answers.property]) tags.push(TAG_LABELS.property[answers.property]);
    if (pri[key] > 0 && TAG_LABELS.priority[answers.priority]) tags.push(TAG_LABELS.priority[answers.priority]);
    if (budgetFit(key) > 0 && TAG_LABELS.budget[answers.budget]) tags.push(TAG_LABELS.budget[answers.budget]);
    const style = answers.style;
    if (style && style !== "guide" && META[key].styles.includes(style) && TAG_LABELS.style[style]) {
      tags.push(TAG_LABELS.style[style]);
    }
    return tags;
  }
  function conservationCaveat(key) {
    if (answers.property !== "conservation" || key === "granada") return "";
    return `⚠ ${META[key].material} windows often need planning consent in a conservation area, though rules vary by council — check with your local planning authority. We'll help confirm what's permitted before quoting.`;
  }
  function prettyValue(groupKey, rawValue) {
    return (LABELS[groupKey] && LABELS[groupKey][rawValue]) ? LABELS[groupKey][rawValue] : (rawValue || "");
  }
  function prettyProductList(keys) {
    return (keys || []).filter(Boolean).map(k => PRODUCT[k]?.name || k);
  }
  // True if the customer's ticks differ from what was pre-ticked for them.
  // Order-independent, so unticking and re-ticking the same two still reads as
  // unchanged.
  function selectionChanged(selectedKeys) {
    const a = (selectedKeys || []).slice().sort().join(",");
    const b = defaultSelectedKeys.slice().sort().join(",");
    return a !== b;
  }
  function selectionLabel(selectedKeys) {
    if (!defaultSelectedKeys.length) return "";
    return selectionChanged(selectedKeys)
      ? "Yes — customer changed our default"
      : "No — kept our default";
  }
  // Mirrors each card's checked state onto the .is-checked Webflow class.
  function syncCardStates() {
    qsa(".wg-result-option").forEach(card => {
      const cb = card.querySelector(".wg-result-checkbox");
      card.classList.toggle("is-checked", !!(cb && cb.checked));
    });
  }
  // Returns product keys only. Writing to the form is writeSummary's job.
  function collectSelections() {
    return Array.from(qsa(".wg-result-checkbox:checked")).map(cb => cb.value);
  }
  // Writes the readable enquiry summary across the hidden output fields. Called
  // whenever the recommendation renders, a checkbox changes, or the form submits.
  function writeSummary(recommendedKeys, selectedKeys) {
    const set = (el, val) => { if (el) el.value = val; };
    const recNames = prettyProductList(recommendedKeys);
    const selNames = prettyProductList(selectedKeys);
    set(hidden.property,    prettyValue("property", answers.property));
    set(hidden.priority,    prettyValue("priority", answers.priority));
    set(hidden.budget,      prettyValue("budget", answers.budget));
    set(hidden.style,       prettyValue("style", answers.style));
    set(hidden.recommended, recNames.length ? recNames.join(", ") : "(none)");
    set(hidden.selected,    selNames.length ? selNames.join(", ") : "(none ticked)");
    set(hidden.changed,     selectionLabel(selectedKeys));
  }
  // Hands the recommendation over to the success page. Stores all three
  // recommended products, since that page offers everything worth exploring
  // rather than only what was ticked. The ticks are stored alongside in case
  // that decision is revisited. Fails silently where storage is unavailable.
  function stashHandoff(selectedKeys) {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({
        recommended: lastRecommendedKeys,
        selected: selectedKeys
      }));
    } catch (e) { /* private mode or storage disabled — links simply won't show */ }
  }
  // Fills one cloned card from the Designer template with a product's content.
  function buildCard(key, checked) {
    const p = PRODUCT[key];
    const card = cardTemplate.cloneNode(true);
    const cb = card.querySelector(".wg-result-checkbox");
    if (cb) {
      cb.value = key;
      cb.checked = checked;
    }
    const nameEl = card.querySelector(".wg-result-name");
    if (nameEl) nameEl.textContent = p.name;
    const bandEl = card.querySelector(".wg-price-band");
    if (bandEl) bandEl.textContent = p.priceBand;
    const descEl = card.querySelector(".wg-result-desc");
    if (descEl) descEl.textContent = p.desc;
    // Tags: the template's single .wg-tag is the chip prototype.
    const tagsWrap = card.querySelector(".wg-result-tags");
    const tagProto = tagsWrap ? tagsWrap.querySelector(".wg-tag") : null;
    if (tagsWrap && tagProto) {
      const tags = matchTags(key);
      tagsWrap.innerHTML = "";
      if (tags.length) {
        tags.forEach(t => {
          const chip = tagProto.cloneNode(true);
          chip.classList.remove("is-muted");
          chip.textContent = t;
          tagsWrap.appendChild(chip);
        });
      } else {
        const chip = tagProto.cloneNode(true);
        chip.classList.add("is-muted");
        chip.textContent = "Alternative worth considering";
        tagsWrap.appendChild(chip);
      }
    }
    const caveatEl = card.querySelector(".wg-result-caveat");
    if (caveatEl) {
      const caveat = conservationCaveat(key);
      caveatEl.textContent = caveat;
      caveatEl.classList.toggle("is-hidden", !caveat);
      // Belt and braces: .wg-result-caveat sets no display of its own, but do not
      // rely on class order alone for something that must not appear.
      caveatEl.style.display = caveat ? "" : "none";
    }
    return card;
  }
  function renderResults() {
    if (!resultEl || !resultOptionsContainer || !cardTemplate) return;
    const score = scoreProducts();
    const eligible = rankByScore(PRODUCT_ORDER.filter(k => styleEligible(k)), score);
    const backfill = rankByScore(
      PRODUCT_ORDER.filter(k => !eligible.includes(k) && (k !== "granada" || answers.property === "conservation")),
      score
    );
    const top3 = [...eligible, ...backfill].slice(0, 3);
    lastRecommendedKeys = top3.slice();
    resultOptionsContainer.innerHTML = "";
    top3.forEach((key, index) => {
      resultOptionsContainer.appendChild(buildCard(key, index < 2));
    });
    resultEl.style.display = "";
    setProgressResults();
    scrollNice(resultEl);
    syncCardStates();
    const selectedKeys = collectSelections();
    // Read the default from what actually ended up ticked rather than assuming
    // the first two, so changing buildCard's pre-tick rule needs no edit here.
    defaultSelectedKeys = selectedKeys.slice();
    writeSummary(lastRecommendedKeys, selectedKeys);
  }
  function onPick(stepNum, key, value, btn) {
    answers[key] = value;
    const stage = stageEl(stepNum);
    if (stage) {
      qsa(".wg-option", stage).forEach(b => b.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      collapseStage(stepNum, btn.textContent.trim());
    }
    if (stepNum < 4) expandStage(stepNum + 1);
    else renderResults();
  }
  function start() {
    STEP_KEYS.forEach(k => (answers[k] = null));
    initUI();
    setGuideVisible(true);
    expandStage(1);
  }
  qsa(".wg-stage").forEach(stage => {
    const stepNum = parseInt(stage.dataset.step, 10);
    const key = STEP_KEYS[stepNum - 1];
    qsa(".wg-option", stage).forEach(btn => {
      btn.addEventListener("click", e => {
        e.preventDefault();
        const value = btn.dataset.value;
        if (!value) return;
        onPick(stepNum, key, value, btn);
      });
    });
    const changeBtn = stage.querySelector('[data-wg="change"]') || stage.querySelector(".wg-change");
    if (changeBtn) {
      changeBtn.addEventListener("click", e => {
        e.preventDefault();
        resetFromStep(stepNum);
        expandStage(stepNum);
      });
    }
  });
  guideEl.addEventListener("change", (e) => {
    if (e.target && e.target.classList && e.target.classList.contains("wg-result-checkbox")) {
      syncCardStates();
      writeSummary(lastRecommendedKeys, collectSelections());
    }
  });
  if (formEl) {
    formEl.addEventListener("submit", () => {
      const selectedKeys = collectSelections();
      writeSummary(lastRecommendedKeys, selectedKeys);
      // Hand the recommendation to the success page before Webflow redirects.
      stashHandoff(selectedKeys);
      // Inline fallback for deployments with no redirect configured. With the
      // redirect on, the customer navigates away before ever seeing this.
      if (doneLinkProto) renderProductLinks(doneLinksEl, lastRecommendedKeys);
    });
  }
  if (startBtn) {
    startBtn.addEventListener("click", e => {
      e.preventDefault();
      start();
    });
  }
  initUI();
});
