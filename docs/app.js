const revealEls = Array.from(document.querySelectorAll("[data-reveal]"));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!revealEls.length) {
  document.documentElement.classList.add("js-ready");
} else if (reduceMotion) {
  revealEls.forEach((el) => el.classList.add("is-visible"));
  document.documentElement.classList.add("js-ready");
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealEls.forEach((el, idx) => {
    el.style.transitionDelay = `${Math.min(idx * 120, 480)}ms`;
    observer.observe(el);
  });
  document.documentElement.classList.add("js-ready");
}
