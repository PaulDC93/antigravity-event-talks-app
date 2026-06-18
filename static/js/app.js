document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // STATE MANAGEMENT
    // ==========================================================================
    let releases = [];
    let selectedItem = null;
    let currentFilterType = 'all';
    let searchQuery = '';
    let isMobile = window.innerWidth <= 1024;

    // ==========================================================================
    // DOM ELEMENTS
    // ==========================================================================
    const btnRefresh = document.getElementById('btn-refresh');
    const btnExportCsv = document.getElementById('btn-export-csv');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeToggleText = btnThemeToggle.querySelector('.theme-text');
    const sunIcon = btnThemeToggle.querySelector('.sun-icon');
    const moonIcon = btnThemeToggle.querySelector('.moon-icon');
    const searchInput = document.getElementById('search-input');
    const categoryFilters = document.getElementById('category-filter-group');
    const feedCards = document.getElementById('feed-cards');
    const skeletonLoader = document.getElementById('skeleton-loader');
    const alertBanner = document.getElementById('alert-banner');
    
    // Stats elements
    const statAll = document.getElementById('stat-all');
    const statFeatures = document.getElementById('stat-features');
    const statDeprecations = document.getElementById('stat-deprecations');

    // Composer elements
    const composerActive = document.getElementById('composer-active');
    const composerPlaceholder = document.getElementById('composer-placeholder');
    const composerSelectedBadge = document.getElementById('composer-selected-badge');
    const composerSelectedDate = document.getElementById('composer-selected-date');
    const tweetTemplateSelect = document.getElementById('tweet-template');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const tweetUrlPreview = document.getElementById('tweet-url-preview');
    const previewLinkTitle = document.getElementById('preview-link-title');
    const charCounter = document.getElementById('char-counter');
    const btnTweetAction = document.getElementById('btn-tweet-action');
    const btnCancelCompose = document.getElementById('btn-cancel-compose');

    // Mobile layout elements
    const btnMobileComposerTrigger = document.getElementById('btn-mobile-composer-trigger');
    const mobileComposerModal = document.getElementById('mobile-composer-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const composerMobileBadgeDot = document.getElementById('composer-mobile-badge-dot');

    // ==========================================================================
    // EVENT LISTENERS
    // ==========================================================================
    btnRefresh.addEventListener('click', () => fetchReleases(true));
    btnExportCsv.addEventListener('click', exportToCSV);
    
    // Theme toggle click handler
    btnThemeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        updateThemeUI(isLight);
    });

    function updateThemeUI(isLight) {
        if (isLight) {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
            themeToggleText.textContent = 'Dark Mode';
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
            themeToggleText.textContent = 'Light Mode';
        }
    }

    // Restore saved theme on initial load
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        updateThemeUI(true);
    }
    
    // Search input (with brief input bounce protection)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderFeed();
        }, 150);
    });

    // Category pills selection
    categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Toggle active visual state
        categoryFilters.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');

        currentFilterType = pill.dataset.type;
        renderFeed();
    });

    // Composer text area inputs
    tweetTextarea.addEventListener('input', () => {
        updateCharCounter();
    });

    // Template selection changes
    tweetTemplateSelect.addEventListener('change', (e) => {
        if (!selectedItem) return;
        
        if (e.target.value === 'custom') {
            tweetTextarea.value = '';
            tweetTextarea.focus();
        } else {
            tweetTextarea.value = generateTweetText(selectedItem, e.target.value);
        }
        updateCharCounter();
    });

    // Tweet action trigger
    btnTweetAction.addEventListener('click', () => {
        const text = tweetTextarea.value.trim();
        if (!text) return;
        
        // Open Twitter intent composer in new window
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterUrl, '_blank');
    });

    // Cancel compose reset
    btnCancelCompose.addEventListener('click', resetComposerState);

    // Mobile modal interactions
    btnMobileComposerTrigger.addEventListener('click', () => toggleMobileModal(true));
    btnCloseModal.addEventListener('click', () => toggleMobileModal(false));
    
    // Close modal if user clicks outside content panel
    mobileComposerModal.addEventListener('click', (e) => {
        if (e.target === mobileComposerModal) {
            toggleMobileModal(false);
        }
    });

    // Listen to resize to correctly re-dock the composer card if viewport moves past threshold
    window.addEventListener('resize', () => {
        const wasMobile = isMobile;
        isMobile = window.innerWidth <= 1024;
        
        if (wasMobile && !isMobile) {
            // Screen enlarged: make sure composer returns to sticky sidebar if it was in the modal
            toggleMobileModal(false);
        }
    });

    // ==========================================================================
    // INITIAL LOAD
    // ==========================================================================
    fetchReleases();

    // ==========================================================================
    // AJAX CORE OPERATIONS
    // ==========================================================================
    function fetchReleases(forceRefresh = false) {
        // Toggle loading layouts
        skeletonLoader.classList.remove('hidden');
        feedCards.classList.add('hidden');
        alertBanner.classList.add('hidden');
        
        // Set refresh button spinner active
        const spinner = btnRefresh.querySelector('.spinner-icon');
        spinner.classList.add('spinning');
        btnRefresh.disabled = true;

        const endpoint = forceRefresh ? '/api/refresh' : '/api/releases';

        fetch(endpoint)
            .then(res => {
                if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
                return res.json();
            })
            .then(data => {
                releases = data;
                
                // Update header statistics counts
                updateStatistics();
                
                // Render feeds
                renderFeed();
                
                if (forceRefresh) {
                    showBanner("Feed successfully updated from BigQuery feed source.", "success");
                }
            })
            .catch(err => {
                console.error("Fetch release notes failed:", err);
                showBanner("Could not sync with Google Cloud release feed. Serving cached data or check connection.", "error");
                
                // If releases is empty, render clean failure
                if (releases.length === 0) {
                    feedCards.innerHTML = `
                        <div class="alert-container error">
                            <span>Failed to fetch release notes from API. Verify backend server is running.</span>
                        </div>`;
                    feedCards.classList.remove('hidden');
                }
            })
            .finally(() => {
                skeletonLoader.classList.add('hidden');
                spinner.classList.remove('spinning');
                btnRefresh.disabled = false;
            });
    }

    // ==========================================================================
    // STATISTICS CALCULATION
    // ==========================================================================
    function updateStatistics() {
        statAll.textContent = releases.length;
        
        const featuresCount = releases.filter(item => item.type.toLowerCase() === 'feature').length;
        statFeatures.textContent = featuresCount;
        
        const deprecationsCount = releases.filter(item => item.type.toLowerCase() === 'deprecation').length;
        statDeprecations.textContent = deprecationsCount;
    }

    // ==========================================================================
    // RENDER TIMELINE FEED
    // ==========================================================================
    function renderFeed() {
        feedCards.innerHTML = '';
        feedCards.classList.remove('hidden');

        // Apply filters
        const filtered = releases.filter(item => {
            // Category check
            const typeMatch = currentFilterType === 'all' || 
                item.type.toLowerCase() === currentFilterType;
            
            // Keyword check (summary, type, or date)
            const queryMatch = !searchQuery || 
                item.content.toLowerCase().includes(searchQuery) ||
                item.type.toLowerCase().includes(searchQuery) ||
                item.date.toLowerCase().includes(searchQuery);
                
            return typeMatch && queryMatch;
        });

        if (filtered.length === 0) {
            feedCards.innerHTML = `
                <div class="composer-placeholder-state">
                    <h3>No Release Notes Found</h3>
                    <p>Try resetting filters or adjusting search queries to see matches.</p>
                </div>`;
            return;
        }

        // Generate and append cards
        filtered.forEach(item => {
            const card = document.createElement('article');
            card.className = 'release-card';
            if (selectedItem && selectedItem.id === item.id) {
                card.classList.add('selected-for-tweet');
            }
            card.dataset.id = item.id;

            // Normalize type class for badges
            const typeClass = item.type.toLowerCase().replace(/\s+/g, '-');
            
            // Compose inner HTML
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta-left">
                        <span class="type-badge ${typeClass}">${item.type}</span>
                        <span class="release-date">${item.date}</span>
                    </div>
                    <div class="card-actions-right">
                        <a href="${item.link}" target="_blank" rel="noopener" class="btn-card-link" title="Open Official Release Documentation">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/>
                            </svg>
                        </a>
                    </div>
                </div>
                <div class="card-content">
                    ${item.content}
                </div>
                <div class="card-footer" style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-card-tweet btn-select-tweet" id="btn-select-${item.id}">
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 2px;">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet Update</span>
                    </button>
                    <button class="btn btn-card-copy btn-copy-card" id="btn-copy-${item.id}">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy Text</span>
                    </button>
                </div>
            `;

            // Bind click handler for selection
            card.querySelector('.btn-select-tweet').addEventListener('click', (e) => {
                e.stopPropagation();
                selectItemForTweet(item);
            });

            // Bind click handler for copy clipboard
            card.querySelector('.btn-copy-card').addEventListener('click', (e) => {
                e.stopPropagation();
                
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = item.content;
                const cleanContent = tempDiv.textContent || tempDiv.innerText || '';
                const cleanText = cleanContent.trim().replace(/\s+/g, ' ');
                const clipboardText = `BigQuery Release Update [${item.type}] - ${item.date}\n\n${cleanText}\n\nReference: ${item.link}`;
                
                navigator.clipboard.writeText(clipboardText).then(() => {
                    const copyBtn = card.querySelector('.btn-copy-card');
                    const copyBtnSpan = copyBtn.querySelector('span');
                    const origText = copyBtnSpan.textContent;
                    
                    copyBtn.classList.add('copied');
                    copyBtnSpan.textContent = 'Copied!';
                    
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtnSpan.textContent = origText;
                    }, 2000);
                }).catch(err => {
                    console.error('Clipboard copy failed: ', err);
                });
            });

            feedCards.appendChild(card);
        });
    }

    // ==========================================================================
    // BANNER CONTROLLER
    // ==========================================================================
    function showBanner(message, type) {
        alertBanner.textContent = message;
        alertBanner.className = `alert-container ${type}`;
        alertBanner.classList.remove('hidden');
        
        // Auto fade out if success
        if (type === 'success') {
            setTimeout(() => {
                alertBanner.classList.add('hidden');
            }, 6000);
        }
    }

    // ==========================================================================
    // CSV EXPORT CONTROLLER
    // ==========================================================================
    function exportToCSV() {
        const filtered = releases.filter(item => {
            const typeMatch = currentFilterType === 'all' || 
                item.type.toLowerCase() === currentFilterType;
            const queryMatch = !searchQuery || 
                item.content.toLowerCase().includes(searchQuery) ||
                item.type.toLowerCase().includes(searchQuery) ||
                item.date.toLowerCase().includes(searchQuery);
            return typeMatch && queryMatch;
        });

        if (filtered.length === 0) {
            showBanner("No release notes available to export.", "error");
            return;
        }

        let csvContent = "ID,Date,Type,Reference Link,Summary\n";

        filtered.forEach(item => {
            const escapeCSV = (text) => {
                if (text === null || text === undefined) return "";
                let stringified = String(text);
                if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n") || stringified.includes("\r")) {
                    return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
            };

            const row = [
                escapeCSV(item.id),
                escapeCSV(item.date),
                escapeCSV(item.type),
                escapeCSV(item.link),
                escapeCSV(item.summary)
            ].join(",");

            csvContent += row + "\n";
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${currentFilterType}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showBanner(`Successfully exported ${filtered.length} notes to CSV.`, "success");
    }

    // ==========================================================================
    // COMPOSER ACTION CONTROL
    // ==========================================================================
    function selectItemForTweet(item) {
        selectedItem = item;
        
        // Remove previous selected styling, add to current
        document.querySelectorAll('.release-card').forEach(card => {
            card.classList.remove('selected-for-tweet');
        });
        const activeCard = document.querySelector(`.release-card[data-id="${item.id}"]`);
        if (activeCard) {
            activeCard.classList.add('selected-for-tweet');
        }

        // Set metadata on Composer
        composerSelectedBadge.textContent = item.type;
        composerSelectedBadge.className = `selected-badge type-badge ${item.type.toLowerCase().replace(/\s+/g, '-')}`;
        composerSelectedDate.textContent = item.date;
        previewLinkTitle.textContent = `${item.type} | BigQuery Release - ${item.date}`;
        
        // Set template and fill text area
        const selectedTemplate = tweetTemplateSelect.value;
        if (selectedTemplate === 'custom') {
            tweetTextarea.value = '';
            tweetTextarea.focus();
        } else {
            tweetTextarea.value = generateTweetText(item, selectedTemplate);
        }

        // Reveal Active Composer
        composerPlaceholder.classList.add('hidden');
        composerActive.classList.remove('hidden');
        
        // Sync character budget counter
        updateCharCounter();

        // Handle viewport-specific UI actions
        if (isMobile) {
            // Show dot notification on mobile composer trigger button
            composerMobileBadgeDot.classList.add('active');
            // Auto open the mobile modal compose screen
            toggleMobileModal(true);
        } else {
            // Scroll smoothly to composer on desktop if out of view
            const composerCardNode = document.querySelector('.composer-card');
            composerCardNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    function resetComposerState() {
        selectedItem = null;
        
        // Clear card selected borders
        document.querySelectorAll('.release-card').forEach(card => {
            card.classList.remove('selected-for-tweet');
        });

        // Toggle layout visibility
        composerActive.classList.add('hidden');
        composerPlaceholder.classList.remove('hidden');
        
        // Mobile cleanups
        composerMobileBadgeDot.classList.remove('active');
        toggleMobileModal(false);
    }

    function updateCharCounter() {
        const text = tweetTextarea.value;
        const charCount = text.length;
        
        charCounter.textContent = `${charCount} / 280`;

        // Style based on count thresholds
        if (charCount > 280) {
            charCounter.className = 'char-counter danger';
            btnTweetAction.disabled = true;
        } else if (charCount > 250) {
            charCounter.className = 'char-counter warning';
            btnTweetAction.disabled = false;
        } else {
            charCounter.className = 'char-counter';
            btnTweetAction.disabled = false;
        }
    }

    // ==========================================================================
    // TWEET TEMPLATING ENGINE
    // ==========================================================================
    function generateTweetText(item, templateType) {
        const type = item.type;
        const date = item.date;
        const link = item.link;
        
        // Strip out HTML tags for tweet body safely
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = item.content;
        const cleanContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // Format title + content nicely
        let cleanText = cleanContent.trim().replace(/\s+/g, ' ');
        
        if (templateType === 'excited') {
            // Template: BigQuery Update 🚀 [Type]: Content... Details: link #BigQuery #GoogleCloud
            const prefix = `BigQuery Update 🚀 [${type}]: `;
            const suffix = `\n\nDetails here: ${link}\n#BigQuery #GoogleCloud`;
            const allowedLen = 280 - (prefix.length + suffix.length);
            
            if (cleanText.length > allowedLen) {
                cleanText = cleanText.substring(0, allowedLen - 3) + '...';
            }
            return `${prefix}${cleanText}${suffix}`;
            
        } else if (templateType === 'professional') {
            // Template: Google Cloud BigQuery Release [Type] (Date): Content... Link
            const prefix = `Google Cloud BigQuery Release | ${type} (${date}):\n\n`;
            const suffix = `\n\nReference: ${link}`;
            const allowedLen = 280 - (prefix.length + suffix.length);
            
            if (cleanText.length > allowedLen) {
                cleanText = cleanText.substring(0, allowedLen - 3) + '...';
            }
            return `${prefix}${cleanText}${suffix}`;
            
        } else if (templateType === 'short') {
            // Template: BQ [Type]: Content... [Link]
            const prefix = `BQ [${type}]: `;
            const suffix = ` ${link}`;
            const allowedLen = 280 - (prefix.length + suffix.length);
            
            if (cleanText.length > allowedLen) {
                cleanText = cleanText.substring(0, allowedLen - 3) + '...';
            }
            return `${prefix}${cleanText}${suffix}`;
        }
        
        return '';
    }

    // ==========================================================================
    // MOBILE MODAL DETACH & ATTACH (DOCKING CONTROLLER)
    // ==========================================================================
    function toggleMobileModal(show) {
        const placeholderTarget = document.getElementById('modal-composer-placeholder-target');
        const stickySidebar = document.getElementById('composer-sticky-sidebar');
        const composerCard = document.querySelector('.composer-card');
        
        if (show) {
            // Attach card elements inside modal container
            placeholderTarget.appendChild(composerCard);
            mobileComposerModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden'; // Lock main body scrolling
            
            // Focus textarea if editable is open
            if (selectedItem) {
                tweetTextarea.focus();
            }
        } else {
            // De-dock back to sticky sidebar
            stickySidebar.appendChild(composerCard);
            mobileComposerModal.classList.add('hidden');
            document.body.style.overflow = ''; // Release scroll locking
        }
    }
});
