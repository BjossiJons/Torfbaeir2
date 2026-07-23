"use strict";

/**
 * Uppfærir hvaða kort er valið í hliðarvalmyndinni og fyrirsögnina
 * fyrir ofan innfellda kortið.
 */
function setActiveMap(linkElement, title) {
  const allLinks = document.querySelectorAll(".map-links a");
  const header = document.getElementById("viewerHeader");

  allLinks.forEach((link) => link.classList.remove("active-map"));
  linkElement.classList.add("active-map");

  if (header) {
    header.textContent = title;
  }
}
