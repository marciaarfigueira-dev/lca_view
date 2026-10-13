(() => {
  "use strict";

  const body = document.body;
  const progressBar = document.querySelector("#reading-progress-bar");
  const chapterCounter = document.querySelector("#chapter-current");
  const chapterSections = [...document.querySelectorAll(".chapter-anchor[data-chapter]")];
  const navLinks = [...document.querySelectorAll("[data-nav]")];
  const journeyAnchors = [...document.querySelectorAll(".journey-anchor[data-next-target]")];
  const journeyNext = document.querySelector("#journey-next");
  const journeyNextKicker = document.querySelector("#journey-next-kicker");
  const journeyNextLabel = document.querySelector("#journey-next-label");
  const journeyNextArrow = document.querySelector("#journey-next-arrow");
  const routeLinks = [...document.querySelectorAll("[data-route]")];

  function updateJourney() {
    if (!journeyAnchors.length || !journeyNext) return;
    const marker = window.scrollY + window.innerHeight * 0.38;
    const current = journeyAnchors.reduce((active, section) => (
      section.offsetTop <= marker ? section : active
    ), journeyAnchors[0]);
    const target = current.dataset.nextTarget;
    const kicker = current.dataset.nextKicker || "Continue";
    const label = current.dataset.nextLabel || "Next section";
    const direction = current.dataset.nextDirection === "up" ? "up" : "down";

    journeyNext.classList.toggle("is-hidden", current.id === "prologue");
    journeyNext.href = `#${target}`;
    journeyNext.setAttribute("aria-label", `${kicker}: ${label}`);
    journeyNextKicker.textContent = kicker;
    journeyNextLabel.textContent = label;
    journeyNextArrow.textContent = direction === "up" ? "↑" : "↓";

    const routeId = current.id === "focal-question"
      ? "setting"
      : current.id === "thesis-proposition"
        ? "antaia"
        : current.id;
    routeLinks.forEach((link) => {
      const active = link.dataset.route === routeId;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });
  }

  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
    if (progressBar) progressBar.style.transform = `scaleX(${progress})`;
    updateJourney();
  }

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  const chapterObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) return;
      const section = visible.target;
      const chapter = section.dataset.chapter;
      const id = section.id;

      if (chapterCounter) chapterCounter.textContent = chapter;
      navLinks.forEach((link) => {
        const active = link.dataset.nav === id;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.15, 0.4, 0.7] }
  );

  chapterSections.forEach((section) => chapterObserver.observe(section));

  const steps = [...document.querySelectorAll("[data-stage-target][data-panel-target]")];
  const stages = [...document.querySelectorAll("[data-stage]")];

  stages.forEach((stage) => {
    const stageName = stage.dataset.stage;
    const stageSteps = steps.filter((step) => step.dataset.stageTarget === stageName);
    if (!stageSteps.length) return;

    const progress = document.createElement("div");
    progress.className = "stage-progress";
    progress.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "stage-progress-label";
    label.textContent = `1 / ${stageSteps.length}`;
    const dots = document.createElement("span");
    dots.className = "stage-progress-dots";
    stageSteps.forEach((_, index) => {
      const dot = document.createElement("i");
      dot.classList.toggle("is-active", index === 0);
      dots.append(dot);
    });
    progress.append(label, dots);
    stage.append(progress);

    stageSteps.forEach((step, index) => {
      step.dataset.step = `Finding ${index + 1} of ${stageSteps.length}`;
      const panel = stage.querySelector(`[data-panel="${step.dataset.panelTarget}"]`);
      if (!panel) return;
      const mobileVisual = panel.cloneNode(true);
      mobileVisual.className = "mobile-step-visual";
      mobileVisual.removeAttribute("data-panel");
      step.prepend(mobileVisual);
    });
  });

  function updateStageProgress(stage, activeStep) {
    const stageSteps = steps.filter((step) => step.dataset.stageTarget === stage.dataset.stage);
    const activeIndex = Math.max(0, stageSteps.indexOf(activeStep));
    const label = stage.querySelector(".stage-progress-label");
    if (label) label.textContent = `${activeIndex + 1} / ${stageSteps.length}`;
    stage.querySelectorAll(".stage-progress-dots i").forEach((dot, index) => {
      dot.classList.toggle("is-active", index === activeIndex);
    });
  }

  const stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const activeStep = entry.target;
        const stageName = activeStep.dataset.stageTarget;
        const panelName = activeStep.dataset.panelTarget;
        const stage = document.querySelector(`[data-stage="${stageName}"]`);
        if (!stage) return;

        steps
          .filter((step) => step.dataset.stageTarget === stageName)
          .forEach((step) => step.classList.toggle("is-active", step === activeStep));

        stage.querySelectorAll("[data-panel]").forEach((panel) => {
          panel.classList.toggle("is-active", panel.dataset.panel === panelName);
        });
        updateStageProgress(stage, activeStep);
      });
    },
    { rootMargin: "-36% 0px -42% 0px", threshold: [0.15, 0.5, 0.8] }
  );

  steps.forEach((step) => stepObserver.observe(step));

  const evidenceDialog = document.querySelector("#evidence-dialog");
  const evidenceTitle = document.querySelector("#evidence-dialog-title");
  const evidenceBody = document.querySelector("#evidence-dialog-body");
  const figureDialog = document.querySelector("#figure-dialog");
  const figureImage = document.querySelector("#figure-dialog-image");

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    body.classList.add("modal-open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (!document.querySelector("dialog[open]")) body.classList.remove("modal-open");
  }

  document.querySelectorAll(".evidence-note").forEach((button) => {
    button.addEventListener("click", () => {
      evidenceTitle.textContent = button.dataset.title || "Evidence note";
      evidenceBody.textContent = button.dataset.body || "";
      openDialog(evidenceDialog);
    });
  });

  document.querySelectorAll(".figure-open").forEach((button) => {
    button.addEventListener("click", () => {
      figureImage.src = button.dataset.image || "";
      figureImage.alt = button.dataset.alt || "Expanded thesis figure";
      openDialog(figureDialog);
    });
  });

  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", () => closeDialog(button.closest("dialog")));
  });

  [evidenceDialog, figureDialog].forEach((dialog) => {
    if (!dialog) return;
    dialog.addEventListener("click", (event) => {
      const bounds = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      if (!inside) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) body.classList.remove("modal-open");
    });
  });

  const scaleData = {
    farm: {
      title: "Diagnose a farmer-year",
      description: "Return a confidential, inspectable profile that distinguishes recorded practices, reconstructed indicators and contextual constraints.",
      outputs: [
        "Input, cost, yield and environmental profiles",
        "Position relative to a chosen peer reference",
        "Evidence gaps and assumptions behind each result",
        "Questions for management review, not an overall farm score"
      ]
    },
    collective: {
      title: "Coordinate shared capacity",
      description: "Identify recurrent patterns that may require advisory, procurement, infrastructure or value-chain action beyond an individual holding.",
      outputs: [
        "Comparable patterns across member farms and seasons",
        "Shared constraints and anomalous observations",
        "Priorities for advice, trials and collective investment",
        "Aggregated evidence returned without exposing farm rankings"
      ]
    },
    bioregion: {
      title: "Interpret territorial pressure",
      description: "Connect aggregated farm signals with climate, hydrology, pest monitoring, land condition and governance evidence at the scale where they gain meaning.",
      outputs: [
        "Spatial and temporal environmental baselines",
        "Candidate pressure signals requiring validation",
        "Differences between management and structural constraints",
        "Feedback for adaptive policy and regional coordination"
      ]
    }
  };

  const scaleButtons = [...document.querySelectorAll("[data-scale]")];
  const scaleContent = document.querySelector("#scale-content");
  const scaleVisual = document.querySelector(".scale-visual");

  function setScale(scale) {
    const data = scaleData[scale];
    if (!data) return;

    scaleButtons.forEach((button) => {
      const selected = button.dataset.scale === scale;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    if (scaleVisual) scaleVisual.dataset.activeScale = scale;
    if (scaleContent) {
      scaleContent.replaceChildren();
      const title = document.createElement("h4");
      title.textContent = data.title;
      const description = document.createElement("p");
      description.textContent = data.description;
      const list = document.createElement("ul");
      data.outputs.forEach((output) => {
        const item = document.createElement("li");
        item.textContent = output;
        list.append(item);
      });
      scaleContent.append(title, description, list);
    }
  }

  scaleButtons.forEach((button, index) => {
    button.addEventListener("click", () => setScale(button.dataset.scale));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + scaleButtons.length) % scaleButtons.length;
      const next = scaleButtons[nextIndex];
      setScale(next.dataset.scale);
      next.focus();
    });
  });
  setScale("farm");

  const proxyData = {
    records: {
      status: "Directly supportable",
      title: "Intervention intensity",
      copy: "Comparable treatment activity, not observed biological pressure."
    },
    linked: {
      status: "Potentially observable after validation",
      title: "Pest-pressure signal",
      copy: "A probabilistic territorial indicator, not proof of pest pressure in an individual field."
    }
  };

  const proxyButtons = [...document.querySelectorAll("[data-proxy]")];
  const proxyCanvas = document.querySelector(".proxy-canvas");
  const proxyStatus = document.querySelector("#proxy-status");
  const proxyTitle = document.querySelector("#proxy-output-title");
  const proxyCopy = document.querySelector("#proxy-output-copy");

  function setProxy(state) {
    const data = proxyData[state];
    if (!data) return;

    proxyButtons.forEach((button) => {
      const selected = button.dataset.proxy === state;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    if (proxyCanvas) proxyCanvas.dataset.proxyState = state;
    if (proxyStatus) proxyStatus.textContent = data.status;
    if (proxyTitle) proxyTitle.textContent = data.title;
    if (proxyCopy) proxyCopy.textContent = data.copy;
  }

  proxyButtons.forEach((button, index) => {
    button.addEventListener("click", () => setProxy(button.dataset.proxy));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + proxyButtons.length) % proxyButtons.length;
      const next = proxyButtons[nextIndex];
      setProxy(next.dataset.proxy);
      next.focus();
    });
  });
  setProxy("records");
})();
