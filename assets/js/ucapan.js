(function () {
  var SUPABASE_URL = 'https://dbxrzlrzabeohenmwewc.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_AAlseXGZK6PiLCYSmhqHJQ_f6KDu65B';

  var root = document.getElementById('rw-wishes');
  if (!root || !window.supabase) return;

  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var ATTEND_LABEL = { hadir: 'Hadir', tidak_hadir: 'Tidak Hadir', ragu: 'Masih Ragu' };

  var els = {
    form: root.querySelector('.rw-form'),
    name: root.querySelector('.rw-form [name=name]'),
    message: root.querySelector('.rw-form [name=message]'),
    attendance: root.querySelector('.rw-form [name=attendance]'),
    trap: root.querySelector('.rw-form [name=website]'),
    submit: root.querySelector('.rw-form button[type=submit]'),
    counter: root.querySelector('.rw-counter'),
    status: root.querySelector('.rw-status'),
    list: root.querySelector('.rw-list'),
    total: root.querySelector('[data-stat=total]'),
    hadir: root.querySelector('[data-stat=hadir]'),
    tidak: root.querySelector('[data-stat=tidak_hadir]'),
    live: root.querySelector('.rw-live')
  };

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  var deviceId = store('rw_device_id');
  if (!deviceId) { deviceId = uuid(); store('rw_device_id', deviceId); }

  els.name.value = store('rw_name') || (window.RW_GUEST || '').slice(0, 50);

  var wishes = new Map();
  var liked = new Set();
  var openReply = null;
  var lastPost = 0;

  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'baru saja';
    if (s < 3600) return Math.floor(s / 60) + ' menit lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' hari lalu';
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function byLikesThenNewest(a, b) {
    return (b.like_count - a.like_count) || (new Date(b.created_at) - new Date(a.created_at));
  }

  function byOldest(a, b) {
    return new Date(a.created_at) - new Date(b.created_at);
  }

  function heartSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.1 0 3.4 1.1 4.2 2.3h3.6c.8-1.2 2.1-2.3 4.2-2.3 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21z');
    svg.appendChild(p);
    return svg;
  }

  function renderItem(w, isReply) {
    var item = el('li', 'rw-item' + (isReply ? ' rw-reply' : ''));
    item.dataset.id = w.id;

    var avatar = el('div', 'rw-avatar', (w.name.trim()[0] || '?').toUpperCase());
    var body = el('div', 'rw-body');

    var head = el('div', 'rw-head');
    head.appendChild(el('span', 'rw-name', w.name));
    if (!isReply && w.attendance) {
      head.appendChild(el('span', 'rw-badge rw-badge-' + w.attendance, ATTEND_LABEL[w.attendance]));
    }
    head.appendChild(el('span', 'rw-time', timeAgo(w.created_at)));

    var actions = el('div', 'rw-actions');
    var likeBtn = el('button', 'rw-like' + (liked.has(w.id) ? ' is-liked' : ''));
    likeBtn.type = 'button';
    likeBtn.setAttribute('aria-pressed', liked.has(w.id) ? 'true' : 'false');
    likeBtn.setAttribute('aria-label', 'Suka');
    likeBtn.appendChild(heartSvg());
    likeBtn.appendChild(el('span', null, String(w.like_count || 0)));
    likeBtn.addEventListener('click', function () { toggleLike(w.id, likeBtn); });
    actions.appendChild(likeBtn);

    var parentId = isReply ? w.parent_id : w.id;
    var replyBtn = el('button', 'rw-reply-btn', 'Balas');
    replyBtn.type = 'button';
    replyBtn.addEventListener('click', function () {
      openReply = openReply === parentId ? null : parentId;
      render();
      var input = els.list.querySelector('.rw-reply-form textarea');
      if (input) input.focus();
    });
    actions.appendChild(replyBtn);

    body.appendChild(head);
    body.appendChild(el('p', 'rw-text', w.message));
    body.appendChild(actions);

    item.appendChild(avatar);
    item.appendChild(body);
    return item;
  }

  function renderReplyForm(parentId) {
    var f = el('form', 'rw-reply-form');
    var name = el('input');
    name.name = 'name';
    name.maxLength = 50;
    name.required = true;
    name.placeholder = 'Nama';
    name.value = els.name.value;
    var msg = el('textarea');
    msg.name = 'message';
    msg.maxLength = 500;
    msg.required = true;
    msg.rows = 2;
    msg.placeholder = 'Tulis balasan...';
    var row = el('div', 'rw-reply-row');
    var cancel = el('button', 'rw-btn rw-btn-ghost', 'Batal');
    cancel.type = 'button';
    cancel.addEventListener('click', function () { openReply = null; render(); });
    var send = el('button', 'rw-btn', 'Kirim');
    send.type = 'submit';
    row.appendChild(cancel);
    row.appendChild(send);
    f.appendChild(name);
    f.appendChild(msg);
    f.appendChild(row);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      send.disabled = true;
      post({ name: name.value, message: msg.value, parent_id: parentId }).then(function (ok) {
        send.disabled = false;
        if (ok) { openReply = null; render(); }
      });
    });
    return f;
  }

  function render() {
    var all = Array.from(wishes.values());
    var tops = all.filter(function (w) { return !w.parent_id; }).sort(byLikesThenNewest);
    var replies = {};
    all.forEach(function (w) {
      if (w.parent_id) (replies[w.parent_id] = replies[w.parent_id] || []).push(w);
    });

    var scroll = els.list.scrollTop;
    var draft = els.list.querySelector('.rw-reply-form');
    var draftName = draft && draft.querySelector('[name=name]').value;
    var draftMsg = draft && draft.querySelector('[name=message]').value;
    var focused = draft && draft.contains(document.activeElement) ? document.activeElement : null;
    var focusName = focused && focused.name;
    var caret = focused && focused.selectionStart;

    els.list.textContent = '';
    if (!tops.length) {
      els.list.appendChild(el('li', 'rw-empty', 'Jadilah yang pertama mengirim ucapan.'));
    }
    tops.forEach(function (w) {
      var item = renderItem(w, false);
      var kids = (replies[w.id] || []).sort(byOldest);
      if (kids.length || openReply === w.id) {
        var sub = el('ul', 'rw-replies');
        kids.forEach(function (r) { sub.appendChild(renderItem(r, true)); });
        item.querySelector('.rw-body').appendChild(sub);
      }
      if (openReply === w.id) {
        var f = renderReplyForm(w.id);
        if (draft) {
          f.querySelector('[name=name]').value = draftName;
          f.querySelector('[name=message]').value = draftMsg;
        }
        item.querySelector('.rw-body').appendChild(f);
      }
      els.list.appendChild(item);
    });
    els.list.scrollTop = scroll;
    if (focusName) {
      var again = els.list.querySelector('.rw-reply-form [name=' + focusName + ']');
      if (again) {
        again.focus({ preventScroll: true });
        try { again.setSelectionRange(caret, caret); } catch (e) {}
      }
    }

    els.total.textContent = tops.length;
    els.hadir.textContent = tops.filter(function (w) { return w.attendance === 'hadir'; }).length;
    els.tidak.textContent = tops.filter(function (w) { return w.attendance === 'tidak_hadir'; }).length;
  }

  var renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; render(); });
  }

  function setStatus(text, isError) {
    els.status.textContent = text || '';
    els.status.classList.toggle('is-error', !!isError);
  }

  function post(data) {
    var name = (data.name || '').trim();
    var message = (data.message || '').trim();
    if (!name || !message) { setStatus('Nama dan ucapan wajib diisi.', true); return Promise.resolve(false); }
    if (Date.now() - lastPost < 8000) { setStatus('Tunggu sebentar sebelum mengirim lagi.', true); return Promise.resolve(false); }

    var row = { name: name, message: message, parent_id: data.parent_id || null };
    if (!row.parent_id) row.attendance = data.attendance || null;

    return db.from('wishes').insert(row).select().single().then(function (res) {
      if (res.error) { setStatus('Gagal mengirim. Coba lagi ya.', true); return false; }
      lastPost = Date.now();
      store('rw_name', name);
      els.name.value = name;
      wishes.set(res.data.id, res.data);
      setStatus('Terima kasih atas ucapannya!');
      scheduleRender();
      return true;
    });
  }

  function toggleLike(id, btn) {
    btn.disabled = true;
    db.rpc('toggle_like', { p_wish_id: id, p_device_id: deviceId }).then(function (res) {
      btn.disabled = false;
      if (res.error || !res.data || !res.data[0]) return;
      var r = res.data[0];
      if (r.liked) liked.add(id); else liked.delete(id);
      var w = wishes.get(id);
      if (w) w.like_count = r.like_count;
      scheduleRender();
    });
  }

  els.message.addEventListener('input', function () {
    els.counter.textContent = els.message.value.length + '/500';
  });

  els.form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (els.trap.value) return;
    els.submit.disabled = true;
    post({ name: els.name.value, message: els.message.value, attendance: els.attendance.value }).then(function (ok) {
      els.submit.disabled = false;
      if (ok) {
        els.message.value = '';
        els.counter.textContent = '0/500';
      }
    });
  });

  function load() {
    return Promise.all([
      db.from('wishes').select('*').order('created_at', { ascending: false }).limit(1000),
      db.rpc('my_likes', { p_device_id: deviceId })
    ]).then(function (res) {
      if (res[0].error) { setStatus('Ucapan belum bisa dimuat.', true); return; }
      res[0].data.forEach(function (w) { wishes.set(w.id, w); });
      (res[1].data || []).forEach(function (id) { liked.add(id); });
      render();
    });
  }

  load().then(function () {
    db.channel('wishes-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishes' }, function (p) {
        if (p.eventType === 'DELETE') wishes.delete(p.old.id);
        else wishes.set(p.new.id, p.new);
        scheduleRender();
      })
      .subscribe(function (state) {
        els.live.classList.toggle('is-on', state === 'SUBSCRIBED');
      });
  });

  setInterval(scheduleRender, 60000);
})();
