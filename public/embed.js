/*!
 * Lavena booking button.
 *
 *   <script async src="https://<lavena>/embed.js"
 *           data-lavena-salon="your-salon-slug" data-lavena-locale="bg"></script>
 *   <button type="button" data-lavena-book>Book now</button>
 *
 * Any element with data-lavena-book opens the salon's booking page in a new
 * tab (data-lavena-service="<service id>" starts at one service). The page is
 * opened rather than framed on purpose: sign-in and payment need first-party
 * cookies, which browsers withhold from a frame on another site.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script || !script.src) return;

  var slug = script.getAttribute("data-lavena-salon") || "";
  var locale = script.getAttribute("data-lavena-locale") || "bg";
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return;
  if (["bg", "en", "ro"].indexOf(locale) === -1) locale = "bg";

  var origin = new URL(script.src).origin;

  function bookUrl(service) {
    var url = origin + "/" + locale + "/business/" + slug + "/book?ref=embed";
    if (service && /^[0-9a-f-]{36}$/i.test(service)) url += "&service=" + service;
    return url;
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!(target instanceof Element)) return;
    var trigger = target.closest("[data-lavena-book]");
    if (!trigger) return;
    event.preventDefault();
    var opened = window.open(bookUrl(trigger.getAttribute("data-lavena-service")), "_blank", "noopener");
    // A blocked popup falls back to leaving the page, which always works.
    if (!opened) window.location.href = bookUrl(trigger.getAttribute("data-lavena-service"));
  });
})();
