
(function() {
    var scriptUrl = 'https://cdn.jsdelivr.net/gh/MekoMedia/damp@main/lib/err/ChunkJSDeliver2.1.js';
    var maxRetries = 3;
    var retryCount = 0;
    var scriptLoaded = false;
    
    // Check if already loaded
    if (document.querySelector('script[src="' + scriptUrl + '"]')) {
        console.log('✅ ChunkJSDeliver2 already loaded');
        scriptLoaded = true;
        return;
    }
    
    function loadScript() {
        var script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.crossOrigin = 'anonymous';
        
        var timeout = setTimeout(function() {
            if (!scriptLoaded) {
                console.warn('⏰ Script load timeout, retry ' + (retryCount + 1) + '/' + maxRetries);
                script.onload = null;
                script.onerror = null;
                retryLoad();
            }
        }, 8000);
        
        script.onload = function() {
            clearTimeout(timeout);
            scriptLoaded = true;
            console.log('✅ ChunkJSDeliver2 loaded successfully');
        };
        
        script.onerror = function() {
            clearTimeout(timeout);
            if (!scriptLoaded) {
                console.warn('❌ Script load error, retry ' + (retryCount + 1) + '/' + maxRetries);
                retryLoad();
            }
        };
        
        document.head.appendChild(script);
    }
    
    function retryLoad() {
        retryCount++;
        if (retryCount < maxRetries) {
            setTimeout(loadScript, 2000 * retryCount);
        } else {
            showShutdownPage();
        }
    }
    
    function showShutdownPage() {
        var shutdownPage = document.getElementById('shutdownPage');
        if (shutdownPage) {
            shutdownPage.style.display = 'flex';
            var homePage = document.getElementById('homePage');
            if (homePage) homePage.style.display = 'none';
            var watchPage = document.getElementById('watchPage');
            if (watchPage) watchPage.classList.remove('active');
            var bottomNav = document.getElementById('bottomNav');
            if (bottomNav) bottomNav.classList.add('hidden');
        } else {
            // Create shutdown page if it doesn't exist
            var div = document.createElement('div');
            div.id = 'shutdownPage';
            div.className = 'server-block-page';
            div.style.display = 'flex';
            div.innerHTML = `
                <div class="block-icon">🔌</div>
                <div class="block-title">Unable Connection</div>
                <div class="block-code">Code 0</div>
                <div class="block-msg">Failed to load required resources. Please check your connection and try again.</div>
                <button class="block-btn" onclick="location.reload()">🔄 Retry</button>
                <div class="block-link" onclick="window.open('https://discord.gg/pawnets','_blank')">💬 Check Our Community for News</div>
            `;
            document.body.prepend(div);
            
            var homePage = document.getElementById('homePage');
            if (homePage) homePage.style.display = 'none';
            var watchPage = document.getElementById('watchPage');
            if (watchPage) watchPage.classList.remove('active');
            var bottomNav = document.getElementById('bottomNav');
            if (bottomNav) bottomNav.classList.add('hidden');
        }
    }
    
    // Start loading
    loadScript();
    
    // Handle online/offline
    window.addEventListener('online', function() {
        if (!scriptLoaded) {
            console.log('🔄 Network restored, retrying script load...');
            retryCount = 0;
            loadScript();
        }
    });
})();
