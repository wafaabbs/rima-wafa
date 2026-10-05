(function () {
  // Dashboard requests are not page views.
  if (/^\/admin610780\/?$/.test(location.pathname) || !window.supabase) return;
  var client = window.supabase.createClient(
    'https://dbxrzlrzabeohenmwewc.supabase.co',
    'sb_publishable_AAlseXGZK6PiLCYSmhqHJQ_f6KDu65B'
  );
  var session = '';
  try {
    session = sessionStorage.getItem('rw_monitor_session') ||
      (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
    sessionStorage.setItem('rw_monitor_session', session);
  } catch (e) { session = String(Date.now()) + Math.random(); }

  // IP geolocation: geojs.io utama, ipwho.is cadangan. IP-nya sendiri tidak disimpan.
  function fetchJson(url) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 4000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }, function (error) { clearTimeout(timer); throw error; });
  }
  function pickGeo(d) {
    if (!d || d.success === false || !d.country) throw new Error('Lokasi tidak ditemukan');
    function clip(v, n) { return v ? String(v).slice(0, n) : null; }
    return {
      country: clip(d.country, 80),
      country_code: clip(d.country_code, 2),
      region: clip(d.region, 80),
      city: clip(d.city, 80)
    };
  }
  function lookupGeo() {
    try {
      var cached = sessionStorage.getItem('rw_monitor_geo');
      if (cached) return Promise.resolve(JSON.parse(cached));
    } catch (e) {}
    return fetchJson('https://get.geojs.io/v1/ip/geo.json').then(pickGeo)
      .catch(function () { return fetchJson('https://ipwho.is/').then(pickGeo); })
      .then(function (geo) {
        try { sessionStorage.setItem('rw_monitor_geo', JSON.stringify(geo)); } catch (e) {}
        return geo;
      })
      .catch(function () { return null; });
  }

  function insert(row, retry) {
    return client.from('site_monitor').insert(row).then(function (result) {
      // Kolom lokasi belum ada (SQL terbaru belum dijalankan): tetap catat tanpa lokasi.
      if (result.error && retry && 'country' in row) {
        delete row.country; delete row.country_code; delete row.region; delete row.city;
        return insert(row, false);
      }
      if (result.error) console.warn('Monitoring belum tersambung:', result.error.message);
    }).catch(function (error) { console.warn('Monitoring gagal:', error); });
  }

  function record(type, message) {
    var row = {
      event_type: type,
      session_id: session,
      page: location.pathname.slice(0, 180),
      message: message ? String(message).slice(0, 500) : null
    };
    if (type !== 'view') return insert(row, false);
    return lookupGeo().then(function (geo) {
      if (geo) {
        row.country = geo.country; row.country_code = geo.country_code;
        row.region = geo.region; row.city = geo.city;
      }
      return insert(row, true);
    });
  }

  record('view', null);
  window.addEventListener('error', function (event) {
    record('error', (event.message || 'JavaScript error') +
      (event.filename ? ' — ' + event.filename.split('/').pop() : '') +
      (event.lineno ? ':' + event.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    record('error', reason && reason.message ? reason.message : String(reason || 'Unhandled promise rejection'));
  });
})();
