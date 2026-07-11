// PDF Theme helpers
(function () {
    function createPdfTheme(hex) {
        const { r, g, b } = window.pdfUtils && window.pdfUtils.hexToRgb ? window.pdfUtils.hexToRgb(hex) : { r: 76, g: 175, b: 80 };
        return {
            primary: { r, g, b },
            primaryDark: { r: Math.max(0, r - 30), g: Math.max(0, g - 30), b: Math.max(0, b - 30) },
            text: { r: 0, g: 0, b: 0 },
            muted: { r: 120, g: 120, b: 120 }
        };
    }

    window.pdfTheme = { createPdfTheme };
})();
