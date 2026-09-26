(function () {
  var MISMATCH = 1.3;
  var ZOOM = 1.18;
  var PHOTO = /url\(["']?([^"')]*foto\/[^"')]+\.(?:jpe?g|webp))["']?\)/i;

  var seen = new WeakSet();
  var active = [];
  var sizes = {};

  function naturalSize(src) {
    if (!sizes[src]) {
      sizes[src] = new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () { resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
        img.onerror = function () { resolve(null); };
        img.src = src;
      });
    }
    return sizes[src];
  }

  function fit(el, tries) {
    var m = PHOTO.exec(getComputedStyle(el).backgroundImage);
    if (!m) {
      tries = tries || 0;
      if (tries < 6) setTimeout(function () { fit(el, tries + 1); }, 1000);
      return;
    }
    naturalSize(m[1]).then(function (img) {
      var box = el.getBoundingClientRect();
      if (!img || !box.width || !box.height) return;

      var ratio = (img.w / img.h) / (box.width / box.height);
      el.classList.remove('rw-kb');
      if (ratio < MISMATCH && ratio > 1 / MISMATCH) return;

      var scale = Math.max(box.width / img.w, box.height / img.h);
      var cw = img.w * scale, ch = img.h * scale;
      var wide = ratio >= MISMATCH;

      el.style.setProperty('--kb-s0', (cw * ZOOM).toFixed(1) + 'px ' + (ch * ZOOM).toFixed(1) + 'px');
      el.style.setProperty('--kb-s1', cw.toFixed(1) + 'px ' + ch.toFixed(1) + 'px');
      el.style.setProperty('--kb-p0', wide ? '0% 50%' : '50% 0%');
      el.style.setProperty('--kb-p1', wide ? '100% 50%' : '50% 100%');
      el.classList.add('rw-kb');
    });
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      active.push(e.target);
      fit(e.target);
    });
  }, { rootMargin: '200px' }) : null;

  function scan() {
    var nodes = document.querySelectorAll('.elementor-background-overlay, .elementor-motion-effects-layer, .elementor-section, .elementor-column, .elementor-widget-wrap, .e-gallery-image, .rw-gimg');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (seen.has(el)) continue;
      if (!el.classList.contains('e-gallery-image')) {
        var cs = getComputedStyle(el);
        if (cs.backgroundSize !== 'cover' || !PHOTO.test(cs.backgroundImage)) continue;
      }
      seen.add(el);
      if (io) io.observe(el); else { active.push(el); fit(el); }
    }
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { active.forEach(function (el) { fit(el, 6); }); }, 250);
  });

  window.addEventListener('load', function () {
    scan();
    setTimeout(scan, 1500);
    setTimeout(scan, 4000);
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#btnOpens')) setTimeout(scan, 800);
  });
})();
