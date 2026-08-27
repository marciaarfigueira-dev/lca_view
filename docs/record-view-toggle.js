(function () {
  document.querySelectorAll("[data-record-viewer]").forEach((viewer) => {
    const buttons = Array.from(viewer.querySelectorAll("[data-record-view-button]"));
    const panels = Array.from(viewer.querySelectorAll("[data-record-view-panel]"));

    function setView(view) {
      buttons.forEach((button) => {
        const active = button.dataset.recordViewButton === view;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.recordViewPanel !== view;
      });
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.recordViewButton));
    });

    setView("table");
  });
})();
