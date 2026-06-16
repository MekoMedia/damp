(function() {
  'use strict';
  
  var JSON_URL = 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/data.json';
  var OMDB_API = 'https://www.omdbapi.com/?apikey=thewdb&';
  var EMBOS_BASE = 'https://nextgencloudfabric.com';
  var SMARTLINK = 'https://omg10.com/4/11143489';
  
  var allContent = [];
  var filteredContent = [];
  var currentTab = 'all';
  var currentGenre = 'all';
  var currentPage = 1;
  var heroIndex = 0;
  var heroTotal = 0;
  var heroTimer = null;
  var currentView = 'home';
  var currentItem = null;
  var unlocked = false;
  var homePageVisible = true;
  var heroVideos = [];
  var visibilityObserver = null;
  var heroInitialized = false;
  var userHasInteracted = false;
  
  var watchedEpisodes = JSON.parse(localStorage.getItem('paw_watched_eps') || '{}');
  var remindedSeries = JSON.parse(localStorage.getItem('paw_reminded') || '{}');
  var inboxMessages = JSON.parse(localStorage.getItem('paw_inbox') || '[]');
  var watchProgress = JSON.parse(localStorage.getItem('paw_progress') || '{}');
  var watchlist = JSON.parse(localStorage.getItem('paw_watchlist') || '[]');
  var actorCache = JSON.parse(localStorage.getItem('paw_actors') || '{}');
  
  var watchStartTime = null;
  var watchTimerInterval = null;
  
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
    var match = durStr.match(/(\d+)\s*min/);
    if (match) return parseInt(match[1]) * 60;
    var hMatch = durStr.match(/(\d+)h\s*(\d+)?/);
    if (hMatch) return parseInt(hMatch[1]) * 3600 + (parseInt(hMatch[2] || 0) * 60);
    return 3600;
  }
  
  setTimeout(function() {
    var splash = document.getElementById('introSplash');
    if (splash) splash.classList.add('hide');
    homePageVisible = true;
  }, 2000);
  
  window.toggleSettings = function() {
    var panel = document.getElementById('settingsPanel');
    if (panel) panel.classList.toggle('active');
  };
  
  window.changeFontSize = function(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    var fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeValue) fontSizeValue.textContent = size + 'px';
  };
  
  window.changeBgColor = function(color) {
    document.documentElement.style.setProperty('--bg', color);
  };
  
  function deduplicateContent() {
    var seen = new Set();
    allContent = allContent.filter(function(m) {
      if (seen.has(m.imdb)) return false;
      seen.add(m.imdb);
      return true;
    });
  }
  
  function showStatusModal(title, body, extra) {
    var modal = document.getElementById('statusModal');
    if (!modal) return;
    modal.classList.add('open');
    var titleEl = modal.querySelector('.status-title');
    var bodyEl = modal.querySelector('.status-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.textContent = body + (extra ? '\n' + extra : '');
    
    if (!navigator.onLine) {
      if (titleEl) titleEl.textContent = 'Connection Lost';
      if (bodyEl) bodyEl.textContent = 'Your Having Connection Difficulties, check your wifi/data. Some Cache will Save some of the episodes or movie';
    }
  }
  
  window.closeStatusModal = function() {
    var modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('open');
  };
  
  window.addEventListener('online', function() {
    var modal = document.getElementById('statusModal');
    if (modal && modal.querySelector('.status-title').textContent === 'Connection Lost') {
      modal.classList.remove('open');
    }
  });
  
  window.addEventListener('offline', function() {
    showStatusModal('Connection Lost', 'Your Having Connection Difficulties, check your wifi/data. Some Cache will Save some of the episodes or movie');
  });
  
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
      
      deduplicateContent();
      buildGenreSelect();
      buildHero();
      buildTop9();
      buildContinueWatching();
      applyFilters();
      checkRemindedSeries();
      updateInboxBadge();
      handlePageRouting();
    } catch (e) {
      showStatusModal('Server Outage Connection', 'Error: 0', 'The data source could not be reached. Please try again later.');
    }
  }
  
  function buildGenreSelect() {
    var genres = new Set();
    allContent.forEach(function(m) { (m.genre || []).forEach(function(g) { genres.add(g); }); });
    var select = document.getElementById('genreSelect');
    if (!select) return;
    Array.from(genres).sort().forEach(function(g) {
      var opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      select.appendChild(opt);
    });
  }
  
  function buildTop9() {
    var row = document.getElementById('top10Row');
    if (!row) return;
    
    var top9 = allContent
      .sort(function(a, b) { return (b.popularity || 0) - (a.popularity || 0); })
      .slice(0, 9);
    
    row.innerHTML = top9.map(function(m, i) {
      return '<div class="top10-card" onclick="MVC.openWatch(\'' + m.imdb + '\')">' +
        '<div class="top10-num">' + (i + 1) + '</div>' +
        '<div class="top10-poster"><img src="' + (m.poster || '') + '" loading="lazy" onerror="this.style.display=\'none\'" alt=""></div>' +
      '</div>';
    }).join('');
  }
  
  function buildHero() {
    var heroCarousel = document.getElementById('heroCarousel');
    var heroTrack = document.getElementById('heroTrack');
    var heroDots = document.getElementById('heroDots');
    
    if (!heroCarousel || !heroTrack || !heroDots) return;
    
    var heroData = [
      { movie: 'tt37287335', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Obsession%20Movie%20Clip%20-%20Nice%20Date%20(2026)(720P_HD).mp4' },
      { movie: 'tt26657236', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Backrooms%20_%20Official%20Clip%20_%20A24(720P_HD).mp4' },
      { movie: 'tt0427340', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Masters%20of%20the%20Universe%20Movie%20Clip%20-%20The%20Crescendo%20(2026)(720P_HD).mp4' },
      { movie: 'tt5622316', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/The%20Chosen%20_%20Official%20Trailer%20HD(720P_HD).mp4' },
      { movie: 'tt0816692', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Interstellar%20-%20Trailer%20-%20Official%20Warner%20Bros.%20UK(720P_HD).mp4' }
    ];
    
    var items = heroData.map(function(data) {
      var movie = allContent.find(function(m) { return m.imdb === data.movie; });
      return movie ? Object.assign({}, movie, { videoUrl: data.video }) : null;
    }).filter(function(item) { return item && item.poster; });
    
    if (!items.length) {
      heroCarousel.style.display = 'none';
      return;
    }
    
    heroTotal = items.length;
    heroVideos = [];
    heroInitialized = false;
    heroIndex = 0;
    
    heroTrack.innerHTML = items.map(function(m, i) {
      return '<div class="hero-slide" onclick="MVC.openWatch(\'' + m.imdb + '\')">' +
        '<video class="hero-video" src="' + m.videoUrl + '" muted playsinline preload="auto" data-index="' + i + '"' +
        ' onerror="this.style.display=\'none\';"' +
        ' onloadeddata="MVC.handleVideoLoad(' + i + ')"' +
        ' ontimeupdate="MVC.checkVideoProgress(' + i + ')"' +
        ' onplaying="MVC.handleVideoPlaying(' + i + ')"' +
        ' onwaiting="MVC.handleVideoWaiting(' + i + ')"></video>' +
        '<div class="hero-gradient"></div>' +
        '<div class="hero-info-bar">' +
          '<div><h3>' + escH(m.title) + '</h3><p class="hero-meta">⭐ ' + (m.rating || '?') + ' • ' + (m.release || '') + ' • ' + (m.quality || 'HD') + '</p></div>' +
          '<button class="hero-btn" onclick="event.stopPropagation();MVC.openWatch(\'' + m.imdb + '\')">▶ Watch</button>' +
        '</div>' +
      '</div>';
    }).join('');
    
    heroDots.innerHTML = items.map(function(_, i) {
      return '<button class="hero-dot' + (i === 0 ? ' active' : '') + '" onclick="MVC.heroGoTo(' + i + ')"></button>';
    }).join('');
    
    setTimeout(function() {
      heroVideos = Array.from(document.querySelectorAll('.hero-video'));
      if (heroVideos[0] && !userHasInteracted) {
        heroVideos[0].muted = true;
        heroVideos[0].currentTime = 0;
        heroVideos[0].play().then(function() {}).catch(function() {
          showPlayIndicator();
        });
      }
    }, 2500);
    
    var enableAutoplay = function() {
      if (!userHasInteracted) {
        userHasInteracted = true;
        startHeroVideos();
        ['click', 'touchstart', 'keydown', 'scroll'].forEach(function(event) {
          document.removeEventListener(event, enableAutoplay);
        });
      }
    };
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(function(event) {
      document.addEventListener(event, enableAutoplay, { once: false });
    });
    
    setupVisibilityObserver();
  }
  
  function showPlayIndicator() {
    var heroSection = document.getElementById('heroCarousel');
    if (!heroSection || heroSection.querySelector('.hero-play-indicator')) return;
    
    var indicator = document.createElement('div');
    indicator.className = 'hero-play-indicator';
    indicator.innerHTML = '▶';
    indicator.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10;background:rgba(245,176,66,0.9);color:#000;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;cursor:pointer;pointer-events:auto;';
    indicator.onclick = function(e) {
      e.stopPropagation();
      e.preventDefault();
      userHasInteracted = true;
      startHeroVideos();
      indicator.remove();
    };
    
    var heroSlide = heroSection.querySelector('.hero-slide');
    if (heroSlide) heroSlide.appendChild(indicator);
  }
  
  function startHeroVideos() {
    if (heroInitialized || !homePageVisible) return;
    heroInitialized = true;
    
    var indicator = document.querySelector('.hero-play-indicator');
    if (indicator) indicator.remove();
    
    heroVideos = Array.from(document.querySelectorAll('.hero-video'));
    
    if (heroVideos[0]) {
      heroVideos[0].muted = false;
      heroVideos[0].volume = 1.0;
      heroVideos[0].currentTime = 0;
      heroVideos[0].play().catch(function() {
        heroVideos[0].muted = true;
        heroVideos[0].volume = 0;
        heroVideos[0].play().catch(function() {});
      });
    }
    
    heroVideos.forEach(function(video, i) {
      if (i !== heroIndex && video) video.load();
    });
  }
  
  function handleVideoLoad(index) {
    var videos = heroVideos.length ? heroVideos : document.querySelectorAll('.hero-video');
    var video = videos[index];
    if (!video) return;
    
    if (index === heroIndex && userHasInteracted && homePageVisible) {
      video.muted = false;
      video.volume = 1.0;
      video.currentTime = 0;
      video.play().catch(function() {
        video.muted = true;
        video.play().catch(function() {});
      });
    }
  }
  
  function handleVideoPlaying(index) {
    if (index === heroIndex) {
      var indicator = document.querySelector('.hero-play-indicator');
      if (indicator) indicator.remove();
      heroInitialized = true;
    }
  }
  
  function handleVideoWaiting(index) {
    if (index === heroIndex && !heroInitialized && homePageVisible) {
      setTimeout(function() {
        var video = heroVideos[index];
        if (video && video.paused && userHasInteracted) {
          video.play().catch(function() {});
        }
      }, 1000);
    }
  }
  
  function checkVideoProgress(index) {
    var video = heroVideos[index] || document.querySelectorAll('.hero-video')[index];
    if (!video || index !== heroIndex) return;
    
    if (video.duration && video.currentTime >= video.duration - 0.3) {
      if (heroTimer) clearInterval(heroTimer);
      heroSlide(1);
    }
  }
  
  function setupVisibilityObserver() {
    if (visibilityObserver) visibilityObserver.disconnect();
    
    var heroSection = document.getElementById('heroCarousel');
    if (!heroSection) return;
    
    visibilityObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var currentVideo = heroVideos[heroIndex];
        if (!currentVideo || !homePageVisible) return;
        
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          if (currentVideo.paused && userHasInteracted) {
            currentVideo.play().catch(function() {});
          }
        } else if (entry.intersectionRatio < 0.1) {
          if (!currentVideo.paused) currentVideo.pause();
        }
      });
    }, { threshold: [0, 0.1, 0.3, 0.5] });
    
    visibilityObserver.observe(heroSection);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  function handleVisibilityChange() {
    var currentVideo = heroVideos[heroIndex];
    if (!currentVideo) return;
    
    if (document.hidden || !homePageVisible) {
      currentVideo.pause();
    } else if (homePageVisible && userHasInteracted) {
      currentVideo.play().catch(function() {});
    }
  }
  
  function heroSlide(d) {
    var currentVideo = heroVideos[heroIndex];
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    heroIndex = (heroIndex + d + heroTotal) % heroTotal;
    updateHero();
  }
  
  function heroGoTo(i) {
    var currentVideo = heroVideos[heroIndex];
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    heroIndex = i;
    updateHero();
  }
  
  function updateHero() {
    var heroTrack = document.getElementById('heroTrack');
    if (heroTrack) heroTrack.style.transform = 'translateX(-' + (heroIndex * 100) + '%)';
    
    document.querySelectorAll('.hero-dot').forEach(function(d, i) {
      d.classList.toggle('active', i === heroIndex);
    });
    
    if (!homePageVisible) return;
    
    var nextVideo = heroVideos[heroIndex];
    if (nextVideo && userHasInteracted) {
      nextVideo.currentTime = 0;
      nextVideo.muted = false;
      nextVideo.volume = 1.0;
      nextVideo.play().catch(function() {
        nextVideo.muted = true;
        nextVideo.play().catch(function() {});
      });
    }
    
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }
  
  function saveWatchProgress(imdbId, percent, season, episode) {
    watchProgress[imdbId] = {
      percent: percent,
      season: season || null,
      episode: episode || null,
      timestamp: Date.now()
    };
    localStorage.setItem('paw_progress', JSON.stringify(watchProgress));
  }
  
  function removeWatchProgress(imdbId) {
    delete watchProgress[imdbId];
    localStorage.setItem('paw_progress', JSON.stringify(watchProgress));
  }
  
  function buildContinueWatching() {
    var section = document.getElementById('continueSection');
    var scroll = document.getElementById('continueScroll');
    if (!section || !scroll) return;
    
    var entries = Object.entries(watchProgress)
      .filter(function(entry) { return allContent.find(function(m) { return m.imdb === entry[0]; }); })
      .sort(function(a, b) { return b[1].timestamp - a[1].timestamp; })
      .slice(0, 10);
    
    if (!entries.length) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    scroll.innerHTML = entries.map(function(entry) {
      var imdb = entry[0];
      var data = entry[1];
      var item = allContent.find(function(m) { return m.imdb === imdb; });
      if (!item) return '';
      var percent = data.percent || 0;
      var sub = item.type === 'series' 
        ? 'S' + (data.season || 1) + 'E' + (data.episode || 1) + ' • ' + Math.round(percent) + '%'
        : Math.round(percent) + '% watched';
      
      return '<div class="c-card" onclick="MVC.openWatch(\'' + imdb + '\')">' +
        '<div class="c-thumb">' +
          '<img src="' + (item.poster || '') + '" loading="lazy" onerror="this.style.display=\'none\'">' +
          '<div class="c-prog"><div class="c-prog-bar" style="width:' + percent + '%"></div></div>' +
          '<button class="c-rm" onclick="event.stopPropagation();MVC.removeContinue(\'' + imdb + '\')">✕</button>' +
        '</div>' +
        '<div class="c-info">' +
          '<div class="c-title">' + escH(item.title) + '</div>' +
          '<div class="c-sub">' + sub + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  function removeContinue(imdbId) {
    removeWatchProgress(imdbId);
    buildContinueWatching();
  }
  
  function startWatchTimer(imdbId, season, episode) {
    watchStartTime = Date.now();
    
    if (watchTimerInterval) clearInterval(watchTimerInterval);
    
    watchTimerInterval = setInterval(function() {
      var elapsed = (Date.now() - watchStartTime) / 1000;
      var item = allContent.find(function(m) { return m.imdb === imdbId; });
      var totalDuration = parseDuration(item ? item.duration : null) || 3600;
      
      var percent = Math.min(100, (elapsed / totalDuration) * 100);
      saveWatchProgress(imdbId, percent, season, episode);
      buildContinueWatching();
    }, 5000);
  }
  
  function stopWatchTimer() {
    if (watchTimerInterval) {
      clearInterval(watchTimerInterval);
      watchTimerInterval = null;
    }
  }
  
  function markEpisodeWatched(imdbId, season, episode) {
    if (!watchedEpisodes[imdbId]) watchedEpisodes[imdbId] = {};
    if (!watchedEpisodes[imdbId][season]) watchedEpisodes[imdbId][season] = [];
    if (watchedEpisodes[imdbId][season].indexOf(episode) === -1) {
      watchedEpisodes[imdbId][season].push(episode);
    }
    localStorage.setItem('paw_watched_eps', JSON.stringify(watchedEpisodes));
  }
  
  function isEpisodeWatched(imdbId, season, episode) {
    return watchedEpisodes[imdbId] && watchedEpisodes[imdbId][season] && watchedEpisodes[imdbId][season].indexOf(episode) !== -1;
  }
  
  function toggleWatchlist() {
    if (!currentItem) return;
    var imdbId = currentItem.imdb;
    var btn = document.getElementById('watchlistBtn');
    
    var idx = watchlist.indexOf(imdbId);
    if (idx !== -1) {
      watchlist.splice(idx, 1);
      localStorage.setItem('paw_watchlist', JSON.stringify(watchlist));
      if (btn) { btn.textContent = '+ Watchlist'; btn.classList.remove('saved'); }
    } else {
      watchlist.push(imdbId);
      localStorage.setItem('paw_watchlist', JSON.stringify(watchlist));
      if (btn) { btn.textContent = '✓ Saved'; btn.classList.add('saved'); }
    }
  }
  
  function checkWatchlistButton() {
    if (!currentItem) return;
    var btn = document.getElementById('watchlistBtn');
    if (!btn) return;
    if (watchlist.indexOf(currentItem.imdb) !== -1) {
      btn.textContent = '✓ Saved';
      btn.classList.add('saved');
    }
  }
  
  function toggleRemind() {
    if (!currentItem || currentItem.type !== 'series') return;
    
    var imdbId = currentItem.imdb;
    var remindBtn = document.getElementById('remindBtn');
    
    if (remindedSeries[imdbId]) {
      delete remindedSeries[imdbId];
      localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
      if (remindBtn) { 
        remindBtn.classList.remove('on'); 
        remindBtn.textContent = '🔔 Remind me'; 
      }
    } else {
      remindedSeries[imdbId] = {
        title: currentItem.title,
        timestamp: Date.now(),
        lastCheckedEpisodes: document.querySelectorAll('.episode-card').length
      };
      localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
      if (remindBtn) { 
        remindBtn.classList.add('on'); 
        remindBtn.textContent = '🔔 Reminded'; 
      }
    }
  }
  
  function checkRemindButton() {
    if (!currentItem || currentItem.type !== 'series') return;
    var remindBtn = document.getElementById('remindBtn');
    if (!remindBtn) return;
    remindBtn.style.display = 'flex';
    if (remindedSeries[currentItem.imdb]) {
      remindBtn.classList.add('on');
      remindBtn.textContent = '🔔 Reminded';
    } else {
      remindBtn.classList.remove('on');
      remindBtn.textContent = '🔔 Remind me';
    }
  }
  
  async function checkRemindedSeries() {
    for (var imdbId in remindedSeries) {
      if (!remindedSeries.hasOwnProperty(imdbId)) continue;
      var data = remindedSeries[imdbId];
      
      try {
        var res = await fetch(OMDB_API + 'i=' + imdbId + '&plot=short');
        var seriesData = await res.json();
        var totalSeasons = parseInt(seriesData.totalSeasons) || 1;
        
        var seasonRes = await fetch(OMDB_API + 'i=' + imdbId + '&Season=' + totalSeasons);
        var seasonData = await seasonRes.json();
        var currentEpCount = (seasonData.Episodes || []).length;
        
        if (currentEpCount > (data.lastCheckedEpisodes || 0)) {
          addInboxMessage({
            type: 'new_episodes',
            title: 'New Episodes Added!',
            body: data.title + ' has new episodes available.',
            imdbId: imdbId,
            timestamp: Date.now(),
            read: false
          });
          
          remindedSeries[imdbId].lastCheckedEpisodes = currentEpCount;
          localStorage.setItem('paw_reminded', JSON.stringify(remindedSeries));
        }
      } catch (e) {}
    }
    
    updateInboxBadge();
  }
  
  function addInboxMessage(msg) {
    inboxMessages.unshift(msg);
    if (inboxMessages.length > 20) inboxMessages = inboxMessages.slice(0, 20);
    localStorage.setItem('paw_inbox', JSON.stringify(inboxMessages));
  }
  
  function updateInboxBadge() {
    var badge = document.getElementById('inboxBadge');
    if (!badge) return;
    var unread = inboxMessages.filter(function(m) { return !m.read; }).length;
    badge.textContent = unread > 99 ? '99+' : unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  
  function renderInbox() {
    var list = document.getElementById('inboxList');
    if (!list) return;
    
    list.innerHTML = inboxMessages.length ? inboxMessages.map(function(msg, i) {
      return '<div class="inbox-item' + (msg.read ? '' : ' unread') + '">' +
        '<div class="inbox-icon">' + (msg.type === 'new_episodes' ? '📺' : '📢') + '</div>' +
        '<div class="inbox-body">' +
          '<div class="inbox-title">' + escH(msg.title) + '</div>' +
          '<div style="font-size:0.75rem;color:var(--gray);">' + escH(msg.body) + '</div>' +
          (msg.imdbId ? '<button class="inbox-watch-btn" onclick="MVC.openWatch(\'' + msg.imdbId + '\')">▶ Watch Now</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') : '<p style="color:var(--gray);text-align:center;padding:2rem;">No messages yet</p>';
    
    inboxMessages.forEach(function(m) { m.read = true; });
    localStorage.setItem('paw_inbox', JSON.stringify(inboxMessages));
    updateInboxBadge();
  }
  
  function handlePageRouting() {
  var params = new URLSearchParams(window.location.search);
  var watchId = params.get('watch');
  var page = params.get('page');
  
  if (watchId) {
    openWatchPage(watchId);
  } else if (page === 'actors') {
    goActors();
  } else if (page === 'inbox') {
    goInbox();
  }
}
  
  function openWatchPage(imdbId) {
    var checkData = setInterval(function() {
      if (allContent.length > 0) {
        clearInterval(checkData);
        openWatch(imdbId);
      }
    }, 100);
  }
  
  function navigateHome() {
    window.location.href = window.location.pathname;
  }
  
  window.goHome = navigateHome;
  
  function goActors() {
    currentView = 'actors';
    homePageVisible = false;
    
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.add('active');
    document.getElementById('inboxPage').classList.remove('active');
    
    var settingsBtn = document.getElementById('settingsBtn');
    var settingsPanel = document.getElementById('settingsPanel');
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (settingsPanel) settingsPanel.classList.remove('active');
    
    stopHeroVideos();
    buildActorsPage();
    
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '?page=actors');
    }
  }
  
  window.goActors = goActors;
  
  function goInbox() {
    currentView = 'inbox';
    homePageVisible = false;
    
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.remove('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.add('active');
    
    var settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) settingsBtn.style.display = 'none';
    
    stopHeroVideos();
    renderInbox();
    
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '?page=inbox');
    }
  }
  
  window.goInbox = goInbox;
  
  function stopHeroVideos() {
    heroVideos.forEach(function(video) {
      if (video) {
        video.pause();
        video.currentTime = 0;
      }
    });
  }
  
  function openWatch(imdbId) {
    homePageVisible = false;
    stopHeroVideos();
    
    var item = allContent.find(function(m) { return m.imdb === imdbId; });
    if (!item) return;
    
    currentItem = item;
    currentView = 'watch';
    unlocked = false;
    
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('watchPage').classList.add('active');
    document.getElementById('actorsPage').classList.remove('active');
    document.getElementById('inboxPage').classList.remove('active');
    
    var settingsBtn = document.getElementById('settingsBtn');
    var settingsPanel = document.getElementById('settingsPanel');
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (settingsPanel) settingsPanel.classList.remove('active');
    
    setText('watchTitle', item.title);
    setText('watchYear', item.release || '');
    setText('watchDesc', item.description || 'No description available.');
    setText('watchQuality', item.quality || 'HD');
    setText('detailGenre', (item.genre || []).join(', ') || 'N/A');
    setText('detailCast', buildCastHTML(item.actors));
    setText('detailDirector', item.director || 'N/A');
    setText('detailCountry', item.country || 'N/A');
    setText('detailYear', item.release || '');
    setText('detailImdb', item.rating ? '⭐ ' + item.rating : '⭐ N/A');
    document.title = item.title + ' - PawNets';
    
    var seriesTag = document.getElementById('watchSeriesTag');
    var episodeSection = document.getElementById('episodeSection');
    var watchDuration = document.getElementById('watchDuration');
    var watchSeriesMeta = document.getElementById('watchSeriesMeta');
    var remindBtn = document.getElementById('remindBtn');
    
    if (item.type === 'series') {
      if (seriesTag) seriesTag.style.display = 'inline';
      if (watchDuration) watchDuration.textContent = 'Series';
      if (episodeSection) episodeSection.style.display = 'block';
      if (watchSeriesMeta) watchSeriesMeta.style.display = 'block';
      if (remindBtn) {
        remindBtn.style.display = 'flex';
        checkRemindButton();
      }
      loadSeriesEpisodes(item.imdb);
    } else {
      if (seriesTag) seriesTag.style.display = 'none';
      if (watchDuration) watchDuration.textContent = item.duration || '';
      if (episodeSection) episodeSection.style.display = 'none';
      if (watchSeriesMeta) watchSeriesMeta.style.display = 'none';
      if (remindBtn) remindBtn.style.display = 'none';
    }
    
    checkWatchlistButton();
    loadRelated();
    
    var playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper) {
      playerWrapper.innerHTML = '<div class="player-lock" id="playerLock">' +
        '<span style="font-size:45px;">🔒</span>' +
        '<p>An ad page may open in a new tab</p>' +
        '<p style="font-size:0.75rem;color:#aaa;">Simply close it and come back here</p>' +
        '<button class="unlock-btn" onclick="MVC.unlockPlayer()">🔓 Unlock Now</button>' +
      '</div>';
    }
    
    if (window.history && window.history.pushState) {
      window.history.pushState({}, '', '?watch=' + imdbId);
    }
  }
  
  function buildCastHTML(actors) {
    if (!actors || !actors.length) return 'N/A';
    return actors.map(function(actor) {
      return '<span class="actor-link" onclick="event.stopPropagation();MVC.goActors();MVC.searchActor(\'' + escH(actor) + '\')">' + escH(actor) + '</span>';
    }).join(', ');
  }
  
  async function loadSeriesEpisodes(imdbId) {
    var section = document.getElementById('episodeSection');
    if (section) section.style.display = 'block';
    
    var totalSeasons = 1;
    
    try {
      var res = await fetch(OMDB_API + 'i=' + imdbId + '&plot=short');
      var data = await res.json();
      totalSeasons = parseInt(data.totalSeasons) || 1;
    } catch (e) {}
    
    if (totalSeasons <= 1 && currentItem && currentItem.seasons && currentItem.seasons.length) {
      totalSeasons = currentItem.seasons.length;
    }
    
    var seriesMeta = document.getElementById('watchSeriesMeta');
    if (seriesMeta) {
      seriesMeta.style.display = 'block';
      seriesMeta.innerHTML = '<span>📺 ' + totalSeasons + ' Season' + (totalSeasons > 1 ? 's' : '') + '</span><span class="omdb-live">🔴 Live</span>';
    }
    
    var seasonTabs = document.getElementById('seasonTabs');
    if (seasonTabs) {
      seasonTabs.innerHTML = '';
      for (var i = 1; i <= totalSeasons; i++) {
        var btn = document.createElement('button');
        btn.className = 'season-tab' + (i === 1 ? ' active' : '');
        btn.textContent = 'Season ' + i;
        btn.setAttribute('data-season', i);
        btn.onclick = function() {
          var s = parseInt(this.getAttribute('data-season'));
          MVC.switchSeason(s, imdbId);
        };
        seasonTabs.appendChild(btn);
      }
    }
    
    await loadEpisodesForSeason(imdbId, 1);
  }
  
  async function switchSeason(season, imdbId) {
    var tabs = document.querySelectorAll('.season-tab');
    tabs.forEach(function(t) {
      t.classList.toggle('active', parseInt(t.getAttribute('data-season')) === season);
    });
    await loadEpisodesForSeason(imdbId, season);
  }
  async function loadEpisodesForSeason(imdbId, season) {
  var grid = document.getElementById('episodeGrid');
  if (!grid) return;
  
  grid.innerHTML = '<div style="text-align:center;padding:1rem;"><div class="spinner" style="width:24px;height:24px;border:3px solid rgba(255,255,255,0.1);border-top-color:var(--gold);border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto;"></div><p style="color:var(--gray);font-size:0.7rem;">Fetching episodes...</p></div>';
  
  var episodes = [];
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // SOURCE 1: OMDB API
  try {
    var res = await fetch(OMDB_API + 'i=' + imdbId + '&Season=' + season);
    var data = await res.json();
    if (data.Episodes && data.Episodes.length) {
      episodes = data.Episodes;
    }
  } catch (e) {}
  
  // SOURCE 2: TMDB API
  if (!episodes.length || episodes.length < 3) {
    try {
      var tmdbRes = await fetch('https://api.themoviedb.org/3/find/' + imdbId + '?api_key=4e44d9029b1270a757cddc766a1bcb63&external_source=imdb_id');
      var tmdbData = await tmdbRes.json();
      var tvResults = tmdbData.tv_results || [];
      
      if (tvResults.length > 0) {
        var tmdbId = tvResults[0].id;
        var seasonRes = await fetch('https://api.themoviedb.org/3/tv/' + tmdbId + '/season/' + season + '?api_key=4e44d9029b1270a757cddc766a1bcb63');
        var seasonData = await seasonRes.json();
        
        if (seasonData.episodes && seasonData.episodes.length) {
          episodes = seasonData.episodes.map(function(ep) {
            return {
              Episode: ep.episode_number,
              Title: ep.name || ('Episode ' + ep.episode_number),
              Released: ep.air_date || '',
              imdbRating: ep.vote_average ? ep.vote_average.toFixed(1) : null
            };
          });
        }
      }
    } catch (e) {}
  }
  
  // SOURCE 3: TVMaze API
  if (!episodes.length || episodes.length < 3) {
    try {
      var mazeRes = await fetch('https://api.tvmaze.com/lookup/shows?imdb=' + imdbId);
      var mazeData = await mazeRes.json();
      if (mazeData && mazeData.id) {
        var epsRes = await fetch('https://api.tvmaze.com/shows/' + mazeData.id + '/episodes?specials=1');
        var epsData = await epsRes.json();
        var seasonEps = epsData.filter(function(ep) { return ep.season === season; });
        
        if (seasonEps.length) {
          episodes = seasonEps.map(function(ep) {
            return {
              Episode: ep.number,
              Title: ep.name || ('Episode ' + ep.number),
              Released: ep.airdate || '',
              imdbRating: ep.rating ? ep.rating.average : null
            };
          });
        }
      }
    } catch (e) {}
  }
  
  if (episodes.length) {
    grid.innerHTML = episodes.map(function(ep) {
      var epNum = parseInt(ep.Episode);
      var isWatched = isEpisodeWatched(imdbId, season, epNum);
      
      // CHECK IF EPISODE IS IN THE FUTURE
      var isLocked = false;
      var releaseDate = null;
      var daysUntil = 0;
      
      if (ep.Released) {
        releaseDate = new Date(ep.Released + 'T00:00:00Z');
        if (!isNaN(releaseDate.getTime())) {
          if (releaseDate > today) {
            isLocked = true;
            daysUntil = Math.ceil((releaseDate - today) / (1000 * 60 * 60 * 24));
          }
        }
      }
      
      if (isLocked) {
        return '<div class="episode-card" style="opacity:0.5;cursor:not-allowed;border-color:#555;">' +
          '<div class="ep-info">' +
            '<span class="ep-num" style="color:#888;">🔒 Ep ' + epNum + '</span>' +
            '<span class="ep-title" style="color:#888;">' + escH(ep.Title) + '</span>' +
            '<span class="ep-air" style="color:var(--gold);">📅 ' + ep.Released + ' (in ' + daysUntil + ' day' + (daysUntil > 1 ? 's' : '') + ')</span>' +
          '</div>' +
        '</div>';
      }
      
      return '<div class="episode-card' + (isWatched ? ' ep-watched' : '') + '" data-ep="' + epNum + '" data-season="' + season + '" onclick="MVC.playEpisode(\'' + imdbId + '\', ' + season + ', ' + epNum + ')">' +
        '<div class="ep-info">' +
          '<span class="ep-num">Ep ' + epNum + '</span>' +
          '<span class="ep-title">' + escH(ep.Title) + '</span>' +
          (ep.Released ? '<span class="ep-air">📅 ' + ep.Released + '</span>' : '') +
          (ep.imdbRating ? '<span class="ep-air">⭐' + ep.imdbRating + '</span>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  } else {
    grid.innerHTML = '<p style="color:var(--gray);padding:1rem;text-align:center;">No episodes found. Try again later.</p>';
  }
}
  function playEpisode(imdbId, season, episode) {
    document.querySelectorAll('.episode-card').forEach(function(c) { c.classList.remove('playing'); });
    
    markEpisodeWatched(imdbId, season, episode);
    saveWatchProgress(imdbId, 100, season, episode);
    buildContinueWatching();
    
    if (!unlocked) {
      unlockPlayer();
      return;
    }
    
    var url = EMBOS_BASE + '/embed/tv/' + imdbId + '/' + season + '/' + episode + '?skin=prime&color=ffa500&title=false';
    var playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper) {
      playerWrapper.innerHTML = '<iframe src="' + url + '" allowfullscreen allow="autoplay; encrypted-media" loading="lazy" id="watchIframe"></iframe>';
      startWatchTimer(imdbId, season, episode);
    }
  }
  
  function unlockPlayer() {
    window.open(SMARTLINK, '_blank');
    unlocked = true;
    stopWatchTimer();
    
    var imdb = currentItem ? currentItem.imdb : null;
    if (!imdb) return;
    
    var url;
    if (currentItem.type === 'movie') {
      url = EMBOS_BASE + '/embed/movie/' + imdb  + '?skin=prime&color=ffa500&title=false&autoplay=true';
    } else {
      url = EMBOS_BASE + '/embed/tv/' + imdb + '/1/1' + '?skin=prime&color=ffa500&title=false&autoplay=true';
    }
    
    var playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper) {
      playerWrapper.innerHTML = '<iframe src="' + url + '" allowfullscreen allow="autoplay; encrypted-media" loading="lazy" id="watchIframe"></iframe>';
      if (currentItem.type === 'movie') {
        startWatchTimer(imdb, null, null);
      }
    }
  }
  
  function loadRelated() {
    if (!currentItem) return;
    var others = allContent.filter(function(m) { return m.imdb !== currentItem.imdb; });
    var sameGenre = others.filter(function(m) { return m.genre && m.genre.some(function(g) { return currentItem.genre && currentItem.genre.indexOf(g) !== -1; }); });
    var shuffled = others.slice().sort(function() { return 0.5 - Math.random(); });
    renderSidebar('sameGenreList', (sameGenre.length ? sameGenre : others).slice(0, 5));
    renderSidebar('similarList', (shuffled.length ? shuffled : others).slice(0, 5));
  }
  
  function renderSidebar(id, items) {
    var container = document.getElementById(id);
    if (!container) return;
    
    container.innerHTML = items.map(function(m) {
      return '<div class="side-item" onclick="MVC.openWatch(\'' + m.imdb + '\')">' +
        '<div class="side-thumb">' +
          '<img src="' + (m.poster || '') + '" loading="lazy" onerror="this.src=\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 75%22><rect fill=%22%23111%22 width=%2250%22 height=%2275%22/><text fill=%22%23f5b042%22 x=%2225%22 y=%2238%22 text-anchor=%22middle%22>🎬</text></svg>\'">' +
        '</div>' +
        '<div class="side-info">' +
          '<div class="side-title">' + escH(m.title) + '</div>' +
          '<div class="side-meta">' + (m.release || '') + ' ' + (m.rating ? '<span class="side-rating">⭐' + m.rating + '</span>' : '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  
  function buildActorCache() {
    allContent.forEach(function(m) {
      if (m.actors) {
        m.actors.forEach(function(actor) {
          if (!actorCache[actor]) {
            actorCache[actor] = { name: actor, movies: [] };
          }
          if (actorCache[actor].movies.indexOf(m.imdb) === -1) {
            actorCache[actor].movies.push(m.imdb);
          }
        });
      }
    });
    localStorage.setItem('paw_actors', JSON.stringify(actorCache));
  }
  
  function buildActorsPage() {
    if (Object.keys(actorCache).length === 0) buildActorCache();
    
    var grid = document.getElementById('actorsGrid');
    if (!grid) return;
    
    var actors = Object.values(actorCache).sort(function(a, b) { return a.name.localeCompare(b.name); });
    
    grid.innerHTML = actors.map(function(actor) {
      return '<div class="actor-card" onclick="MVC.showActorMovies(\'' + escH(actor.name) + '\')">' +
        '<div class="actor-avatar">🎭</div>' +
        '<div class="actor-name">' + escH(actor.name) + '</div>' +
        '<div style="font-size:0.65rem;color:var(--gray);">' + actor.movies.length + ' titles</div>' +
      '</div>';
    }).join('');
    
    var searchInput = document.getElementById('actorSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var q = this.value.trim().toLowerCase();
        var filtered = actors.filter(function(a) { return a.name.toLowerCase().includes(q); });
        grid.innerHTML = filtered.map(function(actor) {
          return '<div class="actor-card" onclick="MVC.showActorMovies(\'' + escH(actor.name) + '\')">' +
            '<div class="actor-avatar">🎭</div>' +
            '<div class="actor-name">' + escH(actor.name) + '</div>' +
            '<div style="font-size:0.65rem;color:var(--gray);">' + actor.movies.length + ' titles</div>' +
          '</div>';
        }).join('');
      });
    }
  }
  
  function searchActor(name) {
    goActors();
    setTimeout(function() {
      var searchInput = document.getElementById('actorSearchInput');
      if (searchInput) {
        searchInput.value = name;
        searchInput.dispatchEvent(new Event('input'));
      }
      showActorMovies(name);
    }, 300);
  }
  
  function showActorMovies(name) {
    if (Object.keys(actorCache).length === 0) buildActorCache();
    
    var actor = actorCache[name];
    if (!actor) return;
    
    var detailPanel = document.getElementById('actorDetailPanel');
    if (!detailPanel) return;
    
    detailPanel.style.display = 'block';
    detailPanel.innerHTML = '<div class="actor-detail-head">' +
      '<div class="actor-avatar-lg">🎭</div>' +
      '<div><h2>' + escH(actor.name) + '</h2><p class="actor-sub">' + actor.movies.length + ' titles on PawNets</p></div>' +
    '</div>' +
    '<div class="movies-grid" style="margin-top:1rem;">' +
      actor.movies.map(function(imdb) {
        var movie = allContent.find(function(m) { return m.imdb === imdb; });
        if (!movie) return '';
        return '<div class="movie-card" onclick="MVC.openWatch(\'' + imdb + '\')">' +
          '<div class="poster-wrap">' +
            '<img src="' + (movie.poster || '') + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--gold);font-size:2rem;>🎬</div>\'">' +
            '<span class="quality-badge">' + (movie.quality || 'HD') + '</span>' +
            (movie.type === 'series' ? '<span class="type-badge">📺</span>' : '') +
            '<div class="poster-overlay"><div class="play-circle">▶</div></div>' +
          '</div>' +
          '<div class="card-info"><div class="card-title">' + escH(movie.title) + '</div><div class="card-meta"><span class="card-rating">⭐ ' + (movie.rating || '?') + '</span><span>' + (movie.release || '') + '</span></div></div>' +
        '</div>';
      }).join('') +
    '</div>';
  }
  
  window.searchActor = searchActor;
  window.showActorMovies = showActorMovies;
  
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
      list = list.filter(function(m) { return (m.genre || []).some(function(g) { return g.toLowerCase() === currentGenre.toLowerCase(); }); });
    }
    
    var sortSelect = document.getElementById('sortSelect');
    var sort = sortSelect ? sortSelect.value : 'default';
    
    if (sort === 'rating') list.sort(function(a, b) { return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0); });
    else if (sort === 'title') list.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
    else list.sort(function(a, b) { return (b.release || 0) - (a.release || 0); });
    
    filteredContent = list;
    
    var sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
      sectionTitle.textContent = {
        all: 'All Content', movies: '🎥 Movies', series: '📺 TV Series',
        trending: '🔥 Trending', topRated: '⭐ Top Rated'
      }[currentTab] || 'All Content';
    }
    
    renderPage();
  }
  
  function renderPage() {
    var perPage = 48;
    var total = Math.ceil(filteredContent.length / perPage);
    if (currentPage > total) currentPage = 1;
    
    var items = filteredContent.slice((currentPage - 1) * perPage, currentPage * perPage);
    var grid = document.getElementById('moviesGrid');
    var pagination = document.getElementById('pagination');
    
    if (grid) {
      grid.innerHTML = items.length ? items.map(function(m) {
        return '<div class="movie-card" onclick="MVC.openWatch(\'' + m.imdb + '\')">' +
          '<div class="poster-wrap">' +
            '<img src="' + (m.poster || '') + '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--gold);font-size:2rem;>🎬</div>\'">' +
            '<span class="quality-badge">' + (m.quality || 'HD') + '</span>' +
            (m.type === 'series' ? '<span class="type-badge">📺</span>' : '') +
            '<div class="poster-overlay"><div class="play-circle">▶</div></div>' +
          '</div>' +
          '<div class="card-info">' +
            '<div class="card-title">' + escH(m.title) + '</div>' +
            '<div class="card-meta"><span class="card-rating">⭐ ' + (m.rating || '?') + '</span><span>' + (m.release || '') + '</span></div>' +
          '</div>' +
        '</div>';
      }).join('') : '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;"><p>Nothing found</p></div>';
    }
    
    if (pagination) {
      pagination.innerHTML = total > 1 ? Array.from({ length: total }, function(_, i) {
        return '<button class="page-btn' + (i + 1 === currentPage ? ' active' : '') + '" onclick="MVC.goToPage(' + (i + 1) + ')">' + (i + 1) + '</button>';
      }).join('') : '';
    }
  }
  
  function goToPage(p) {
    currentPage = p;
    renderPage();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
  
  function handleSearch() {
    var searchInput = document.getElementById('searchInput');
    var searchClear = document.getElementById('searchClear');
    var searchDropdown = document.getElementById('searchDropdown');
    var dropdownContent = document.getElementById('dropdownContent');
    
    if (!searchInput) return;
    
    var q = searchInput.value.trim();
    if (searchClear) searchClear.style.display = q ? 'flex' : 'none';
    
    if (q.length >= 2) {
      var matches = allContent.filter(function(m) { return (m.title || '').toLowerCase().includes(q.toLowerCase()); }).slice(0, 7);
      if (dropdownContent) {
        dropdownContent.innerHTML = matches.length ? matches.map(function(m) {
          return '<div class="dropdown-item" onmousedown="MVC.openWatch(\'' + m.imdb + '\')">' +
            '<img src="' + (m.poster || '') + '" onerror="this.style.display=\'none\'" alt="">' +
            '<div class="dropdown-info">' +
              '<div class="dropdown-title">' + escH(m.title) + '</div>' +
              '<div class="dropdown-meta">' + (m.release || '') + ' • ' + ((m.genre || [])[0] || '') + '</div>' +
            '</div>' +
            '<span class="dropdown-type ' + m.type + '">' + m.type.toUpperCase() + '</span>' +
          '</div>';
        }).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--gray);">Nothing found</div>';
      }
      if (searchDropdown) searchDropdown.classList.add('active');
    } else {
      if (searchDropdown) searchDropdown.classList.remove('active');
    }
  }
  
  function showDropdown() {
    var searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim().length >= 2) {
      var searchDropdown = document.getElementById('searchDropdown');
      if (searchDropdown) searchDropdown.classList.add('active');
    }
  }
  
  function hideDropdown() {
    setTimeout(function() {
      var searchDropdown = document.getElementById('searchDropdown');
      if (searchDropdown) searchDropdown.classList.remove('active');
    }, 150);
  }
  
  function clearSearch() {
    var searchInput = document.getElementById('searchInput');
    var searchClear = document.getElementById('searchClear');
    var searchDropdown = document.getElementById('searchDropdown');
    
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (searchDropdown) searchDropdown.classList.remove('active');
  }
  
  function openRequestForm() {
    var modal = document.getElementById('requestFormModal');
    if (modal) modal.classList.add('active');
    
    var searchInput = document.getElementById('searchInput');
    var titleInput = document.querySelector('#requestForm input[name="title"]');
    if (titleInput && searchInput) {
      var q = searchInput.value.trim();
      if (q) titleInput.value = q;
    }
    
    var formResult = document.getElementById('formResult');
    if (formResult) formResult.innerHTML = '';
  }
  
  function closeRequestForm() {
    var modal = document.getElementById('requestFormModal');
    if (modal) modal.classList.remove('active');
  }
  
  function checkAndShowResult(title) {
    var formResult = document.getElementById('formResult');
    if (!formResult) return;
    
    if (!title || title.length < 2) {
      formResult.innerHTML = '';
      return;
    }
    
    var q = title.toLowerCase().trim();
    var matches = allContent.filter(function(m) { return (m.title || '').toLowerCase().includes(q); }).slice(0, 4);
    
    if (matches.length) {
      formResult.innerHTML = '<div style="background:rgba(41,229,122,0.08);border:1px solid var(--green);border-radius:8px;padding:0.8rem;margin-bottom:0.8rem;">' +
        '<p style="color:var(--green);font-weight:700;font-size:0.8rem;">✅ Already on PawNets!</p>' +
        matches.map(function(m) { return '<a onclick="MVC.closeRequestForm();MVC.openWatch(\'' + m.imdb + '\')" style="display:block;color:var(--gold);cursor:pointer;font-size:0.75rem;padding:0.2rem 0;">🎬 ' + escH(m.title) + ' (' + (m.release || '?') + ') ⭐' + (m.rating || '?') + '</a>'; }).join('') +
      '</div>' +
      '<button type="submit" class="unlock-btn" style="width:100%;">📩 Send Anyway</button>';
    } else {
      formResult.innerHTML = '<div style="background:rgba(245,176,66,0.07);border:1px solid rgba(245,176,66,0.25);border-radius:8px;padding:0.8rem;margin-bottom:0.8rem;">' +
        '<p style="color:var(--gold);font-weight:700;font-size:0.8rem;">🆕 Not on PawNets yet!</p>' +
        '<p style="color:var(--gray);font-size:0.75rem;">"' + escH(title) + '" will be added soon.</p>' +
      '</div>' +
      '<button type="submit" class="unlock-btn" style="width:100%;">📩 Send Request</button>';
    }
  }
  
  function shareContent() {
    if (!currentItem) return;
    var url = location.href;
    
    if (navigator.share) {
      navigator.share({ title: currentItem.title, url: url }).catch(function() {});
      return;
    }
    
    var overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.innerHTML = '<div class="share-box">' +
      '<button style="position:absolute;top:10px;right:14px;background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;" onclick="this.closest(\'.share-overlay\').remove()">✕</button>' +
      '<h3 style="margin-bottom:0.8rem;">Share</h3>' +
      '<div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;"><input value="' + url + '" readonly style="flex:1;background:var(--bg2);border:1px solid var(--border);color:#fff;padding:0.5rem;border-radius:6px;"><button onclick="navigator.clipboard.writeText(\'' + url + '\')" style="background:var(--gold);color:#000;border:none;padding:0.5rem 1rem;border-radius:6px;font-weight:700;cursor:pointer;">Copy</button></div>' +
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' +
        '<a href="https://facebook.com/sharer.php?u=' + encodeURIComponent(url) + '" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">📘 FB</a>' +
        '<a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(url) + '" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">🐦 X</a>' +
        '<a href="https://wa.me/?text=' + encodeURIComponent(url) + '" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">💬 WA</a>' +
      '</div></div>';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }
  
  function exitWatchPage() {
    stopWatchTimer();
    window.location.href = window.location.pathname;
  }
  
  window.addEventListener('scroll', function() {
    var backToTop = document.getElementById('backToTop');
    if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
  });
  
  window.addEventListener('popstate', function() {
    if (currentView === 'watch') {
      exitWatchPage();
    } else if (currentView === 'actors' || currentView === 'inbox') {
      navigateHome();
    }
  });
  
  window.addEventListener('beforeunload', function() {
    stopWatchTimer();
    if (visibilityObserver) visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    heroVideos.forEach(function(video) {
      if (video) {
        video.pause();
        video.src = '';
      }
    });
  });
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (currentView === 'watch') {
        exitWatchPage();
      } else {
        closeRequestForm();
        clearSearch();
      }
    }
    if (e.key === 'f' && currentView === 'watch') {
      unlockPlayer();
    }
  });
  
  window.MVC = {
    navigateHome: navigateHome,
    openWatch: openWatch,
    exitWatchPage: exitWatchPage,
    goActors: goActors,
    goInbox: goInbox,
    heroSlide: heroSlide,
    heroGoTo: heroGoTo,
    handleVideoLoad: handleVideoLoad,
    handleVideoPlaying: handleVideoPlaying,
    handleVideoWaiting: handleVideoWaiting,
    checkVideoProgress: checkVideoProgress,
    switchSeason: switchSeason,
    playEpisode: playEpisode,
    unlockPlayer: unlockPlayer,
    goToPage: goToPage,
    switchTab: switchTab,
    filterGenre: filterGenre,
    handleSearch: handleSearch,
    showDropdown: showDropdown,
    hideDropdown: hideDropdown,
    clearSearch: clearSearch,
    openRequestForm: openRequestForm,
    closeRequestForm: closeRequestForm,
    checkAndShowResult: checkAndShowResult,
    shareContent: shareContent,
    removeContinue: removeContinue,
    buildContinueWatching: buildContinueWatching,
    toggleWatchlist: toggleWatchlist,
    toggleRemind: toggleRemind,
    searchActor: searchActor,
    showActorMovies: showActorMovies,
    toggleSettings: window.toggleSettings,
    changeFontSize: window.changeFontSize,
    changeBgColor: window.changeBgColor
  };
  
  Object.keys(window.MVC).forEach(function(key) {
    if (typeof window.MVC[key] === 'function' && !window[key]) {
      window[key] = function() {
        return window.MVC[key].apply(window.MVC, arguments);
      };
    }
  });
  
  loadData();
  
})();
