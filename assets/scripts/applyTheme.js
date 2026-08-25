// Applies the saved Appearance Mode + Accent Color the moment this
// script runs — deliberately standalone and dependency-free, so the
// correct look is guaranteed on every page regardless of what else
// that page's own scripts do (or fail to do) afterward.
(function () {
    try {
        let appearance = localStorage.getItem("appearanceMode") || "metallic";
        let accent = localStorage.getItem("accentColor") || localStorage.getItem("theme") || "#4caf50";
        document.documentElement.dataset.appearance = appearance;
        document.documentElement.style.setProperty("--theme", accent);
        document.documentElement.style.setProperty("--accent-color", accent);
    } catch (err) {
        console.warn("Theme apply failed", err);
    }
})();   