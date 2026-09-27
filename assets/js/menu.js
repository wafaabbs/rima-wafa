(function () {
  var menu = document.getElementById('smMenu');
  if (!menu) return;

  var list = menu.querySelector('.satumomen_menu_list');
  var column = document.querySelector('.elementor-element-14d9e34e');
  var entries = [];
  Array.prototype.forEach.call(menu.querySelectorAll('.satumomen_menu_item'), function (li) {
    var sec = document.querySelector('[data-id="' + li.getAttribute('data-target') + '"]');
    if (sec) entries.push({ li: li, btn: li.querySelector('button'), sec: sec });
    else li.hidden = true;
  });
  if (!entries.length) return;

  var current = null;
  var ticking = false;

  // on desktop the invitation lives in a side column, so the bar follows its box
  function place() {
    if (!column) return;
    var r = column.getBoundingClientRect();
    menu.style.left = r.left + 'px';
    menu.style.width = r.width + 'px';
  }

  function center(li, smooth) {
    var left = li.offsetLeft - (list.clientWidth - li.offsetWidth) / 2;
    if (list.scrollTo) list.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
    else list.scrollLeft = left;
  }

  function setActive(e) {
    if (e === current) return;
    if (current) {
      current.li.classList.remove('active');
      current.btn.removeAttribute('aria-current');
    }
    current = e;
    e.li.classList.add('active');
    e.btn.setAttribute('aria-current', 'true');
    center(e.li, true);
  }

  function update() {
    ticking = false;
    var line = window.innerHeight * 0.4;
    var pick = entries[0];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].sec.getBoundingClientRect().top <= line) pick = entries[i];
    }
    setActive(pick);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  entries.forEach(function (e) {
    e.btn.addEventListener('click', function () {
      var top = e.sec.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  function show() {
    if (document.body.classList.contains('rw-menu-on')) return;
    document.body.classList.add('rw-menu-on');
    place();
    update();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    place();
    if (current) center(current.li, false);
  });

  var opener = document.getElementById('btnOpens');
  if (opener) opener.addEventListener('click', function () { setTimeout(show, 400); });
  else show();
})();
