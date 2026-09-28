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

  function record(type, message) {
    client.from('site_monitor').insert({
      event_type: type,
      session_id: session,
      page: location.pathname.slice(0, 180),
      message: message ? String(message).slice(0, 500) : null
    }).then(function (result) {
      if (result.error) console.warn('Monitoring belum tersambung:', result.error.message);
    }).catch(function (error) { console.warn('Monitoring gagal:', error); });
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
