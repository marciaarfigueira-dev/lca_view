const STORAGE_KEY = "mlSetsFarmer";
const VIEW_KEY = "mlSetsFarmerView";

const elements = {
  internal: document.getElementById("enter-internal"),
  bioregional: document.getElementById("enter-bioregional"),
  relative: document.getElementById("enter-relative"),
};

init();

function init() {
  const farmer = getSelectedFarmer();
  updateLinks(farmer);
  registerEnter(elements.internal, "internal", farmer);
  registerEnter(elements.bioregional, "benchmark", farmer);
  registerRelative(elements.relative, farmer);
}

function getSelectedFarmer() {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("farmer");
  if (param) return param;
  return localStorage.getItem(STORAGE_KEY) || "";
}

function updateLinks(farmer) {
  const base = "./farmer-dashboard.html";
  const relativeBase = "./farmer-relative-burden.html";
  const encoded = farmer ? encodeURIComponent(farmer) : "";
  if (elements.internal) {
    elements.internal.href = farmer ? `${base}?farmer=${encoded}&view=internal` : base;
  }
  if (elements.bioregional) {
    elements.bioregional.href = farmer ? `${base}?farmer=${encoded}&view=benchmark` : base;
  }
  if (elements.relative) {
    elements.relative.href = farmer ? `${relativeBase}?farmer=${encoded}` : relativeBase;
  }
}

function registerEnter(element, view, farmer) {
  if (!element) return;
  element.addEventListener("click", () => {
    if (farmer) {
      localStorage.setItem(STORAGE_KEY, farmer);
      localStorage.setItem(VIEW_KEY, view);
    } else {
      localStorage.setItem(VIEW_KEY, view);
    }
  });
}

function registerRelative(element, farmer) {
  if (!element) return;
  element.addEventListener("click", () => {
    if (farmer) {
      localStorage.setItem(STORAGE_KEY, farmer);
    }
  });
}
