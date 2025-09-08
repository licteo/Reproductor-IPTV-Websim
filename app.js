import Hls from 'hls.js';

class IPTVPlayer {
    constructor() {
        this.channels = JSON.parse(localStorage.getItem('iptvChannels') || '[]');
        this.currentChannel = null;
        this.hls = null;
        this.favorites = JSON.parse(localStorage.getItem('iptvFavorites') || '[]');
        
        this.initializeElements();
        this.setupEventListeners();
        this.registerServiceWorker();
        
        // Si hay canales guardados, renderizarlos inmediatamente
        if (this.channels.length > 0) {
            this.renderChannelList();
            this.detectLanguagesAndCategories();
        }
    }
    
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registrado:', registration);
                })
                .catch(error => {
                    console.log('Error al registrar ServiceWorker:', error);
                });
        }
    }
    
    initializeElements() {
        this.video = document.getElementById('videoPlayer');
        this.channelUrl = document.getElementById('channelUrl');
        this.loadChannelBtn = document.getElementById('loadChannel');
        this.m3uFile = document.getElementById('m3uFile');
        this.loadListBtn = document.getElementById('loadList');
        this.channelList = document.getElementById('channelList');
        this.loading = document.getElementById('loading');
        this.searchInput = document.getElementById('searchInput');
    }
    
    setupEventListeners() {
        this.loadChannelBtn.addEventListener('click', () => this.loadChannelFromUrl());
        this.loadListBtn.addEventListener('click', () => this.m3uFile.click());
        this.m3uFile.addEventListener('change', (e) => this.loadM3UFile(e.target.files[0]));
        this.searchInput.addEventListener('input', () => this.filterChannels());
        
        // Agregar botón para limpiar lista
        document.getElementById('clearList')?.addEventListener('click', () => this.clearChannelList());
    }
    
    filterChannels() {
        const searchTerm = this.searchInput.value.toLowerCase();
        const showOnlyFavorites = document.getElementById('favoritesToggle')?.checked;
        const channelItems = this.channelList.querySelectorAll('.channel-item');
        
        channelItems.forEach((item, index) => {
            const channelName = this.channels[index].name.toLowerCase();
            const isFavorite = this.isFavorite(index);
            
            let shouldShow = channelName.includes(searchTerm);
            if (showOnlyFavorites) {
                shouldShow = shouldShow && isFavorite;
            }
            
            if (shouldShow) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }
    
    toggleFavorite(index) {
        const channelId = this.channels[index].name;
        const favoriteIndex = this.favorites.indexOf(channelId);
        
        if (favoriteIndex > -1) {
            this.favorites.splice(favoriteIndex, 1);
        } else {
            this.favorites.push(channelId);
        }
        
        localStorage.setItem('iptvFavorites', JSON.stringify(this.favorites));
        this.renderChannelList();
    }
    
    isFavorite(index) {
        return this.favorites.includes(this.channels[index].name);
    }
    
    loadChannelFromUrl() {
        const url = this.channelUrl.value.trim();
        if (!url) return;
        
        this.playStream(url);
        this.channelUrl.value = '';
    }
    
    async loadM3UFile(file) {
        if (!file) return;
        
        const content = await file.text();
        this.parseM3U(content);
    }
    
    parseM3U(content) {
        const lines = content.split('\n');
        const channels = [];
        let currentChannel = {};
        
        lines.forEach(line => {
            line = line.trim();
            
            if (line.startsWith('#EXTINF:')) {
                const info = line.split(',');
                currentChannel.name = info[1] || 'Sin nombre';
                
                const tvgId = line.match(/tvg-id="([^"]*)"/);
                const group = line.match(/group-title="([^"]*)"/);
                const logo = line.match(/tvg-logo="([^"]*)"/);
                
                if (tvgId) currentChannel.id = tvgId[1];
                if (group) currentChannel.group = group[1];
                if (logo) currentChannel.logo = logo[1];
            } else if (line && !line.startsWith('#') && line.includes('://')) {
                currentChannel.url = line;
                channels.push(currentChannel);
                currentChannel = {};
            }
        });
        
        this.channels = channels;
        // Guardar canales en localStorage
        localStorage.setItem('iptvChannels', JSON.stringify(channels));
        this.renderChannelList();
        this.detectLanguagesAndCategories();
    }
    
    detectLanguagesAndCategories() {
        // Detectar categorías basadas en group-title
        const categories = [...new Set(this.channels.map(ch => ch.group).filter(Boolean))];
        
        // Detectar idiomas basados en patrones en el nombre del canal
        const languagePatterns = {
            'ES': /\b(español|spanish|castellano|latino|ES)\b/i,
            'EN': /\b(english|ingles|EN)\b/i,
            'FR': /\b(français|french|FR)\b/i,
            'DE': /\b(deutsch|german|DE)\b/i,
            'PT': /\b(português|portuguese|PT)\b/i,
            'IT': /\b(italiano|italian|IT)\b/i
        };
        
        this.channels.forEach(channel => {
            channel.detectedLanguage = 'Unknown';
            for (const [lang, pattern] of Object.entries(languagePatterns)) {
                if (pattern.test(channel.name)) {
                    channel.detectedLanguage = lang;
                    break;
                }
            }
        });
        
        const languages = [...new Set(this.channels.map(ch => ch.detectedLanguage))];
        
        this.renderFilters(categories, languages);
    }
    
    renderFilters(categories, languages) {
        const existingFilters = document.querySelector('.filters-container');
        if (existingFilters) existingFilters.remove();
        
        const filtersContainer = document.createElement('div');
        filtersContainer.className = 'filters-container';
        
        // Categorías
        if (categories.length > 0) {
            const categorySelect = document.createElement('select');
            categorySelect.id = 'categoryFilter';
            categorySelect.innerHTML = '<option value="">Todas las categorías</option>' +
                categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
            
            const categoryLabel = document.createElement('label');
            categoryLabel.textContent = 'Categoría: ';
            categoryLabel.appendChild(categorySelect);
            filtersContainer.appendChild(categoryLabel);
        }
        
        // Idiomas
        if (languages.length > 1) {
            const languageSelect = document.createElement('select');
            languageSelect.id = 'languageFilter';
            languageSelect.innerHTML = '<option value="">Todos los idiomas</option>' +
                languages.map(lang => `<option value="${lang}">${lang}</option>`).join('');
            
            const languageLabel = document.createElement('label');
            languageLabel.textContent = 'Idioma: ';
            languageLabel.appendChild(languageSelect);
            filtersContainer.appendChild(languageLabel);
        }
        
        // Limpiar filtros
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Limpiar filtros';
        clearBtn.className = 'btn-secondary';
        clearBtn.onclick = () => this.clearFilters();
        filtersContainer.appendChild(clearBtn);
        
        document.querySelector('.input-section').parentNode.insertBefore(
            filtersContainer,
            document.querySelector('.channel-list')
        );
        
        // Event listeners
        document.getElementById('categoryFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('languageFilter')?.addEventListener('change', () => this.applyFilters());
    }
    
    applyFilters() {
        const categoryFilter = document.getElementById('categoryFilter')?.value;
        const languageFilter = document.getElementById('languageFilter')?.value;
        const searchTerm = this.searchInput.value.toLowerCase();
        const showOnlyFavorites = document.getElementById('favoritesToggle')?.checked;
        
        const channelItems = this.channelList.querySelectorAll('.channel-item');
        
        channelItems.forEach((item, index) => {
            const channel = this.channels[index];
            const channelName = channel.name.toLowerCase();
            const isFavorite = this.isFavorite(index);
            
            let shouldShow = channelName.includes(searchTerm);
            if (showOnlyFavorites) {
                shouldShow = shouldShow && isFavorite;
            }
            if (categoryFilter) {
                shouldShow = shouldShow && channel.group === categoryFilter;
            }
            if (languageFilter) {
                shouldShow = shouldShow && channel.detectedLanguage === languageFilter;
            }
            
            if (shouldShow) {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }
    
    clearFilters() {
        document.getElementById('categoryFilter') && (document.getElementById('categoryFilter').value = '');
        document.getElementById('languageFilter') && (document.getElementById('languageFilter').value = '');
        this.searchInput.value = '';
        document.getElementById('favoritesToggle') && (document.getElementById('favoritesToggle').checked = false);
        this.applyFilters();
    }
    
    clearChannelList() {
        if (confirm('¿Estás seguro de que quieres limpiar la lista de canales?')) {
            this.channels = [];
            localStorage.removeItem('iptvChannels');
            this.renderChannelList();
            
            // Limpiar filtros
            const existingFilters = document.querySelector('.filters-container');
            if (existingFilters) existingFilters.remove();
        }
    }
    
    renderChannelList() {
        if (this.channels.length === 0) {
            this.channelList.innerHTML = '<p class="empty-message">No hay canales cargados</p>';
            return;
        }
        
        this.channelList.innerHTML = this.channels.map((channel, index) => `
            <div class="channel-item" data-index="${index}">
                <div class="channel-info">
                    <span class="channel-name">${channel.name}</span>
                    <span class="channel-number">${index + 1}</span>
                </div>
                <button class="favorite-btn ${this.isFavorite(index) ? 'active' : ''}" data-index="${index}">
                    ${this.isFavorite(index) ? '★' : '☆'}
                </button>
            </div>
        `).join('');
        
        // Agregar event listeners a los canales
        this.channelList.querySelectorAll('.channel-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('favorite-btn')) {
                    const index = parseInt(item.dataset.index);
                    this.selectChannel(index);
                }
            });
        });
        
        // Agregar event listeners a los botones de favoritos
        this.channelList.querySelectorAll('.favorite-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.toggleFavorite(index);
            });
        });
    }
    
    selectChannel(index) {
        // Remover clase active de todos los canales
        this.channelList.querySelectorAll('.channel-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Agregar clase active al canal seleccionado
        this.channelList.children[index].classList.add('active');
        
        // Reproducir el canal
        this.playChannel(index);
    }
    
    playChannel(index) {
        const channel = this.channels[index];
        if (channel && channel.url) {
            this.playStream(channel.url);
        }
    }
    
    playStream(url) {
        this.showLoading(true);
        
        // Detener cualquier reproducción actual
        this.video.pause();
        this.video.removeAttribute('src');
        if (this.hls) {
            this.hls.destroy();
            this.hls = null;
        }
        this.video.load();
        
        if (Hls.isSupported()) {
            this.hls = new Hls({
                // Configuración optimizada para móvil
                maxBufferLength: 30,
                maxBufferSize: 60 * 1000 * 1000,
                maxBufferHole: 0.5,
                maxSeekHole: 2,
                liveSyncDurationCount: 3,
                liveMaxLatencyDurationCount: 7,
                maxLiveSyncPlaybackRate: 1.5,
                // Mejorar estabilidad en móvil
                fragLoadingTimeOut: 20000,
                fragLoadingMaxRetry: 6,
                fragLoadingRetryDelay: 1000,
                fragLoadingMaxRetryTimeout: 64000,
                levelLoadingTimeOut: 10000,
                levelLoadingMaxRetry: 4,
                levelLoadingRetryDelay: 1000,
                levelLoadingMaxRetryTimeout: 32000
            });
            
            this.hls.loadSource(url);
            this.hls.attachMedia(this.video);
            
            this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                // Reproducir con interacción de usuario para evitar políticas de navegador
                const playPromise = this.video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.warn('Reproducción bloqueada por políticas del navegador:', error);
                        // Mostrar botón de play manual si es necesario
                        this.showPlayButton();
                    });
                }
                this.showLoading(false);
            });
            
            this.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS error:', data);
                // Solo mostrar error si es fatal y no es un error de red que se puede recuperar
                if (data.fatal) {
                    if (data.type === 'networkError' && data.details === 'manifestLoadError') {
                        // No mostrar error al usuario si es un error temporal de carga del manifest
                        console.log('Error temporal de red, el stream puede cargarse correctamente');
                        return;
                    }
                    this.showLoading(false);
                    alert('Error al cargar el stream');
                }
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = url;
            this.video.addEventListener('loadedmetadata', () => {
                this.video.play().catch(e => {
                    console.warn('Error al reproducir:', e);
                });
                this.showLoading(false);
            });
            
            // Manejar errores de video nativo
            this.video.addEventListener('error', () => {
                console.error('Video error:', this.video.error);
                this.showLoading(false);
            });
        } else {
            alert('Tu navegador no soporta la reproducción de streams HLS');
            this.showLoading(false);
        }
    }
    
    showLoading(show) {
        if (show) {
            this.loading.classList.add('show');
        } else {
            this.loading.classList.remove('show');
        }
    }
    
    showPlayButton() {
        // Implementar lógica para mostrar botón de play manual si es necesario
    }
}

// Inicializar el reproductor cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new IPTVPlayer();
});