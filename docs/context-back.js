(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "farmers") return;

  document.querySelectorAll('a[href="./bioregional.html"]').forEach((link) => {
    link.href = "./farmer.html";
  });
})();
