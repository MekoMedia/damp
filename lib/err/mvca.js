// MVCPlayer - Complete JavaScript (v2.0)
// Host this file on GitHub and link in your HTML: <script src="YOUR_GITHUB_RAW_URL"></script>

(function() {
  'use strict';
  
  // CONFIGURATION
  const JSON_URL = 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/data.json';
  const OMDB_API = 'https://www.omdbapi.com/?apikey=thewdb&';
  const EMBOS_BASE = 'https://nextgencloudfabric.com';
  const SMARTLINK = 'https://omg10.com/4/11143489';
  
  // STATE
  let allContent = [], filteredContent = [], currentTab = 'all', currentGenre = 'all', currentPage = 1;
  let heroIndex = 0, heroTotal = 0, heroTimer = null;
  let currentView = 'home', currentItem = null, unlocked = false, homePageVisible = true;
  let heroVideos = [], visibilityObserver = null, heroInitialized = false, userHasInteracted = false;
  
  // Helper: escape HTML
  function escH(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  
  // Helper: clean poster URL
  function cleanPoster(url) {
    if (!url || url.includes('$') || !url.startsWith('http')) return '';
    return url;
  }
  
  // INITIALIZATION
  setTimeout(() => {
    const splash = document.getElementById('introSplash');
    if (splash) splash.classList.add('hide');
    homePageVisible = true;
  }, 2000);
  
  // SETTINGS
  window.toggleSettings = () => {
    const panel = document.getElementById('settingsPanel');
    if (panel) panel.classList.toggle('active');
  };
  
  window.changeFontSize = (size) => {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    const fontSizeValue = document.getElementById('fontSizeValue');
    if (fontSizeValue) fontSizeValue.textContent = size + 'px';
  };
  
  window.changeBgColor = (color) => {
    document.documentElement.style.setProperty('--bg', color);
  };
  
  // DATA LOADING
  async function loadData() {
    try {
      const r = await fetch(JSON_URL);
      const d = await r.json();
      allContent = (d.movies || []).map(m => ({
        ...m,
        type: m.type || ((m.seasons && m.seasons.length) ? 'series' : 'movie'),
        imdb: String(m.imdb || ''),
        popularity: m.popularity || Math.floor(Math.random() * 60),
        poster: cleanPoster(m.poster)
      }));
      buildGenreSelect();
      buildHero();
      applyFilters();
    } catch (e) {
      const grid = document.getElementById('moviesGrid');
      if (grid) grid.innerHTML = '<div class="empty-state">Failed to load data. Please refresh.</div>';
    }
  }
  
  function buildGenreSelect() {
    const genres = new Set();
    allContent.forEach(m => (m.genre || []).forEach(g => genres.add(g)));
    const select = document.getElementById('genreSelect');
    if (!select) return;
    Array.from(genres).sort().forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      select.appendChild(opt);
    });
  }
  
  // HERO CAROUSEL
  function buildHero() {
    const heroCarousel = document.getElementById('heroCarousel');
    const heroTrack = document.getElementById('heroTrack');
    const heroDots = document.getElementById('heroDots');
    
    if (!heroCarousel || !heroTrack || !heroDots) return;
    
    const heroData = [
      { movie: 'tt37287335', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Obsession%20Movie%20Clip%20-%20Nice%20Date%20(2026)(720P_HD).mp4' },
      { movie: 'tt26657236', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Backrooms%20_%20Official%20Clip%20_%20A24(720P_HD).mp4' },
      { movie: 'tt0427340', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Masters%20of%20the%20Universe%20Movie%20Clip%20-%20The%20Crescendo%20(2026)(720P_HD).mp4' },
      { movie: 'tt5622316', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/The%20Chosen%20_%20Official%20Trailer%20HD(720P_HD).mp4' },
      { movie: 'tt0816692', video: 'https://raw.githubusercontent.com/MekoMedia/damp/refs/heads/main/lib/err/Interstellar%20-%20Trailer%20-%20Official%20Warner%20Bros.%20UK(720P_HD).mp4' }
    ];
    
    const items = heroData
      .map(data => {
        const movie = allContent.find(m => m.imdb === data.movie);
        return movie ? { ...movie, videoUrl: data.video } : null;
      })
      .filter(item => item && item.poster);
    
    if (!items.length) {
      heroCarousel.style.display = 'none';
      return;
    }
    
    heroTotal = items.length;
    heroVideos = [];
    heroInitialized = false;
    heroIndex = 0;
    
    heroTrack.innerHTML = items.map((m, i) => `
      <div class="hero-slide" onclick="MVC.openWatch('${m.imdb}')">
        <video 
          class="hero-video" 
          src="${m.videoUrl}"
          muted
          playsinline 
          preload="auto"
          data-index="${i}"
          onerror="this.style.display='none';"
          onloadeddata="MVC.handleVideoLoad(${i})"
          ontimeupdate="MVC.checkVideoProgress(${i})"
          onplaying="MVC.handleVideoPlaying(${i})"
          onwaiting="MVC.handleVideoWaiting(${i})"
        ></video>
        
        <div class="hero-info-bar">
          <div>
            <h3>${escH(m.title)}</h3>
            <p class="hero-meta">⭐ ${m.rating || '?'} • ${m.release || ''} • ${m.quality || 'HD'}</p>
          </div>
          <button class="hero-btn" onclick="event.stopPropagation();MVC.openWatch('${m.imdb}')">▶ Watch</button>
        </div>
      </div>
    `).join('');
    
    heroDots.innerHTML = items.map((_, i) => `
      <button class="hero-dot${i === 0 ? ' active' : ''}" onclick="MVC.heroGoTo(${i})"></button>
    `).join('');
    
    // User interaction detection for autoplay
    const enableAutoplay = () => {
      if (!userHasInteracted) {
        userHasInteracted = true;
        startHeroVideos();
        ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
          document.removeEventListener(event, enableAutoplay);
        });
      }
    };
    
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(event => {
      document.addEventListener(event, enableAutoplay, { once: false });
    });
    
    // Try autoplay after splash
    setTimeout(() => {
      heroVideos = Array.from(document.querySelectorAll('.hero-video'));
      if (heroVideos[0] && !userHasInteracted) {
        heroVideos[0].muted = true;
        heroVideos[0].currentTime = 0;
        heroVideos[0].play().then(() => {
          console.log('Hero video playing muted');
        }).catch(() => {
          showPlayIndicator();
        });
      }
    }, 2500);
    
    setupVisibilityObserver();
  }
  
  function showPlayIndicator() {
    const heroSection = document.getElementById('heroCarousel');
    if (!heroSection || heroSection.querySelector('.hero-play-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'hero-play-indicator';
    indicator.innerHTML = '▶';
    indicator.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      z-index: 10; background: rgba(245, 176, 66, 0.9); color: #000;
      width: 60px; height: 60px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 24px;
      cursor: pointer; pointer-events: auto;
    `;
    indicator.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      userHasInteracted = true;
      startHeroVideos();
      indicator.remove();
    };
    
    const heroSlide = heroSection.querySelector('.hero-slide');
    if (heroSlide) heroSlide.appendChild(indicator);
  }
  
  function startHeroVideos() {
    if (heroInitialized || !homePageVisible) return;
    heroInitialized = true;
    
    const indicator = document.querySelector('.hero-play-indicator');
    if (indicator) indicator.remove();
    
    heroVideos = Array.from(document.querySelectorAll('.hero-video'));
    
    if (heroVideos[0]) {
      heroVideos[0].muted = false;
      heroVideos[0].volume = 1.0;
      heroVideos[0].currentTime = 0;
      heroVideos[0].play().catch(() => {
        heroVideos[0].muted = true;
        heroVideos[0].volume = 0;
        heroVideos[0].play().catch(() => {});
      });
    }
    
    heroVideos.forEach((video, i) => {
      if (i !== heroIndex && video) video.load();
    });
  }
  
  function handleVideoLoad(index) {
    const videos = heroVideos.length ? heroVideos : document.querySelectorAll('.hero-video');
    const video = videos[index];
    if (!video) return;
    
    if (index === heroIndex && userHasInteracted && homePageVisible) {
      video.muted = false;
      video.volume = 1.0;
      video.currentTime = 0;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    }
  }
  
  function handleVideoPlaying(index) {
    if (index === heroIndex) {
      const indicator = document.querySelector('.hero-play-indicator');
      if (indicator) indicator.remove();
      heroInitialized = true;
    }
  }
  
  function handleVideoWaiting(index) {
    if (index === heroIndex && !heroInitialized && homePageVisible) {
      setTimeout(() => {
        const video = heroVideos[index];
        if (video && video.paused && userHasInteracted) {
          video.play().catch(() => {});
        }
      }, 1000);
    }
  }
  
  function checkVideoProgress(index) {
    const video = heroVideos[index] || document.querySelectorAll('.hero-video')[index];
    if (!video || index !== heroIndex) return;
    
    if (video.duration && video.currentTime >= video.duration - 0.3) {
      if (heroTimer) clearInterval(heroTimer);
      heroSlide(1);
    }
  }
  
  function setupVisibilityObserver() {
    if (visibilityObserver) visibilityObserver.disconnect();
    
    const heroSection = document.getElementById('heroCarousel');
    if (!heroSection) return;
    
    visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const currentVideo = heroVideos[heroIndex];
        if (!currentVideo || !homePageVisible) return;
        
        if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
          if (currentVideo.paused && userHasInteracted) {
            currentVideo.play().catch(() => {});
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
    const currentVideo = heroVideos[heroIndex];
    if (!currentVideo) return;
    
    if (document.hidden || !homePageVisible) {
      currentVideo.pause();
    } else if (homePageVisible && userHasInteracted) {
      currentVideo.play().catch(() => {});
    }
  }
  
  function heroSlide(d) {
    const currentVideo = heroVideos[heroIndex];
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    heroIndex = (heroIndex + d + heroTotal) % heroTotal;
    updateHero();
  }
  
  function heroGoTo(i) {
    const currentVideo = heroVideos[heroIndex];
    if (currentVideo) {
      currentVideo.pause();
      currentVideo.currentTime = 0;
    }
    heroIndex = i;
    updateHero();
  }
  
  function updateHero() {
    const heroTrack = document.getElementById('heroTrack');
    if (heroTrack) heroTrack.style.transform = `translateX(-${heroIndex * 100}%)`;
    
    document.querySelectorAll('.hero-dot').forEach((d, i) => d.classList.toggle('active', i === heroIndex));
    
    if (!homePageVisible) return;
    
    const nextVideo = heroVideos[heroIndex];
    if (nextVideo && userHasInteracted) {
      nextVideo.currentTime = 0;
      nextVideo.muted = false;
      nextVideo.volume = 1.0;
      nextVideo.play().catch(() => {
        nextVideo.muted = true;
        nextVideo.play().catch(() => {});
      });
    }
    
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }
  
  // NAVIGATION
  function navigateHome() {
    currentView = 'home';
    homePageVisible = true;
    
    const homePage = document.getElementById('homePage');
    const watchPage = document.getElementById('watchPage');
    const settingsBtn = document.getElementById('settingsBtn');
    
    if (homePage) homePage.style.display = 'block';
    if (watchPage) watchPage.classList.remove('active');
    if (settingsBtn) settingsBtn.style.display = 'flex';
    
    // Resume hero video
    const currentVideo = heroVideos[heroIndex];
    if (currentVideo && userHasInteracted) {
      currentVideo.play().catch(() => {});
    }
    
    applyFilters();
  }
  
  async function openWatch(imdbId) {
    // Pause hero videos
    homePageVisible = false;
    heroVideos.forEach(video => { if (video) video.pause(); });
    
    const item = allContent.find(m => m.imdb === imdbId);
    if (!item) return;
    
    currentItem = item;
    currentView = 'watch';
    
    const homePage = document.getElementById('homePage');
    const watchPage = document.getElementById('watchPage');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsPanel = document.getElementById('settingsPanel');
    
    if (homePage) homePage.style.display = 'none';
    if (watchPage) watchPage.classList.add('active');
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (settingsPanel) settingsPanel.classList.remove('active');
    
    // Populate watch page
    setText('watchTitle', item.title);
    setText('watchYear', item.release || '');
    setText('watchDesc', item.description || 'No description available.');
    setText('watchQuality', item.quality || 'HD');
    setText('detailGenre', (item.genre || []).join(', ') || 'N/A');
    setText('detailCast', (item.actors || []).join(', ') || 'N/A');
    setText('detailDirector', item.director || 'N/A');
    setText('detailCountry', item.country || 'N/A');
    setText('detailYear', item.release || '');
    setText('detailImdb', item.rating ? `⭐ ${item.rating}` : '⭐ N/A');
    document.title = `${item.title} - MVCPlayer`;
    
    const seriesTag = document.getElementById('watchSeriesTag');
    const episodeSection = document.getElementById('episodeSection');
    const watchDuration = document.getElementById('watchDuration');
    const watchSeriesMeta = document.getElementById('watchSeriesMeta');
    
    if (item.type === 'series') {
      if (seriesTag) seriesTag.style.display = 'inline';
      if (watchDuration) watchDuration.textContent = 'Series';
      if (episodeSection) episodeSection.style.display = 'block';
      if (watchSeriesMeta) watchSeriesMeta.style.display = 'block';
      await loadSeriesEpisodes(item.imdb);
    } else {
      if (seriesTag) seriesTag.style.display = 'none';
      if (watchDuration) watchDuration.textContent = item.duration || '';
      if (episodeSection) episodeSection.style.display = 'none';
      if (watchSeriesMeta) watchSeriesMeta.style.display = 'none';
    }
    
    loadRelated();
    unlocked = false;
    
    const playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper) {
      playerWrapper.innerHTML = `
        <div class="player-lock" id="playerLock">
          <span style="font-size:45px;">🔒</span>
          <p>An ad page may open in a new tab</p>
          <p style="font-size:0.75rem;color:#aaa;">Simply close it and come back here</p>
          <button class="unlock-btn" onclick="MVC.unlockPlayer()">🔓 Unlock Now</button>
        </div>`;
    }
  }
  
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  
  // SERIES EPISODES
  async function loadSeriesEpisodes(imdbId) {
    const section = document.getElementById('episodeSection');
    if (section) section.style.display = 'block';
    
    try {
      const res = await fetch(`${OMDB_API}i=${imdbId}&plot=short`);
      const data = await res.json();
      const totalSeasons = parseInt(data.totalSeasons) || 1;
      
      const seriesMeta = document.getElementById('watchSeriesMeta');
      if (seriesMeta) {
        seriesMeta.style.display = 'block';
        seriesMeta.innerHTML = `<span>📺 ${totalSeasons} Season${totalSeasons > 1 ? 's' : ''}</span>`;
      }
      
      const seasonTabs = document.getElementById('seasonTabs');
      if (seasonTabs) {
        seasonTabs.innerHTML = Array.from({ length: totalSeasons }, (_, i) => `
          <button class="season-tab${i === 0 ? ' active' : ''}" onclick="MVC.switchSeason(${i + 1}, '${imdbId}')">Season ${i + 1}</button>
        `).join('');
      }
      
      await loadEpisodesForSeason(imdbId, 1);
    } catch (e) {
      if (section) section.innerHTML = '<p style="color:var(--gray);padding:1rem;">Failed to load episodes</p>';
    }
  }
  
  async function switchSeason(season, imdbId) {
    document.querySelectorAll('.season-tab').forEach((t, i) => t.classList.toggle('active', i + 1 === season));
    await loadEpisodesForSeason(imdbId, season);
  }
  
  async function loadEpisodesForSeason(imdbId, season) {
    const grid = document.getElementById('episodeGrid');
    if (!grid) return;
    
    grid.innerHTML = '<div style="text-align:center;padding:1rem;"><div class="spinner"></div></div>';
    
    try {
      const res = await fetch(`${OMDB_API}i=${imdbId}&Season=${season}`);
      const data = await res.json();
      if (data.Episodes) {
        grid.innerHTML = data.Episodes.map((ep, i) => `
          <div class="episode-card" onclick="MVC.playEpisode('${imdbId}', ${season}, ${ep.Episode})">
            <div class="ep-info">
              <span class="ep-num">Ep ${ep.Episode}</span>
              <span class="ep-title">${escH(ep.Title)}</span>
            </div>
          </div>
        `).join('');
      } else {
        grid.innerHTML = '<p style="color:var(--gray);padding:1rem;">No episodes found</p>';
      }
    } catch (e) {
      grid.innerHTML = '<p style="color:var(--gray);padding:1rem;">Error loading episodes</p>';
    }
  }
  
  function playEpisode(imdbId, season, episode) {
    document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('playing'));
    
    if (!unlocked) {
      unlockPlayer();
      return;
    }
  
    const url = `${EMBOS_BASE}/embed/tv/${imdbId}/${season}/${episode}?skin=prime&color=ffa500&title=false`;
    const playerWrapper = document.getElementById('playerWrapper');
    if (playerWrapper) {
      playerWrapper.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media" loading="lazy"></iframe>`;
    }
  }
  
  function unlockPlayer() {
    window.open(SMARTLINK, '_blank');
    unlocked = true;
    
    const imdb = currentItem?.imdb;
    if (currentItem?.type === 'movie') {
      const url = `${EMBOS_BASE}/embed/movie/${imdb}?skin=prime&color=ffa500&title=false`;
      const playerWrapper = document.getElementById('playerWrapper');
      if (playerWrapper) {
        playerWrapper.innerHTML = `<iframe src="${url}" allowfullscreen allow="autoplay; encrypted-media" loading="lazy"></iframe>`;
      }
    } else if (currentItem?.type === 'series') {
      playEpisode(imdb, 1, 1);
    }
  }
  
  // RELATED CONTENT
  function loadRelated() {
    if (!currentItem) return;
    const others = allContent.filter(m => m.imdb !== currentItem.imdb);
    const sameGenre = others.filter(m => m.genre?.some(g => currentItem.genre?.includes(g)));
    renderSidebar('sameGenreList', (sameGenre.length ? sameGenre : others).slice(0, 5));
    renderSidebar('similarList', others.sort(() => 0.5 - Math.random()).slice(0, 5));
  }
  
  function renderSidebar(id, items) {
    const container = document.getElementById(id);
    if (!container) return;
    
    container.innerHTML = items.map(m => `
      <div class="side-item" onclick="MVC.openWatch('${m.imdb}')">
        <div class="side-thumb">
          <img src="${m.poster}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 50 75%22><rect fill=%22%23111%22 width=%2250%22 height=%2275%22/><text fill=%22%23f5b042%22 x=%2225%22 y=%2238%22 text-anchor=%22middle%22>🎬</text></svg>'">
        </div>
        <div class="side-info">
          <div class="side-title">${escH(m.title)}</div>
          <div class="side-meta">${m.release || ''} ${m.rating ? `<span class="side-rating">⭐${m.rating}</span>` : ''}</div>
        </div>
      </div>
    `).join('');
  }
  
  // SHARE
  function shareContent() {
    if (!currentItem) return;
    const url = location.href;
    
    if (navigator.share) {
      navigator.share({ title: currentItem.title, url }).catch(() => {});
      return;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'share-overlay';
    overlay.innerHTML = `
      <div class="share-box">
        <button style="position:absolute;top:10px;right:14px;background:none;border:none;color:#fff;font-size:1.2rem;cursor:pointer;" onclick="this.closest('.share-overlay').remove()">✕</button>
        <h3 style="margin-bottom:0.8rem;">Share</h3>
        <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">
          <input value="${url}" readonly style="flex:1;background:var(--bg2);border:1px solid var(--border);color:#fff;padding:0.5rem;border-radius:6px;">
          <button onclick="navigator.clipboard.writeText('${url}')" style="background:var(--gold);color:#000;border:none;padding:0.5rem 1rem;border-radius:6px;font-weight:700;cursor:pointer;">Copy</button>
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;">
          <a href="https://facebook.com/sharer.php?u=${encodeURIComponent(url)}" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">📘 FB</a>
          <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">🐦 X</a>
          <a href="https://wa.me/?text=${encodeURIComponent(url)}" target="_blank" style="padding:0.5rem 1rem;background:var(--hover);border-radius:6px;color:#fff;text-decoration:none;">💬 WA</a>
        </div>
      </div>`;
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  }
  
  // FILTERS & GRID
  function switchTab(tab, btn) {
    currentTab = tab;
    currentPage = 1;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    applyFilters();
  }
  
  function filterGenre(genre) {
    currentGenre = genre;
    currentPage = 1;
    applyFilters();
  }
  
  function applyFilters() {
    let list = [...allContent];
    
    if (currentTab === 'movies') list = list.filter(m => m.type === 'movie');
    else if (currentTab === 'series') list = list.filter(m => m.type === 'series');
    else if (currentTab === 'trending') list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    else if (currentTab === 'topRated') list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    
    if (currentGenre !== 'all') {
      list = list.filter(m => (m.genre || []).some(g => g.toLowerCase() === currentGenre.toLowerCase()));
    }
    
    const sortSelect = document.getElementById('sortSelect');
    const sort = sortSelect ? sortSelect.value : 'default';
    
    if (sort === 'rating') list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
    else if (sort === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    else list.sort((a, b) => (b.release || 0) - (a.release || 0));
    
    filteredContent = list;
    
    const sectionTitle = document.getElementById('sectionTitle');
    if (sectionTitle) {
      sectionTitle.textContent = {
        all: 'All Content', movies: '🎥 Movies', series: '📺 TV Series',
        trending: '🔥 Trending', topRated: '⭐ Top Rated'
      }[currentTab] || 'All Content';
    }
    
    renderPage();
  }
  
  function renderPage() {
    const perPage = 48;
    const total = Math.ceil(filteredContent.length / perPage);
    if (currentPage > total) currentPage = 1;
    
    const items = filteredContent.slice((currentPage - 1) * perPage, currentPage * perPage);
    const grid = document.getElementById('moviesGrid');
    const pagination = document.getElementById('pagination');
    
    if (grid) {
      grid.innerHTML = items.length ? items.map(m => `
        <div class="movie-card" onclick="MVC.openWatch('${m.imdb}')">
          <div class="poster-wrap">
            <img src="${m.poster}" loading="lazy" onerror="this.parentElement.innerHTML='<div style=height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:var(--gold);font-size:2rem;>🎬</div>'">
            <span class="quality-badge">${m.quality || 'HD'}</span>
            ${m.type === 'series' ? '<span class="type-badge">📺</span>' : ''}
            <div class="poster-overlay"><div class="play-circle">▶</div></div>
          </div>
          <div class="card-info">
            <div class="card-title">${escH(m.title)}</div>
            <div class="card-meta">
              <span class="card-rating">⭐ ${m.rating || '?'}</span>
              <span>${m.release || ''}</span>
            </div>
          </div>
        </div>
      `).join('') : '<div class="empty-state" style="grid-column:1/-1;text-align:center;padding:3rem;"><p>Nothing found</p></div>';
    }
    
    if (pagination) {
      pagination.innerHTML = total > 1 ? Array.from({ length: total }, (_, i) => `
        <button class="page-btn${i + 1 === currentPage ? ' active' : ''}" onclick="MVC.goToPage(${i + 1})">${i + 1}</button>
      `).join('') : '';
    }
  }
  
  function goToPage(p) {
    currentPage = p;
    renderPage();
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
  
  // SEARCH
  function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchDropdown = document.getElementById('searchDropdown');
    const dropdownContent = document.getElementById('dropdownContent');
    
    if (!searchInput) return;
    
    const q = searchInput.value.trim();
    if (searchClear) searchClear.style.display = q ? 'flex' : 'none';
    
    if (q.length >= 2) {
      const matches = allContent.filter(m => (m.title || '').toLowerCase().includes(q.toLowerCase())).slice(0, 7);
      if (dropdownContent) {
        dropdownContent.innerHTML = matches.length ? matches.map(m => `
          <div class="dropdown-item" onmousedown="MVC.openWatch('${m.imdb}')">
            <img src="${m.poster}" onerror="this.style.display='none'" alt="">
            <div class="dropdown-info">
              <div class="dropdown-title">${escH(m.title)}</div>
              <div class="dropdown-meta">${m.release || ''} • ${(m.genre || [])[0] || ''}</div>
            </div>
            <span class="dropdown-type ${m.type}">${m.type.toUpperCase()}</span>
          </div>
        `).join('') : '<div style="padding:1.5rem;text-align:center;color:var(--gray);">Nothing found</div>';
      }
      if (searchDropdown) searchDropdown.classList.add('active');
    } else {
      if (searchDropdown) searchDropdown.classList.remove('active');
    }
  }
  
  function showDropdown() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim().length >= 2) {
      const searchDropdown = document.getElementById('searchDropdown');
      if (searchDropdown) searchDropdown.classList.add('active');
    }
  }
  
  function hideDropdown() {
    setTimeout(() => {
      const searchDropdown = document.getElementById('searchDropdown');
      if (searchDropdown) searchDropdown.classList.remove('active');
    }, 150);
  }
  
  function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const searchDropdown = document.getElementById('searchDropdown');
    
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    if (searchDropdown) searchDropdown.classList.remove('active');
  }
  
  // REQUEST FORM
  function openRequestForm() {
    const modal = document.getElementById('requestFormModal');
    if (modal) modal.classList.add('active');
    
    const searchInput = document.getElementById('searchInput');
    const titleInput = document.querySelector('#requestForm input[name="title"]');
    if (titleInput && searchInput) {
      const q = searchInput.value.trim();
      if (q) titleInput.value = q;
    }
    
    const formResult = document.getElementById('formResult');
    if (formResult) formResult.innerHTML = '';
  }
  
  function closeRequestForm() {
    const modal = document.getElementById('requestFormModal');
    if (modal) modal.classList.remove('active');
  }
  
  function checkAndShowResult(title) {
    const formResult = document.getElementById('formResult');
    if (!formResult) return;
    
    if (!title || title.length < 2) {
      formResult.innerHTML = '';
      return;
    }
    
    const q = title.toLowerCase().trim();
    const matches = allContent.filter(m => (m.title || '').toLowerCase().includes(q)).slice(0, 4);
    
    if (matches.length) {
      formResult.innerHTML = `
        <div style="background:rgba(41,229,122,0.08);border:1px solid var(--green);border-radius:8px;padding:0.8rem;margin-bottom:0.8rem;">
          <p style="color:var(--green);font-weight:700;font-size:0.8rem;">✅ Already on MVC!</p>
          ${matches.map(m => `<a onclick="MVC.closeRequestForm();MVC.openWatch('${m.imdb}')" style="display:block;color:var(--gold);cursor:pointer;font-size:0.75rem;padding:0.2rem 0;">🎬 ${escH(m.title)} (${m.release || '?'}) ⭐${m.rating || '?'}</a>`).join('')}
        </div>
        <button type="submit" class="unlock-btn" style="width:100%;">📩 Send Anyway</button>`;
    } else {
      formResult.innerHTML = `
        <div style="background:rgba(245,176,66,0.07);border:1px solid rgba(245,176,66,0.25);border-radius:8px;padding:0.8rem;margin-bottom:0.8rem;">
          <p style="color:var(--gold);font-weight:700;font-size:0.8rem;">🆕 Not on MVC yet!</p>
          <p style="color:var(--gray);font-size:0.75rem;">"${escH(title)}" will be added soon.</p>
        </div>
        <button type="submit" class="unlock-btn" style="width:100%;">📩 Send Request</button>`;
    }
  }
  
  // SCROLL TO TOP
  window.addEventListener('scroll', () => {
    const backToTop = document.getElementById('backToTop');
    if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
  });
  
  // CLEANUP
  window.addEventListener('beforeunload', () => {
    if (visibilityObserver) visibilityObserver.disconnect();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    heroVideos.forEach(video => {
      if (video) {
        video.pause();
        video.src = '';
      }
    });
  });
  
  // EXPORT PUBLIC API
  window.MVC = {
    // Navigation
    navigateHome,
    openWatch,
    
    // Hero
    heroSlide,
    heroGoTo,
    handleVideoLoad,
    handleVideoPlaying,
    handleVideoWaiting,
    checkVideoProgress,
    
    // Episodes
    switchSeason,
    playEpisode,
    
    // Player
    unlockPlayer,
    
    // Pagination
    goToPage,
    
    // Tabs & Filters
    switchTab,
    filterGenre,
    
    // Search
    handleSearch,
    showDropdown,
    hideDropdown,
    clearSearch,
    
    // Request
    openRequestForm,
    closeRequestForm,
    checkAndShowResult,
    
    // Share
    shareContent,
    
    // Settings
    toggleSettings: window.toggleSettings,
    changeFontSize: window.changeFontSize,
    changeBgColor: window.changeBgColor
  };
  
  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeRequestForm();
      clearSearch();
    }
  });
  
  
  // START
  loadData();
  
  // Auto-create global aliases for HTML onclick compatibility
  Object.keys(window.MVC).forEach(function(key) {
    if (typeof window.MVC[key] === 'function' && !window[key]) {
      window[key] = function() {
        return window.MVC[key].apply(window.MVC, arguments);
      };
    }
  });
  
})();
