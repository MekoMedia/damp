// ── SERVER & BROWSER CHECKS ──
(function() {
  var ShutdownServer = false;
  var OutageServer = false;
  if (window.self !== window.top) {
    document.getElementById('iframePage').style.display = 'flex';
    document.getElementById('homePage').style.display = 'none';
    return;
  }
  var isChrome = (/Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)) || /CriOS/.test(navigator.userAgent);

if (!isChrome) {
  document.getElementById('browserPage').style.display = 'flex';
  document.getElementById('homePage').style.display = 'none';
  return;
}

  if (ShutdownServer) {
    document.getElementById('shutdownPage').style.display = 'flex';
    document.getElementById('homePage').style.display = 'none';
    return;
  }
  if (OutageServer) {
    document.getElementById('outagePage').style.display = 'flex';
    document.getElementById('homePage').style.display = 'none';
    return;
  }
})();

// ── GLOBALS ──
var unlocked = false;
var currentSource = 'pawnets';
var tmdbId = null;
var currentItem = null;
var currentPlayingEpisode = { season: null, episode: null };
var SMARTLINK = 'https://omg10.com/4/11143489';

// ── TIMER & PROGRESS (global so unlockPlayer can call) ──
var watchStartTime = null;
var watchTimerInterval = null;
var watchProgress = JSON.parse(localStorage.getItem('paw_progress') || '{}');

function startWatchTimer(imdbId, season, episode) {
  watchStartTime = Date.now();
  if (watchTimerInterval) clearInterval(watchTimerInterval);
  watchTimerInterval = setInterval(function() {
    var elapsed = (Date.now() - watchStartTime) / 1000;
    var total = parseDuration((allContent ? allContent.find(function(m) { return m.imdb === imdbId; }) : {})?.duration) || 3600;
    var p = Math.min(100, (elapsed / total) * 100);
    saveWatchProgress(imdbId, p, season, episode);
    if (typeof buildContinueWatching === 'function') buildContinueWatching();
  }, 5000);
}

function stopWatchTimer() {
  if (watchTimerInterval) {
    clearInterval(watchTimerInterval);
    watchTimerInterval = null;
  }
}

function saveWatchProgress(imdbId, percent, season, episode) {
  watchProgress[imdbId] = { percent: percent, season: season || null, episode: episode || null, timestamp: Date.now() };
  localStorage.setItem('paw_progress', JSON.stringify(watchProgress));
}

// ── LOADING OVERLAY ──
function showLoading(msg) {
  var o = document.getElementById('loadingOverlay');
  o.querySelector('.loading-text').textContent = msg || 'Loading...';
  o.classList.add('active');
}
function hideLoading() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

// ── SOURCE SWITCHING WITH CONFIRMATION ──
function getSourceUrl(type, imdb, season, episode) {
  var tmdb = tmdbId || '';
  switch (currentSource) {
    case 'pawnets':
      return type === 'movie'
        ? 'https://nextgencloudfabric.com/embed/movie/' + imdb + '?skin=netflix&color=ff6b00&title=false&sub_lang=en&sub_default=true'
        : 'https://nextgencloudfabric.com/embed/tv/' + imdb + '/' + season + '/' + episode + '?skin=netflix&color=ff6b00&title=false&autoplay=true&sub_lang=en&sub_default=true';
    case 'vidsrc':
      return type === 'movie'
        ? 'https://vidsrc-embed.ru/embed/movie?tmdb=' + tmdb
        : 'https://vidsrc-embed.ru/embed/tv?tmdb=' + tmdb + '&season=' + season + '&episode=' + episode + '&ds_lang=en';
    case 'videasy':
      return type === 'movie'
        ? 'https://player.videasy.net/movie/' + tmdb
        : 'https://player.videasy.net/tv/' + tmdb + '/' + season + '/' + episode;
    case 'hnembed':
      return type === 'movie'
        ? 'https://hnembed.cc/embed/movie/' + (tmdb || imdb)
        : 'https://hnembed.cc/embed/tv/' + (tmdb || imdb) + '/' + season + '/' + episode;
    default:
      return '';
  }
}

function createPlayerWithSource() {
  if (!currentItem) return;
  var imdb = currentItem.imdb;
  var type = currentItem.type;
  var s = currentPlayingEpisode.season || 1;
  var e = currentPlayingEpisode.episode || 1;
  var url = getSourceUrl(type, imdb, s, e);
  var wrapper = document.getElementById('playerWrapper');
  if (!wrapper) return;

  if (unlocked) {
    wrapper.innerHTML =
      '<div class="player-cover-bar visible" id="playerCoverBar">' +
      (type === 'series' ? 'S' + s + 'E' + e : '') +
      '</div><iframe src="' + url + '" allowfullscreen allow="autoplay;encrypted-media;picture-in-picture" id="watchIframe" style="position:absolute;inset:0;width:100%;height:100%;border:none;"></iframe>';
    var coverBar = document.getElementById('playerCoverBar');
    if (coverBar) coverBar.classList.add('visible');
    document.getElementById('sourceBar').style.display = 'flex';
    if (currentItem.type === 'series') {
      document.getElementById('episodeSection').style.display = 'block';
    }
  } else {
    wrapper.innerHTML =
      '<div class="player-cover-bar" id="playerCoverBar"></div>' +
      '<div class="player-lock" id="playerLock">' +
      '<span style="font-size:42px;">🔒</span>' +
      '<p>An ad page may open in a new tab</p>' +
      '<p style="font-size:0.7rem;color:#aaa;">Simply close it and come back here</p>' +
      '<button class="unlock-btn" onclick="MVC.unlockPlayer()">🔓 Unlock Now</button>' +
      '</div>';
    document.getElementById('sourceBar').style.display = 'none';
    if (currentItem && currentItem.type === 'series') {
      document.getElementById('episodeSection').style.display = 'none';
    }
  }
}

function showSourceConfirm(src, callback) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:#111;border:1px solid var(--orange);border-radius:14px;padding:1.8rem;max-width:420px;width:92%;text-align:center;">
      <div style="font-size:2.5rem;margin-bottom:0.5rem;">⚠️</div>
      <h3 style="color:var(--orange);margin-bottom:0.3rem;">Unverified Source</h3>
      <p style="color:#ccc;font-size:0.85rem;line-height:1.6;margin-bottom:1rem;">
        <strong>${src.toUpperCase()}</strong> is not verified and may contain malicious ads or malware.<br>
        <span style="color:var(--orange);">PawNets</span> is the main source and the safest.
      </p>
      <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;">
        <button class="source-confirm-btn" data-action="cancel" style="background:transparent;border:1px solid #555;color:#aaa;padding:0.5rem 1.2rem;border-radius:20px;cursor:pointer;font-weight:600;">Cancel</button>
        <button class="source-confirm-btn" data-action="proceed" style="background:var(--orange);border:none;color:#000;padding:0.5rem 1.2rem;border-radius:20px;cursor:pointer;font-weight:700;">I Know</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  var btns = overlay.querySelectorAll('.source-confirm-btn');
  btns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      var action = this.getAttribute('data-action');
      overlay.remove();
      if (action === 'proceed') callback(true);
      else callback(false);
    });
  });
}

function switchSource(src) {
  if (src === currentSource) return;
  function doSwitch(proceed) {
    if (!proceed) return;
    currentSource = src;
    document.querySelectorAll('.source-btn').forEach(function(b) {
      b.classList.remove('active');
    });
    var btn = document.querySelector('.source-btn[data-src="' + src + '"]');
    if (btn) btn.classList.add('active');
    if (unlocked && currentItem) {
      createPlayerWithSource();
    }
  }
  if (src === 'pawnets') {
    doSwitch(true);
  } else {
    showSourceConfirm(src, doSwitch);
  }
}

function unlockPlayer() {
  window.open(SMARTLINK, '_blank');
  unlocked = true;
  stopWatchTimer();
  var imdb = currentItem?.imdb;
  if (!imdb) return;
  createPlayerWithSource();
  if (currentItem.type === 'movie') {
    startWatchTimer(imdb, null, null);
  } else {
    startWatchTimer(imdb, currentPlayingEpisode.season || 1, currentPlayingEpisode.episode || 1);
    if (typeof updateNextEpisodeBar === 'function') {
      updateNextEpisodeBar(imdb, currentPlayingEpisode.season || 1, currentPlayingEpisode.episode || 1);
    }
  }
}

// ── EPISODE COLLAPSE ──
function toggleEpisodeCollapse() {
  var sec = document.getElementById('episodeSection');
  var btn = document.getElementById('epCollapseBtn');
  sec.classList.toggle('collapsed');
  btn.textContent = sec.classList.contains('collapsed') ? '▼ Show' : '▲ Hide';
}

// ── MAIN APPLICATION ──
(function() {
  'use strict';
  var JSON_URL = 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/data.json';
  var OMDB_API = 'https://www.omdbapi.com/?apikey=thewdb&';
  var EMBOS_BASE = 'https://nextgencloudfabric.com';

  var lastWatchedEpisode = JSON.parse(localStorage.getItem('paw_last_episode') || '{}');
  var allContent = [],
    filteredContent = [],
    currentTab = 'all',
    currentGenre = 'all',
    currentPage = 1;
  var heroIndex = 0,
    heroTotal = 0;
  var currentView = 'home',
    homePageVisible = true;
  var watchedEpisodes = JSON.parse(localStorage.getItem('paw_watched_eps') || '{}');
  var remindedSeries = JSON.parse(localStorage.getItem('paw_reminded') || '{}');
  var inboxMessages = JSON.parse(localStorage.getItem('paw_inbox') || '[]');
  var watchlist = JSON.parse(localStorage.getItem('paw_watchlist') || '[]');
  var actorCache = JSON.parse(localStorage.getItem('paw_actors') || '{}');

  // ----- Helpers -----
  function escH(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }
  function cleanPoster(url) {
    if (!url || url.includes('$') || !url.startsWith('http')) return '';
    return url;
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text || '';
  }
  function parseDuration(durStr) {
    if (!durStr) return 3600;
    var m = durStr.match(/(\d+)\s*min/);
    if (m) return parseInt(m[1]) * 60;
    var h = durStr.match(/(\d+)h\s*(\d+)?/);
    if (h) return parseInt(h[1]) * 3600 + (parseInt(h[2] || 0) * 60);
    return 3600;
  }
  // Make parseDuration globally available for the timer function
  window.parseDuration = parseDuration;

  setTimeout(function() {
    document.getElementById('introSplash').classList.add('hide');
    homePageVisible = true;
  }, 2000);

  window.changeFontSize = function(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    document.getElementById('fontSizeValue').textContent = size + 'px';
  };
  window.changeBgColor = function(color) {
    document.documentElement.style.setProperty('--bg', color);
  };

  function deduplicateContent() {
    var s = new Set();
    allContent = allContent.filter(function(m) {
      if (s.has(m.imdb)) return false;
      s.add(m.imdb);
      return true;
    });
  }

  function showStatusModal(title, body, extra) {
    var m = document.getElementById('statusModal');
    if (!m) return;
    m.classList.add('open');
    m.querySelector('.status-title').textContent = title;
    m.querySelector('.status-body').textContent = body + (extra ? '\n' + extra : '');
  }
  window.closeStatusModal = function() {
    document.getElementById('statusModal').classList.remove('open');
  };
  window.addEventListener('online', function() {
    if (document.querySelector('.status-title')?.textContent === 'Connection Lost') closeStatusModal();
  });
  window.addEventListener('offline', function() {
    showStatusModal('Connection Lost', 'Check your wifi/data.');
  });

  // ----- Data Loading -----
  async function loadData() {
    try {
      var r = await fetch(JSON_URL);
      var d = await r.json();
      allContent = (d.movies || []).map(function(m) {
        return {
          imdb: String(m.imdb || ''),
          title: m.title,
          type: m.type || ((m.seasons && m.seasons.length) ? 'series' : 'movie'),
          rating: String(m.rating || ''),
          release: m.release,
          poster: cleanPoster(m.poster),
          quality: m.quality || 'HD',
          genre: m.genre || [],
          actors: m.actors || [],
          director: m.director || '',
          country: m.country || '',
          duration: m.duration || '',
          description: m.description || '',
          seasons: m.seasons || null,
          popularity: m.popularity || Math.floor(Math.random() * 60)
        };
      });
      allContent = allContent.filter(function(m) {
        if (m.rating === '?' || !m.rating) return false;
        if (m.type === 'series') {
          if (!m.seasons || !Array.isArray(m.seasons) || m.seasons.length === 0) {
            var hasAnyEpisodes = (m.seasons || []).some(function(s) { return s.episodes && s.episodes.length > 0; });
            if (!hasAnyEpisodes) return false;
          }
        }
        if (!m.imdb || !m.title) return false;
        return true;
      });
      deduplicateContent();
      // Make allContent globally accessible for timer
      window.allContent = allContent;
      buildGenreSelect();
      buildHero();
      buildContinueWatching();
      buildTrendingRow();
      buildThrowbackRow();
      buildPopularRows();
      applyFilters();
      checkRemindedSeries();
      updateInboxBadge();
      handlePageRouting();
    } catch (e) {
      showStatusModal('Server Outage Connection', 'Error: 0');
    }
  }

  // ----- UI Builders -----
  function buildGenreSelect() {
    var g = new Set();
    allContent.forEach(function(m) {
      (m.genre || []).forEach(function(x) { g.add(x); });
    });
    var s = document.getElementById('genreSelect');
    if (!s) return;
    Array.from(g).sort().forEach(function(x) {
      var o = document.createElement('option');
      o.value = x;
      o.textContent = x;
      s.appendChild(o);
    });
  }

  function buildHero() {
    var c = document.getElementById('heroCarousel'),
      t = document.getElementById('heroTrack'),
      d = document.getElementById('heroDots');
    if (!c || !t || !d) return;
    var heroIds = ['tt29355505', 'tt34809853', 'tt39400589', 'tt39749708', 'tt32093575', 'tt34440854', 'tt32547691', 'tt32550889'];
    var items = heroIds.map(function(id) { return allContent.find(function(m) { return m.imdb === id; }); }).filter(function(x) { return x && x.poster; });
    if (!items.length) { c.style.display = 'none'; return; }
    heroTotal = items.length;
    heroIndex = 0;
    t.innerHTML = items.map(function(m) {
      return '<div class="hero-slide" style="background-image:url(' + m.poster + ')" onclick="MVC.openWatch(\'' + m.imdb + '\')"><div class="hero-gradient"></div><div class="hero-info-bar"><div><h3>' + escH(m.title) + '</h3><p class="hero-meta">⭐ ' + (m.rating || '?') + ' • ' + (m.release || '') + ' • ' + (m.quality || 'HD') + '</p></div><button class="hero-btn" onclick="event.stopPropagation();MVC.openWatch(\'' + m.imdb + '\')">▶ Watch</button></div></div>';
    }).join('');
    d.innerHTML = items.map(function(_, i) {
      return '<button class="hero-dot' + (i === 0 ? ' active' : '') + '" onclick="MVC.heroGoTo(' + i + ')"></button>';
    }).join('');
  }

  function heroSlide(delta) {
    heroIndex = (heroIndex + delta + heroTotal) % heroTotal;
    updateHero();
  }
  function heroGoTo(i) {
    heroIndex = i;
    updateHero();
  }
  function updateHero() {
    document.getElementById('heroTrack').style.transform = 'translateX(-' + (heroIndex * 100) + '%)';
    document.querySelectorAll('.hero-dot').forEach(function(d, i) {
      d.classList.toggle('active', i === heroIndex);
    });
  }

  // Expose updateNextEpisodeBar globally so unlockPlayer can call it
  function updateNextEpisodeBar(imdbId, currentSeason, currentEp) {
    var bar = document.getElementById('nextEpisodeBar');
    if (!bar || !currentItem || currentItem.type !== 'series') {
      if (bar) bar.style.display = 'none';
      return;
    }
    var cards = document.querySelectorAll('#episodeGrid .episode-card:not([style*="cursor:not-allowed"])');
    var episodes = [];
    cards.forEach(function(card) {
      var ep = parseInt(card.getAttribute('data-ep'));
      var season = parseInt(card.getAttribute('data-season'));
      var title = card.querySelector('.ep-title')?.textContent || '';
      episodes.push({ season: season, episode: ep, title: title });
    });
    var currentIndex = episodes.findIndex(function(e) { return e.season === currentSeason && e.episode === currentEp; });
    if (currentIndex === -1) { bar.style.display = 'none'; return; }
    var nextEp = episodes[currentIndex + 1];
    if (!nextEp) {
      var tabs = document.querySelectorAll('#seasonTabs .season-tab');
      var ns = null;
      tabs.forEach(function(tab) {
        var s = parseInt(tab.getAttribute('data-season'));
        if (s === currentSeason + 1) ns = s;
      });
      if (ns) {
        bar.innerHTML = '<span class="next-ep-label">Next Season</span><span class="next-ep-title">Season ' + ns + ' - Episode 1</span><button class="action-btn" onclick="MVC.switchSeason(' + ns + ',\'' + imdbId + '\')">▶ Go</button>';
      } else {
        bar.innerHTML = '<span class="next-ep-label">You Have Finished All Episode</span>';
      }
      bar.style.display = 'flex';
      return;
    }
    bar.innerHTML = '<span class="next-ep-label">Next Episode</span><span class="next-ep-title">Ep ' + nextEp.episode + ' - ' + escH(nextEp.title) + '</span><button class="action-btn" onclick="MVC.playEpisode(\'' + imdbId + '\',' + nextEp.season + ',' + nextEp.episode + ')">▶ Play</button>';
    bar.style.display = 'flex';
  }
  window.updateNextEpisodeBar = updateNextEpisodeBar;

  function buildContinueWatching() {
    var s = document.getElementById('continueSection'),
      sc = document.getElementById('continueScroll');
    if (!s || !sc) return;
    var e = Object.entries(watchProgress).filter(function(x) {
      return allContent.find(function(m) { return m.imdb === x[0]; });
    }).sort(function(a, b) { return b[1].timestamp - a[1].timestamp; }).slice(0, 10);
    if (!e.length) { s.style.display = 'none'; return; }
    s.style.display = 'block';
    sc.innerHTML = e.map(function(x) {
      var imdb = x[0],
        d = x[1],
        item = allContent.find(function(m) { return m.imdb === imdb; });
      if (!item) return '';
      var p = d.percent || 0,
        sub = item.type === 'series' ? 'S' + (d.season || 1) + 'E' + (d.episode || 1) + ' • ' + Math.round(p) + '%' : Math.round(p) + '% watched';
      return '<div class="c-card" onclick="MVC.openWatch(\'' + imdb + '\')"><div class="c-thumb"><img src="' + (item.poster || '') + '" onerror="this.style.display=\'none\'"><div class="c-prog"><div class="c-prog-bar" style="width:' + p + '%"></div></div><button class="c-rm" onclick="event.stopPropagation();MVC.removeContinue(\'' + imdb + '\')">✕</button></div><div class="c-info"><div class="c-title">' + escH(item.title) + '</div><div class="c-sub">' + sub + '</div></div></div>';
    }).join('');
  }
  window.buildContinueWatching = buildContinueWatching;

  function removeContinue(imdbId) {
    delete watchProgress[imdbId];
    localStorage.setItem('paw_progress', JSON.stringify(watchProgress));
    buildContinueWatching();
  }

  function buildTrendingRow() {
    var row = document.getElementById('trendingRow');
    if (!row) return;
    var currentYear = new Date().getFullYear();
    var trending = allContent.filter(function(m) {
      var releaseYear = parseInt(m.release);
      return releaseYear >= currentYear - 1;
    }).sort(function(a, b) {
      var ratingA = parseFloat(a.liveRating || a.rating || 0);
      var ratingB = parseFloat(b.liveRating || b.rating || 0);
      return ratingB - ratingA;
    }).slice(0, 12);
    if (trending.length < 8) {
      var remaining = allContent.filter(function(m) {
        var releaseYear = parseInt(m.release);
        return releaseYear < currentYear - 1;
      }).sort(function(a, b) {
        return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
      }).slice(0, 12 - trending.length);
      trending = trending.concat(remaining);
    }
    row.innerHTML = trending.map(function(m) {
      var displayRating = m.liveRating || m.rating || '?';
      var ratingColor = m.liveRating ? 'var(--orange)' : 'var(--gray)';
      return '<div class="row-card" onclick="MVC.openWatch(\'' + m.imdb + '\')"><img class="row-card-img" src="' + (m.poster || '') + '" onerror="this.style.display=\'none\'">' + (m.type === 'series' ? '<span class="row-card-badge">📺</span>' : '') + '<div class="row-card-info"><div class="row-card-title">' + escH(m.title) + '</div><div class="row-card-meta"><span class="row-card-rating" id="trating-' + m.imdb + '" style="background:' + ratingColor + '">⭐ ' + displayRating + '</span><span>' + (m.release || '') + '</span></div></div><button class="row-card-play">▶</button></div>';
    }).join('');
    trending.forEach(async function(m) {
      if (!m.liveRating) {
        try {
          var res = await fetch(OMDB_API + 'i=' + m.imdb + '&plot=short');
          var data = await res.json();
          if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
            m.liveRating = data.imdbRating;
            var el = document.getElementById('trating-' + m.imdb);
            if (el) {
              el.textContent = '⭐ ' + data.imdbRating;
              el.style.background = 'var(--orange)';
            }
          }
        } catch (e) {}
      }
    });
  }

  async function buildThrowbackRow() {
    var row = document.getElementById('throwbackRow');
    if (!row) return;
    row.innerHTML = '<span style="color:var(--gray);font-size:0.65rem;padding:1rem;">Digging up throwbacks...</span>';
    var currentYear = new Date().getFullYear();
    var throwbacks = allContent.filter(function(m) {
      var year = parseInt(m.release);
      return year && year < currentYear;
    });
    for (var s = throwbacks.length - 1; s > 0; s--) {
      var r = Math.floor(Math.random() * (s + 1));
      var temp = throwbacks[s];
      throwbacks[s] = throwbacks[r];
      throwbacks[r] = temp;
    }
    var candidates = throwbacks.slice(0, 20);
    var batchSize = 5;
    var rated = [];
    for (var i = 0; i < candidates.length; i += batchSize) {
      var batch = candidates.slice(i, i + batchSize);
      var promises = batch.map(async function(m) {
        if (m.liveRating && m.liveRating >= 6.5) { rated.push(m); return; }
        try {
          var res = await fetch(OMDB_API + 'i=' + m.imdb + '&plot=short');
          var data = await res.json();
          if (data.Response === 'True' && data.imdbRating && data.imdbRating !== 'N/A') {
            var rating = parseFloat(data.imdbRating);
            if (!isNaN(rating) && rating >= 6.5) {
              m.liveRating = rating;
              rated.push(m);
            }
          }
        } catch (e) {}
      });
      await Promise.all(promises);
    }
    rated.sort(function(a, b) { return (b.liveRating || 0) - (a.liveRating || 0); });
    var finalThrowbacks = rated.slice(0, 12);
    row.innerHTML = finalThrowbacks.map(function(m) {
      var year = parseInt(m.release);
      var age = currentYear - year;
      var ageEmoji = age >= 20 ? '📼' : age >= 10 ? '💿' : age >= 5 ? '📀' : '🔄';
      var displayRating = m.liveRating || m.rating || '?';
      var ratingColor = m.liveRating ? '#8B4513' : 'var(--gray)';
      return '<div class="row-card" onclick="MVC.openWatch(\'' + m.imdb + '\')"><img class="row-card-img" src="' + (m.poster || '') + '" loading="lazy" onerror="this.style.display=\'none\'"><span class="row-card-badge" style="background:#8B4513;">' + ageEmoji + ' ' + (m.release || '') + '</span>' + (m.type === 'series' ? '<span class="row-card-badge" style="top:22px;">📺</span>' : '') + '<div class="row-card-info"><div class="row-card-title">' + escH(m.title) + '</div><div class="row-card-meta"><span class="row-card-rating" style="background:' + ratingColor + ';">⭐ ' + displayRating + '</span><span style="color:#ccc;">Throwback</span></div></div><button class="row-card-play">▶</button></div>';
    }).join('');
  }

  function buildPopularRows() {
    var movies = allContent.filter(function(m) { return m.type === 'movie'; }).sort(function(a, b) { return (b.popularity || 0) - (a.popularity || 0); }).slice(0, 12);
    var series = allContent.filter(function(m) { return m.type === 'series'; }).sort(function(a, b) { return (b.popularity || 0) - (a.popularity || 0); }).slice(0, 12);
    var mRow = document.getElementById('popularMoviesRow');
    if (mRow) {
      mRow.innerHTML = movies.map(function(m) {
        return '<div class="row-card" onclick="MVC.openWatch(\'' + m.imdb + '\')"><img class="row-card-img" src="' + (m.poster || '') + '" onerror="this.style.display=\'none\'"><div class="row-card-info"><div class="row-card-title">' + escH(m.title) + '</div><div class="row-card-meta"><span class="row-card-rating">⭐ ' + (m.rating || '?') + '</span><span>' + (m.release || '') + '</span></div></div><button class="row-card-play">▶</button></div>';
      }).join('');
    }
    var sRow = document.getElementById('popularSeriesRow');
    if (sRow) {
      sRow.innerHTML = series.map(function(m) {
        return '<div class="row-card" onclick="MVC.openWatch(\'' + m.imdb + '\')"><img class="row-card-img" src="' + (m.poster || '') + '" onerror="this.style.display=\'none\'"><span class="row-card-badge">📺</span><div class="row-card-info"><div class="row-card-title">' + escH(m.title) + '</div><div class="row-card-meta"><span class="row-card-rating">⭐ ' + (m.rating || '?') + '</span><span>' + (m.release || '') + '</span></div></div><button class="row-card-play">▶</button></div>';
      }).join('');
    }
  }

  // ----- Watch Page -----
  async function openWatch(imdbId) {
    homePageVisible = false;
    currentView = 'watch';
    unlocked = false;
    currentSource = 'pawnets';
    document.querySelectorAll('.source-btn').forEach(function(b) { b.classList.remove('active'); });
    var defBtn = document.querySelector('.source-btn[data-src="pawnets"]');
    if (defBtn) defBtn.classList.add('active');
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.add('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.remove('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.add('hidden');
    closeSearchTab();
    document.getElementById('sourceBar').style.display = 'none';
    document.getElementById('playerWrapper').innerHTML =
      '<div class="player-cover-bar" id="playerCoverBar"></div><div class="player-lock" id="playerLock"><span style="font-size:42px;">🔒</span><p>An ad page may open in a new tab</p><p style="font-size:0.7rem;color:#aaa;">Simply close it and come back here</p><button class="unlock-btn" onclick="MVC.unlockPlayer()">🔓 Unlock Now</button></div>';
    currentPlayingEpisode = { season: null, episode: null };
    showLoading('Loading details...');
    try {
      var res = await fetch(OMDB_API + 'i=' + imdbId + '&plot=full');
      var data = await res.json();
      if (data.Response === 'True') {
        currentItem = {
          imdb: imdbId,
          type: data.Type === 'series' ? 'series' : 'movie',
          title: data.Title,
          year: data.Year,
          duration: data.Runtime,
          rating: data.imdbRating,
          genre: data.Genre?.split(', ') || [],
          actors: data.Actors?.split(', ') || [],
          director: data.Director,
          country: data.Country,
          description: data.Plot,
          poster: data.Poster !== 'N/A' ? data.Poster : ''
        };
        setText('watchTitle', currentItem.title);
        setText('watchYear', currentItem.year);
        setText('watchDesc', currentItem.description);
        setText('watchQuality', 'HD');
        setText('detailGenre', currentItem.genre.join(', ') || 'N/A');
        setText('detailDirector', currentItem.director || 'N/A');
        setText('detailCountry', currentItem.country || 'N/A');
        setText('detailYear', currentItem.year);
        setText('detailImdb', currentItem.rating ? '⭐ ' + currentItem.rating : '⭐ N/A');
        var ce = document.getElementById('detailCast');
        if (ce) {
          ce.innerHTML = (currentItem.actors || []).map(function(a) {
            return '<span class="actor-link" onclick="event.stopPropagation();MVC.goActors();MVC.searchActor(\'' + escH(a) + '\')">' + escH(a) + '</span>';
          }).join(', ') || 'N/A';
        }
        var st = document.getElementById('watchSeriesTag'),
          es = document.getElementById('episodeSection'),
          wd = document.getElementById('watchDuration'),
          wsm = document.getElementById('watchSeriesMeta'),
          rb = document.getElementById('remindBtn');
        if (currentItem.type === 'series') {
          if (st) st.style.display = 'inline';
          if (wd) wd.textContent = 'Series';
          if (es) { es.style.display = 'none'; }
          if (wsm) wsm.style.display = 'block';
          if (rb) { rb.style.display = 'flex';
            checkRemindButton(); }
          var lastEp = getLastWatchedEpisode(imdbId);
          currentPlayingEpisode = { season: lastEp.season, episode: lastEp.episode };
          await loadSeriesEpisodesWithResume(imdbId, lastEp.season, lastEp.episode);
        } else {
          if (st) st.style.display = 'none';
          if (wd) wd.textContent = currentItem.duration || '';
          if (es) es.style.display = 'none';
          if (wsm) wsm.style.display = 'none';
          if (rb) rb.style.display = 'none';
        }
        checkWatchlistButton();
        loadRelated();
        document.title = currentItem.title + ' - PawNets';
        try {
          var tmdbRes = await fetch('https://api.themoviedb.org/3/find/' + imdbId + '?api_key=4e44d9029b1270a757cddc766a1bcb63&external_source=imdb_id');
          var tmdbData = await tmdbRes.json();
          if (currentItem.type === 'movie' && tmdbData.movie_results && tmdbData.movie_results.length) {
            tmdbId = tmdbData.movie_results[0].id;
          } else if (currentItem.type === 'series' && tmdbData.tv_results && tmdbData.tv_results.length) {
            tmdbId = tmdbData.tv_results[0].id;
          }
        } catch (e) {}
      }
    } catch (e) {
      showStatusModal('Error', 'Failed to load details');
    }
    hideLoading();
    if (window.history && window.history.pushState) window.history.pushState({}, '', '?watch=' + imdbId);
  }

  function exitWatchPage() {
    stopWatchTimer();
    unlocked = false;
    currentSource = 'pawnets';
    var iframe = document.getElementById('watchIframe');
    if (iframe) {
      iframe.src = '';
      iframe.remove();
    }
    var wrapper = document.getElementById('playerWrapper');
    if (wrapper) {
      wrapper.innerHTML =
        '<div class="player-cover-bar" id="playerCoverBar"></div><div class="player-lock" id="playerLock"><span style="font-size:42px;">🔒</span><p>An ad page may open in a new tab</p><p style="font-size:0.7rem;color:#aaa;">Simply close it and come back here</p><button class="unlock-btn" onclick="MVC.unlockPlayer()">🔓 Unlock Now</button></div>';
    }
    document.getElementById('sourceBar').style.display = 'none';
    var coverBar = document.getElementById('playerCoverBar');
    if (coverBar) { coverBar.classList.remove('visible');
      coverBar.textContent = ''; }
    document.getElementById('episodeSection').style.display = 'none';
    currentItem = null;
    currentPlayingEpisode = { season: null, episode: null };
    tmdbId = null;
    document.querySelectorAll('.source-btn').forEach(function(b) { b.classList.remove('active'); });
    var defBtn = document.querySelector('.source-btn[data-src="pawnets"]');
    if (defBtn) defBtn.classList.add('active');
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.remove('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.remove('hidden');
    homePageVisible = true;
    currentView = 'home';
    updateBottomNavActive('home');
    buildContinueWatching();
    applyFilters();
    if (window.history && window.history.pushState) window.history.pushState({}, '', window.location.pathname);
  }

  function navigateHome() {
    closeSearchTab();
    currentView = 'home';
    homePageVisible = true;
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.remove('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.remove('hidden');
    document.body.style.overflow = '';
    updateBottomNavActive('home');
    stopWatchTimer();
    currentItem = null;
    unlocked = false;
    buildContinueWatching();
    applyFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.history && window.history.pushState) window.history.pushState({}, '', window.location.pathname);
  }

  // ----- Filtering & Pagination -----
  function switchTab(tab, btn) {
    currentTab = tab;
    currentPage = 1;
    document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    applyFilters();
  }

  function filterGenre(genre) {
    currentGenre = genre;
    currentPage = 1;
    applyFilters();
  }

  function applyFilters() {
    var list = allContent.slice();
    if (currentTab === 'movies') list = list.filter(function(m) { return m.type === 'movie'; });
    else if (currentTab === 'series') list = list.filter(function(m) { return m.type === 'series'; });
    else if (currentTab === 'trending') list.sort(function(a, b) { return (b.popularity || 0) - (a.popularity || 0); });
    else if (currentTab === 'topRated') list.sort(function(a, b) { return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0); });
    if (currentGenre !== 'all') {
      list = list.filter(function(m) {
        return (m.genre || []).some(function(g) { return g.toLowerCase() === currentGenre.toLowerCase(); });
      });
    }
    var sort = document.getElementById('sortSelect')?.value || 'default';
    if (sort === 'rating') list.sort(function(a, b) { return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0); });
    else if (sort === 'title') list.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
    else list.sort(function(a, b) { return (b.release || 0) - (a.release || 0); });
    filteredContent = list;
    document.getElementById('sectionTitle').textContent = {
      all: 'All Content',
      movies: '🎥 Movies',
      series: '📺 TV Series',
      trending: '🔥 Trending',
      topRated: '⭐ Top Rated'
    } [currentTab] || 'All Content';
    renderPage();
  }

  function renderPage() {
    var pp = 48;
    var total = Math.ceil(filteredContent.length / pp);
    if (currentPage > total) currentPage = 1;
    var items = filteredContent.slice((currentPage - 1) * pp, currentPage * pp);
    var g = document.getElementById('moviesGrid'),
      pg = document.getElementById('pagination');
    if (g) {
      g.innerHTML = items.length ? items.map(function(m) {
        return '<div class="movie-card" onclick="MVC.openWatch(\'' + m.imdb + '\')"><div class="poster-wrap"><img src="' + (m.poster || '') + '" onerror="this.parentElement.innerHTML=\'<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--orange);font-size:2rem;>🎬</div>\'"><span class="quality-badge">' + (m.quality || 'HD') + '</span>' + (m.type === 'series' ? '<span class="type-badge">📺</span>' : '') + '<div class="poster-overlay"><div class="play-circle">▶</div></div></div><div class="card-info"><div class="card-title">' + escH(m.title) + '</div><div class="card-meta"><span class="card-rating" id="rating-' + m.imdb + '">⭐ ' + (m.rating || '?') + '</span><span>' + (m.release || '') + '</span></div></div></div>';
      }).join('') : '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;"><p>Nothing found</p></div>';
    }
    if (pg) {
      if (total > 1) {
        pg.innerHTML = Array.from({ length: total }, function(_, i) {
          var pageNum = i + 1;
          var activeClass = pageNum === currentPage ? ' active' : '';
          return '<button class="page-btn' + activeClass + '" onclick="MVC.goToPage(' + pageNum + ')">' + pageNum + '</button>';
        }).join('');
      } else {
        pg.innerHTML = '';
      }
    }
  }

  function goToPage(p) {
    currentPage = p;
    renderPage();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }

  // ----- Search -----
  function openSearchPage() {
    if (currentView === 'search') return;
    currentView = 'search';
    homePageVisible = false;
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.remove('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.remove('hidden');
    updateBottomNavActive('search');
    var sp = document.getElementById('searchPage');
    if (!sp) {
      sp = document.createElement('div');
      sp.id = 'searchPage';
      sp.className = 'search-fullpage';
      sp.innerHTML = '<div class="search-fullpage-header"><div class="search-fullpage-input-wrap"><span class="search-fullpage-icon">🔍</span><input type="text" class="search-fullpage-input" id="searchFullInput" placeholder="Search movies, series, actors..." autocomplete="off"><button class="search-fullpage-close" onclick="MVC.closeSearchTab()">✕</button></div></div><div class="search-fullpage-results"><div class="search-fullpage-count" id="searchFullCount"></div><div class="movies-grid" id="searchFullGrid"></div><div class="search-fullpage-empty" id="searchFullEmpty" style="display:none;"></div></div>';
      document.body.appendChild(sp);
      var inp = document.getElementById('searchFullInput');
      inp.addEventListener('input', function() {
        var q = this.value.trim();
        if (q.length >= 1) { renderSearchResults(q); } else {
          document.getElementById('searchFullCount').textContent = '';
          document.getElementById('searchFullGrid').innerHTML = '';
          document.getElementById('searchFullEmpty').style.display = 'none';
        }
      });
      inp.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') MVC.closeSearchTab();
      });
    }
    var fi = document.getElementById('searchFullInput');
    if (fi) fi.value = '';
    document.getElementById('searchFullCount').textContent = '';
    document.getElementById('searchFullGrid').innerHTML = '';
    document.getElementById('searchFullEmpty').style.display = 'none';
    sp.classList.add('active');
    sp.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(function() { if (fi) fi.focus(); }, 300);
    if (window.history && window.history.pushState) window.history.pushState({ search: true }, '', '?search');
  }

  function closeSearchTab() {
    var sp = document.getElementById('searchPage');
    if (sp) { sp.classList.remove('active');
      sp.style.display = 'none'; }
    var fi = document.getElementById('searchFullInput');
    if (fi) fi.value = '';
    var countEl = document.getElementById('searchFullCount');
    var gridEl = document.getElementById('searchFullGrid');
    var emptyEl = document.getElementById('searchFullEmpty');
    if (countEl) countEl.textContent = '';
    if (gridEl) gridEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  function renderSearchResults(q) {
    var g = document.getElementById('searchFullGrid'),
      ce = document.getElementById('searchFullCount'),
      ee = document.getElementById('searchFullEmpty');
    if (!g || !ce) return;
    var matches = allContent.filter(function(m) {
      var t = (m.title || '').toLowerCase();
      var gn = (m.genre || []).join(' ').toLowerCase();
      var ac = (m.actors || []).join(' ').toLowerCase();
      var ql = q.toLowerCase();
      return t.includes(ql) || gn.includes(ql) || ac.includes(ql);
    });
    ce.textContent = matches.length + ' result' + (matches.length !== 1 ? 's' : '') + ' for "' + q + '"';
    if (matches.length) {
      ee.style.display = 'none';
      g.style.display = 'grid';
      g.innerHTML = matches.map(function(m) {
        return '<div class="movie-card" onclick="MVC.searchAndWatch(\'' + m.imdb + '\')"><div class="poster-wrap"><img src="' + (m.poster || '') + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--orange);font-size:2rem;>🎬</div>\'"><span class="quality-badge">' + (m.quality || 'HD') + '</span>' + (m.type === 'series' ? '<span class="type-badge">📺</span>' : '') + '<div class="poster-overlay"><div class="play-circle">▶</div></div></div><div class="card-info"><div class="card-title">' + escH(m.title) + '</div><div class="card-meta"><span class="card-rating">⭐ ' + (m.rating || '?') + '</span><span>' + (m.release || '') + '</span></div></div></div>';
      }).join('');
    } else {
      g.style.display = 'none';
      g.innerHTML = '';
      ee.style.display = 'block';
      ee.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--gray);"><div style="font-size:3rem;margin-bottom:1rem;">🔍</div><h3>No results found for "' + escH(q) + '"</h3><p style="margin-bottom:1rem;">Try a different search term</p><button class="request-btn" onclick="MVC.openRequestForm()" style="display:inline-flex;margin:0 auto;">📩 Request This Title</button></div>';
    }
  }

  function searchAndWatch(imdbId) {
    closeSearchTab();
    setTimeout(function() { openWatch(imdbId); }, 200);
  }

  // ----- Bottom Navigation -----
  function bottomNavAction(action) {
    if (action === 'search') {
      if (currentView !== 'home') exitWatchPage();
      setTimeout(function() { openSearchPage(); }, 100);
    } else if (action === 'home') { navigateHome(); } else if (action === 'movies') {
      navigateHome();
      setTimeout(function() { switchTab('movies', document.querySelector('.nav-btn[onclick*="movies"]')); }, 200);
    } else if (action === 'series') {
      navigateHome();
      setTimeout(function() { switchTab('series', document.querySelector('.nav-btn[onclick*="series"]')); }, 200);
    }
  }

  function updateBottomNavActive(tab) {
    document.querySelectorAll('.bn-item').forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-tab') === tab);
    });
  }

  // ----- Watched Episodes & Watchlist -----
  function markEpisodeWatched(imdbId, season, episode) {
    if (!watchedEpisodes[imdbId]) watchedEpisodes[imdbId] = {};
    if (!watchedEpisodes[imdbId][season]) watchedEpisodes[imdbId][season] = [];
    if (watchedEpisodes[imdbId][season].indexOf(episode) === -1) watchedEpisodes[imdbId][season].push(episode);
    localStorage.setItem('paw_watched_eps', JSON.stringify(watchedEpisodes));
  }

  function isEpisodeWatched(imdbId, season, episode) {
    return watchedEpisodes[imdbId]?.[season]?.includes(episode);
  }

  function toggleWatchlist() {
    if (!currentItem) return;
    var imdbId = currentItem.imdb,
      btn = document.getElementById('watchlistBtn');
    if (watchlist.includes(imdbId)) {
      watchlist = watchlist.filter(function(id) { return id !== imdbId; });
      localStorage.setItem('paw_watchlist', JSON.stringify(watchlist));
      btn.textContent = '+ Watchlist';
      btn.classList.remove('saved');
    } else {
      watchlist.push(imdbId);
      localStorage.setItem('paw_watchlist', JSON.stringify(watchlist));
      btn.textContent = '✓ Saved';
      btn.classList.add('saved');
    }
  }

  function checkWatchlistButton() {
    var btn = document.getElementById('watchlistBtn');
    if (!btn || !currentItem) return;
    if (watchlist.includes(currentItem.imdb)) {
      btn.textContent = '✓ Saved';
      btn.classList.add('saved');
    }
  }

  function toggleRemind() {
    if (!currentItem || currentItem.type !== 'series') return;
    var imdbId = currentItem.imdb,
      btn = document.getElementById('remindBtn');
    if (remindedSeries[imdbId]) {
      delete remindedSeries[imdbId];
      localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
      btn.classList.remove('on');
      btn.textContent = '🔔 Remind me';
    } else {
      remindedSeries[imdbId] = {
        title: currentItem.title,
        timestamp: Date.now(),
        lastCheckedEpisodes: document.querySelectorAll('.episode-card').length
      };
      localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
      btn.classList.add('on');
      btn.textContent = '🔔 Reminded';
    }
  }

  function checkRemindButton() {
    var btn = document.getElementById('remindBtn');
    if (!btn || !currentItem) return;
    btn.style.display = 'flex';
    if (remindedSeries[currentItem.imdb]) {
      btn.classList.add('on');
      btn.textContent = '🔔 Reminded';
    } else {
      btn.classList.remove('on');
      btn.textContent = '🔔 Remind me';
    }
  }

  // ----- Episodes -----
  async function loadSeriesEpisodes(imdbId) {
    document.getElementById('episodeSection').style.display = 'none';
    var ts = 1;
    try {
      var r = await fetch(OMDB_API + 'i=' + imdbId + '&plot=short'),
        d = await r.json();
      ts = parseInt(d.totalSeasons) || 1;
    } catch (e) {}
    document.getElementById('watchSeriesMeta').innerHTML = '<span>📺 ' + ts + ' Season' + (ts > 1 ? 's' : '') + '</span><span class="omdb-live">Encrypted Media</span>';
    var st = document.getElementById('seasonTabs');
    st.innerHTML = '';
    for (var i = 1; i <= ts; i++) {
      var btn = document.createElement('button');
      btn.className = 'season-tab' + (i === 1 ? ' active' : '');
      btn.textContent = 'Season ' + i;
      btn.setAttribute('data-season', i);
      btn.onclick = function() { MVC.switchSeason(parseInt(this.getAttribute('data-season')), imdbId); };
      st.appendChild(btn);
    }
    await loadEpisodesForSeason(imdbId, 1);
  }

  async function switchSeason(season, imdbId) {
    document.querySelectorAll('.season-tab').forEach(function(t) {
      t.classList.toggle('active', parseInt(t.getAttribute('data-season')) === season);
    });
    document.querySelectorAll('#episodeGrid .episode-card').forEach(function(c) { c.classList.remove('ep-active'); });
    await loadEpisodesForSeason(imdbId, season);
    if (currentPlayingEpisode.season === season) {
      var card = document.querySelector('#episodeGrid .episode-card[data-ep="' + currentPlayingEpisode.episode + '"][data-season="' + season + '"]');
      if (card) {
        card.classList.add('ep-active');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    updateNextEpisodeBar(imdbId, season, currentPlayingEpisode.episode || 1);
  }

  async function loadEpisodesForSeason(imdbId, season) {
    var grid = document.getElementById('episodeGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="text-align:center;padding:1rem;"><div class="spinner" style="width:24px;height:24px;border:3px solid rgba(255,255,255,0.1);border-top-color:var(--gold);border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto;"></div><p style="color:var(--gray);font-size:0.7rem;">Loading episodes...</p></div>';
    var allEpisodes = [];
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var fetchPromises = [];

    fetchPromises.push(fetch(OMDB_API + 'i=' + imdbId + '&Season=' + season).then(function(res) { return res.json(); }).then(function(data) {
      if (data.Episodes && data.Episodes.length) {
        var omdbEps = data.Episodes.map(function(ep) {
          return { source: 'OMDB', Episode: parseInt(ep.Episode), Title: ep.Title, Released: ep.Released || '', imdbRating: ep.imdbRating || null };
        });
        allEpisodes = allEpisodes.concat(omdbEps);
      }
    }).catch(function() {}));

    fetchPromises.push(fetch('https://api.themoviedb.org/3/find/' + imdbId + '?api_key=4e44d9029b1270a757cddc766a1bcb63&external_source=imdb_id').then(function(res) { return res.json(); }).then(function(tmdbData) {
      var tvResults = tmdbData.tv_results || [];
      if (tvResults.length > 0) {
        var tmdbId = tvResults[0].id;
        return fetch('https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '?api_key=4e44d9029b1270a757cddc766a1bcb63').then(function(res) { return res.json(); }).then(function(seasonData) {
          if (seasonData.episodes && seasonData.episodes.length) {
            var tmdbEps = seasonData.episodes.map(function(ep) {
              return { source: 'TMDB', Episode: ep.episode_number, Title: ep.name, Released: ep.air_date || '', imdbRating: ep.vote_average ? ep.vote_average.toFixed(1) : null };
            });
            allEpisodes = allEpisodes.concat(tmdbEps);
          }
        });
      }
    }).catch(function() {}));

    fetchPromises.push(fetch('https://api.tvmaze.com/lookup/shows?imdb=' + imdbId).then(function(res) { return res.json(); }).then(function(mazeData) {
      if (mazeData && mazeData.id) {
        return fetch('https://api.tvmaze.com/shows/' + mazeData.id + '/episodes?specials=1').then(function(res) { return res.json(); }).then(function(epsData) {
          var seasonEps = epsData.filter(function(ep) { return ep.season === season; });
          if (seasonEps.length) {
            var mazeEps = seasonEps.map(function(ep) {
              return { source: 'TVMaze', Episode: ep.number, Title: ep.name, Released: ep.airdate || '', imdbRating: ep.rating ? ep.rating.average : null };
            });
            allEpisodes = allEpisodes.concat(mazeEps);
          }
        });
      }
    }).catch(function() {}));

    if (currentItem && currentItem.seasons && currentItem.seasons[season - 1]) {
      var seasonData = currentItem.seasons[season - 1];
      if (seasonData.episodes && seasonData.episodes.length) {
        var jsonEps = seasonData.episodes.map(function(ep, i) {
          return { source: 'JSON', Episode: i + 1, Title: ep.title, Released: ep.airDate || '', imdbRating: null };
        });
        allEpisodes = allEpisodes.concat(jsonEps);
      }
    }

    await Promise.allSettled(fetchPromises);

    if (!allEpisodes.length) {
      grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--gray);"><p style="font-size:2rem;margin-bottom:0.5rem;">😕</p><p>No episodes found from any source.</p><p style="font-size:0.7rem;margin-top:0.5rem;">The series might be new or the data is not yet available.</p><button class="request-btn" onclick="MVC.openRequestForm()" style="display:inline-flex;margin-top:0.8rem;">📩 Request Update</button></div>';
      var bar = document.getElementById('nextEpisodeBar');
      if (bar) bar.style.display = 'none';
      return;
    }

    var merged = {};
    allEpisodes.forEach(function(ep) {
      var num = ep.Episode;
      if (!merged[num]) { merged[num] = ep; } else {
        if (!merged[num].Title && ep.Title) merged[num].Title = ep.Title;
        if (!merged[num].Released && ep.Released) merged[num].Released = ep.Released;
        if (!merged[num].imdbRating && ep.imdbRating) merged[num].imdbRating = ep.imdbRating;
        merged[num].source = (merged[num].source || '') + '+' + ep.source;
      }
    });

    var finalEpisodes = Object.values(merged).sort(function(a, b) { return a.Episode - b.Episode; });

    grid.innerHTML = finalEpisodes.map(function(ep) {
      var epNum = ep.Episode;
      var isWatched = isEpisodeWatched(imdbId, season, epNum);
      var isLocked = false;
      var lockReason = '';
      var releaseDate = null;
      var daysUntil = 0;
      var daysSinceRelease = 0;
      if (ep.Released) { releaseDate = new Date(ep.Released + 'T00:00:00Z'); }
      var hasNoRating = !ep.imdbRating || ep.imdbRating === 'N/A';
      if (releaseDate && !isNaN(releaseDate.getTime())) {
        if (releaseDate > today) {
          isLocked = true;
          lockReason = 'future';
          daysUntil = Math.ceil((releaseDate - today) / (1000 * 60 * 60 * 24));
        } else {
          daysSinceRelease = Math.floor((today - releaseDate) / (1000 * 60 * 60 * 24));
          if (hasNoRating && daysSinceRelease < 5) {
            isLocked = true;
            lockReason = 'not_verified_early';
          }
        }
      } else {
        if (!ep.Title || ep.Title === 'N/A') {
          isLocked = true;
          lockReason = 'not_verified_no_data';
        }
      }

      if (isLocked && lockReason === 'future') {
        return '<div class="episode-card" style="opacity:0.5;cursor:not-allowed;border-color:#555;" data-ep="' + epNum + '" data-season="' + season + '"><div class="ep-info"><span class="ep-num" style="color:#888;">🔒 Ep ' + epNum + '</span><span class="ep-title" style="color:#888;">' + escH(ep.Title) + '</span><span class="ep-air" style="color:var(--gold);">📅 ' + ep.Released + ' (in ' + daysUntil + ' day' + (daysUntil > 1 ? 's' : '') + ')</span></div></div>';
      }
      if (isLocked && lockReason === 'not_verified_early') {
        var daysLeft = 5 - daysSinceRelease;
        return '<div class="episode-card" style="opacity:0.5;cursor:not-allowed;border-color:#555;" data-ep="' + epNum + '" data-season="' + season + '"><div class="ep-info"><span class="ep-num" style="color:#888;">🔒 Ep ' + epNum + '</span><span class="ep-title" style="color:#888;">' + escH(ep.Title) + '</span><span class="ep-air" style="color:#ffa502;">⚠️ Not Verified</span><span class="ep-air" style="color:#888;">📅 ' + ep.Released + ' • Verifies in ' + daysLeft + ' day' + (daysLeft > 1 ? 's' : '') + '</span><span class="ep-air" style="font-size:0.5rem;color:#555;">(' + ep.source + ')</span></div></div>';
      }
      if (isLocked && lockReason === 'not_verified_no_data') {
        return '<div class="episode-card" style="opacity:0.5;cursor:not-allowed;border-color:#555;" data-ep="' + epNum + '" data-season="' + season + '"><div class="ep-info"><span class="ep-num" style="color:#888;">🔒 Ep ' + epNum + '</span><span class="ep-title" style="color:#888;">No Data Available</span><span class="ep-air" style="color:var(--red);">⚠️ Broken Entry</span><span class="ep-air" style="font-size:0.5rem;color:#555;">(' + ep.source + ')</span></div></div>';
      }

      var verifiedBadge = '';
      if (!ep.Released) {
        verifiedBadge = '<span class="ep-air" style="color:var(--cyan);">📅 No Date • Verified</span>';
      } else if (daysSinceRelease >= 5 && hasNoRating) {
        verifiedBadge = '<span class="ep-air" style="color:var(--green);">✅ Verified (' + daysSinceRelease + ' days)</span>';
      }

      return '<div class="episode-card' + (isWatched ? ' ep-watched' : '') + '" data-ep="' + epNum + '" data-season="' + season + '" onclick="MVC.playEpisode(\'' + imdbId + '\', ' + season + ', ' + epNum + ')"><div class="ep-info"><span class="ep-num">Ep ' + epNum + '</span><span class="ep-title">' + escH(ep.Title) + '</span>' + (ep.Released ? '<span class="ep-air">📅 ' + ep.Released + '</span>' : '') + (ep.imdbRating ? '<span class="ep-air">⭐' + ep.imdbRating + '</span>' : verifiedBadge) + '<span class="ep-air" style="font-size:0.5rem;color:#555;">(' + ep.source + ')</span></div></div>';
    }).join('');

    setTimeout(function() {
      grid.querySelectorAll('.episode-card.ep-active').forEach(function(card) { card.classList.remove('ep-active'); });
      if (currentPlayingEpisode.season === season && currentPlayingEpisode.episode) {
        var activeCard = grid.querySelector('.episode-card[data-ep="' + currentPlayingEpisode.episode + '"][data-season="' + season + '"]');
        if (activeCard) {
          activeCard.classList.add('ep-active');
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else if (season === 1 && !currentPlayingEpisode.episode) {
        var firstUnlocked = grid.querySelector('.episode-card:not([style*="cursor:not-allowed"])');
        if (firstUnlocked) {
          var firstEp = parseInt(firstUnlocked.getAttribute('data-ep'));
          firstUnlocked.classList.add('ep-active');
          currentPlayingEpisode = { season: 1, episode: firstEp };
        }
      }
    }, 100);
    setTimeout(function() {
      updateNextEpisodeBar(imdbId, season, currentPlayingEpisode.episode || 1);
    }, 200);
  }

  function playEpisode(imdbId, season, episode) {
    document.querySelectorAll('#episodeGrid .episode-card').forEach(function(card) { card.classList.remove('ep-active'); });
    var activeCard = document.querySelector('#episodeGrid .episode-card[data-ep="' + episode + '"][data-season="' + season + '"]');
    if (activeCard) { activeCard.classList.add('ep-active'); }
    markEpisodeWatched(imdbId, season, episode);
    saveWatchProgress(imdbId, 100, season, episode);
    saveLastWatchedEpisode(imdbId, season, episode);
    currentPlayingEpisode = { season: season, episode: episode };
    buildContinueWatching();
    if (!unlocked) {
      unlockPlayer();
      setTimeout(function() { updateNextEpisodeBar(imdbId, season, episode); }, 500);
      return;
    }
    createPlayerWithSource();
    updateNextEpisodeBar(imdbId, season, episode);
    startWatchTimer(imdbId, season, episode);
  }

  // ----- Related & Sidebar -----
  function loadRelated() {
    if (!currentItem) return;
    var o = allContent.filter(function(m) { return m.imdb !== currentItem.imdb; });
    var sg = o.filter(function(m) { return m.genre?.some(function(g) { return currentItem.genre?.includes(g); }); });
    renderSidebar('sameGenreList', (sg.length ? sg : o).slice(0, 5));
    renderSidebar('similarList', o.sort(function() { return 0.5 - Math.random(); }).slice(0, 5));
  }

  function renderSidebar(id, items) {
    var c = document.getElementById(id);
    if (!c) return;
    c.innerHTML = items.map(function(m) {
      return '<div class="side-item" onclick="MVC.openWatch(\'' + m.imdb + '\')"><div class="side-thumb"><img src="' + (m.poster || '') + '" onerror="this.src=\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 75%22><rect fill=%22%23111%22 width=%2250%22 height=%2275%22/><text fill=%22%23ff6b00%22 x=%2225%22 y=%2238%22 text-anchor=%22middle%22>🎬</text></svg>\'"></div><div class="side-info"><div class="side-title">' + escH(m.title) + '</div><div class="side-meta">' + (m.release || '') + ' ' + (m.rating ? '<span class="side-rating">⭐' + m.rating + '</span>' : '') + '</div></div></div>';
    }).join('');
  }

  // ----- Actors -----
  function goActors() {
    currentView = 'actors';
    homePageVisible = false;
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.add('active');
    document.getElementById('inboxPage').classList.remove('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.add('hidden');
    buildActorsPage();
    if (window.history && window.history.pushState) window.history.pushState({}, '', '?page=actors');
  }

  function buildActorCache() {
    allContent.forEach(function(m) {
      if (m.actors) m.actors.forEach(function(a) {
        if (!actorCache[a]) actorCache[a] = { name: a, movies: [] };
        if (!actorCache[a].movies.includes(m.imdb)) actorCache[a].movies.push(m.imdb);
      });
    });
    localStorage.setItem('paw_actors', JSON.stringify(actorCache));
  }

  function buildActorsPage() {
    if (!Object.keys(actorCache).length) buildActorCache();
    var g = document.getElementById('actorsGrid');
    var actors = Object.values(actorCache).sort(function(a, b) { return a.name.localeCompare(b.name); });
    g.innerHTML = actors.map(function(a) {
      return '<div class="actor-card" onclick="MVC.showActorMovies(\'' + escH(a.name) + '\')"><div class="actor-avatar">🎭</div><div class="actor-name">' + escH(a.name) + '</div><div style="font-size:0.6rem;color:var(--gray);">' + a.movies.length + ' titles</div></div>';
    }).join('');
    document.getElementById('actorSearchInput').addEventListener('input', function() {
      var q = this.value.trim().toLowerCase();
      var f = actors.filter(function(a) { return a.name.toLowerCase().includes(q); });
      g.innerHTML = f.map(function(a) {
        return '<div class="actor-card" onclick="MVC.showActorMovies(\'' + escH(a.name) + '\')"><div class="actor-avatar">🎭</div><div class="actor-name">' + escH(a.name) + '</div><div style="font-size:0.6rem;color:var(--gray);">' + a.movies.length + ' titles</div></div>';
      }).join('');
    });
  }

  function searchActor(name) {
    goActors();
    setTimeout(function() {
      var si = document.getElementById('actorSearchInput');
      if (si) { si.value = name;
        si.dispatchEvent(new Event('input')); }
      showActorMovies(name);
    }, 300);
  }

  function showActorMovies(name) {
    if (!Object.keys(actorCache).length) buildActorCache();
    var a = actorCache[name];
    if (!a) return;
    var dp = document.getElementById('actorDetailPanel');
    dp.style.display = 'block';
    dp.innerHTML = '<div class="actor-detail-head"><div class="actor-avatar-lg">🎭</div><div><h2>' + escH(a.name) + '</h2><p class="actor-sub">' + a.movies.length + ' titles on PawNets</p></div></div><div class="movies-grid" style="margin-top:1rem;">' + a.movies.map(function(imdb) {
      var mv = allContent.find(function(m) { return m.imdb === imdb; });
      if (!mv) return '';
      return '<div class="movie-card" onclick="MVC.openWatch(\'' + imdb + '\')"><div class="poster-wrap"><img src="' + (mv.poster || '') + '" onerror="this.parentElement.innerHTML=\'<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--orange);font-size:2rem;>🎬</div>\'"><span class="quality-badge">' + (mv.quality || 'HD') + '</span>' + (mv.type === 'series' ? '<span class="type-badge">📺</span>' : '') + '<div class="poster-overlay"><div class="play-circle">▶</div></div></div><div class="card-info"><div class="card-title">' + escH(mv.title) + '</div><div class="card-meta"><span class="card-rating">⭐ ' + (mv.rating || '?') + '</span><span>' + (mv.release || '') + '</span></div></div></div>';
    }).join('') + '</div>';
  }

  // ----- Inbox -----
  function goInbox() {
    currentView = 'inbox';
    homePageVisible = false;
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.add('active');
    document.getElementById('settingsPage').classList.remove('active');
    document.getElementById('bottomNav').classList.add('hidden');
    renderInbox();
    if (window.history && window.history.pushState) window.history.pushState({}, '', '?page=inbox');
  }

  function renderInbox() {
    var l = document.getElementById('inboxList');
    l.innerHTML = inboxMessages.length ? inboxMessages.map(function(msg) {
      return '<div class="inbox-item' + (msg.read ? '' : ' unread') + '"><div class="inbox-icon">' + (msg.type === 'new_episodes' ? '📺' : '📢') + '</div><div class="inbox-body"><div class="inbox-title">' + escH(msg.title) + '</div><div style="font-size:0.7rem;color:var(--gray);">' + escH(msg.body) + '</div>' + (msg.imdbId ? '<button class="inbox-watch-btn" onclick="MVC.openWatch(\'' + msg.imdbId + '\')">▶ Watch Now</button>' : '') + '</div></div>';
    }).join('') : '<p style="color:var(--gray);text-align:center;padding:2rem;">No messages yet</p>';
    inboxMessages.forEach(function(m) { m.read = true; });
    localStorage.setItem('paw_inbox', JSON.stringify(inboxMessages));
    updateInboxBadge();
  }

  function updateInboxBadge() {
    var b = document.getElementById('inboxBadge');
    if (!b) return;
    var u = inboxMessages.filter(function(m) { return !m.read; }).length;
    b.textContent = u > 99 ? '99+' : u;
    b.style.display = u > 0 ? 'flex' : 'none';
  }

  function addInboxMessage(msg) {
    inboxMessages.unshift(msg);
    if (inboxMessages.length > 20) inboxMessages = inboxMessages.slice(0, 20);
    localStorage.setItem('paw_inbox', JSON.stringify(inboxMessages));
  }

  async function checkRemindedSeries() {
    for (var imdbId in remindedSeries) {
      if (!remindedSeries.hasOwnProperty(imdbId)) continue;
      var data = remindedSeries[imdbId];
      try {
        var res = await fetch(OMDB_API + 'i=' + imdbId + '&plot=short'),
          sd = await res.json(),
          ts = parseInt(sd.totalSeasons) || 1,
          sr = await fetch(OMDB_API + 'i=' + imdbId + '&Season=' + ts),
          sed = await sr.json(),
          cec = (sed.Episodes || []).length;
        if (cec > (data.lastCheckedEpisodes || 0)) {
          addInboxMessage({
            type: 'new_episodes',
            title: 'New Episodes Added!',
            body: data.title + ' has new episodes available.',
            imdbId: imdbId,
            timestamp: Date.now(),
            read: false
          });
          remindedSeries[imdbId].lastCheckedEpisodes = cec;
          localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
        }
      } catch (e) {}
    }
    updateInboxBadge();
  }

  // ----- Request Form -----
  function openRequestForm() {
    document.getElementById('requestFormModal').classList.add('active');
  }

  function closeRequestForm() {
    document.getElementById('requestFormModal').classList.remove('active');
  }

  function checkAndShowResult(title) {
    var fr = document.getElementById('formResult');
    if (!fr) return;
    if (!title || title.length < 2) { fr.innerHTML = ''; return; }
    var q = title.toLowerCase().trim();
    var matches = allContent.filter(function(m) { return (m.title || '').toLowerCase().includes(q); }).slice(0, 4);
    if (matches.length) {
      fr.innerHTML = '<div style="background:rgba(46,213,115,0.08);border:1px solid var(--green);border-radius:8px;padding:0.7rem;margin-bottom:0.6rem;"><p style="color:var(--green);font-weight:700;font-size:0.75rem;">✅ Already on PawNets!</p>' + matches.map(function(m) {
        return '<a onclick="MVC.closeRequestForm();MVC.openWatch(\'' + m.imdb + '\')" style="display:block;color:var(--orange);cursor:pointer;font-size:0.7rem;padding:0.15rem 0;">🎬 ' + escH(m.title) + ' (' + (m.release || '?') + ') ⭐' + (m.rating || '?') + '</a>';
      }).join('') + '</div><button type="submit" class="unlock-btn" style="width:100%;">📩 Send Anyway</button>';
    } else {
      fr.innerHTML = '<div style="background:rgba(255,107,0,0.07);border:1px solid rgba(255,107,0,0.25);border-radius:8px;padding:0.7rem;margin-bottom:0.6rem;"><p style="color:var(--orange);font-weight:700;font-size:0.75rem;">🆕 Not on PawNets yet!</p><p style="color:var(--gray);font-size:0.7rem;">"' + escH(title) + '" will be added soon.</p></div><button type="submit" class="unlock-btn" style="width:100%;">📩 Send Request</button>';
    }
  }

  // ----- Routing & Storage -----
  function handlePageRouting() {
    var p = new URLSearchParams(window.location.search),
      w = p.get('watch'),
      pg = p.get('page');
    if (w) openWatch(w);
    else if (pg === 'actors') goActors();
    else if (pg === 'inbox') goInbox();
  }

  function saveLastWatchedEpisode(imdbId, season, episode) {
    lastWatchedEpisode[imdbId] = { season: season, episode: episode, timestamp: Date.now() };
    localStorage.setItem('paw_last_episode', JSON.stringify(lastWatchedEpisode));
  }

  function getLastWatchedEpisode(imdbId) {
    var saved = lastWatchedEpisode[imdbId];
    if (saved && saved.season && saved.episode) {
      return { season: saved.season, episode: saved.episode };
    }
    return { season: 1, episode: 1 };
  }

  async function loadSeriesEpisodesWithResume(imdbId, targetSeason, targetEpisode) {
    document.getElementById('episodeSection').style.display = 'none';
    document.getElementById('episodeSection').classList.remove('collapsed');
    document.getElementById('epCollapseBtn').textContent = '▲ Hide';
    var ts = 1;
    try {
      var r = await fetch(OMDB_API + 'i=' + imdbId + '&plot=short');
      var d = await r.json();
      ts = parseInt(d.totalSeasons) || 1;
    } catch (e) {}
    document.getElementById('watchSeriesMeta').innerHTML = '<span>📺 ' + ts + ' Season' + (ts > 1 ? 's' : '') + '</span><span class="omdb-live">Encrypted Media</span>';
    var st = document.getElementById('seasonTabs');
    st.innerHTML = '';
    for (var i = 1; i <= ts; i++) {
      var btn = document.createElement('button');
      btn.className = 'season-tab' + (i === targetSeason ? ' active' : '');
      btn.textContent = 'Season ' + i;
      btn.setAttribute('data-season', i);
      btn.onclick = function() { MVC.switchSeason(parseInt(this.getAttribute('data-season')), imdbId); };
      st.appendChild(btn);
    }
    await loadEpisodesForSeason(imdbId, targetSeason);
    setTimeout(function() {
      var targetCard = document.querySelector('#episodeGrid .episode-card[data-ep="' + targetEpisode + '"][data-season="' + targetSeason + '"]');
      if (targetCard) {
        targetCard.classList.add('ep-active');
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      updateNextEpisodeBar(imdbId, targetSeason, targetEpisode);
    }, 500);
  }

  // ----- Expose public API via MVC -----
  window.MVC = {
    navigateHome: navigateHome,
    openWatch: openWatch,
    exitWatchPage: exitWatchPage,
    goActors: goActors,
    goInbox: goInbox,
    searchAndWatch: searchAndWatch,
    heroSlide: heroSlide,
    heroGoTo: heroGoTo,
    switchSeason: switchSeason,
    playEpisode: playEpisode,
    unlockPlayer: unlockPlayer,
    goToPage: goToPage,
    switchTab: switchTab,
    filterGenre: filterGenre,
    openRequestForm: openRequestForm,
    closeRequestForm: closeRequestForm,
    checkAndShowResult: checkAndShowResult,
    removeContinue: removeContinue,
    buildContinueWatching: buildContinueWatching,
    toggleWatchlist: toggleWatchlist,
    toggleRemind: toggleRemind,
    searchActor: searchActor,
    showActorMovies: showActorMovies,
    bottomNavAction: bottomNavAction,
    closeSearchTab: closeSearchTab,
    openSearchPage: openSearchPage,
    changeFontSize: window.changeFontSize,
    changeBgColor: window.changeBgColor,
    switchSource: switchSource
  };

  // Make all MVC functions globally accessible (for inline onclick)
  Object.keys(window.MVC).forEach(function(k) {
    if (typeof window.MVC[k] === 'function' && !window[k]) {
      window[k] = function() { return window.MVC[k].apply(window.MVC, arguments); };
    }
  });

  // Start the app
  loadData();
})();
