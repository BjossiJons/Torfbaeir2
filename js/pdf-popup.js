"use strict";

/**
 * Opnar PDF-íbúaskrá í sérstökum glugga.
 *
 * Notkun í HTML:
 * onclick="openPdfWindow(this.href); return false;"
 */
function openPdfWindow(url) {
  const popupWidth = 760;
  const popupHeight = Math.min(900, window.screen.availHeight - 80);

  const left = Math.max(
    0,
    window.screen.availLeft +
      window.screen.availWidth -
      popupWidth -
      30
  );

  const top = Math.max(0, window.screen.availTop + 40);

  const features = [
    "popup=yes",
    `width=${popupWidth}`,
    `height=${popupHeight}`,
    `left=${left}`,
    `top=${top}`,
    "scrollbars=yes",
    "resizable=yes"
  ].join(",");

  const pdfWindow = window.open(url, "ibuarWindow", features);

  if (pdfWindow) {
    pdfWindow.focus();
  } else {
    /*
      Varaleið ef vafrinn lokar á popup-glugga.
      Þá opnast skjalið samt í nýjum flipa.
    */
    window.open(url, "_blank", "noopener");
  }
}
