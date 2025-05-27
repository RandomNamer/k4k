// Manga Reader - Full-screen optimized with floating controls
(function() {
    'use strict';
    
    // Global state
    var state = {
        bookId: '',
        currentPage: 1,
        totalPages: 1,
        pages: [],
        book: {},
        isLoading: false,
        toolbarVisible: true
    };
    
    // DOM elements
    var elements = {
        currentPageImg: null,
        nextPageImg: null,
        pageInfo: null,
        currentPageSpan: null,
        totalPagesSpan: null,
        toolbar: null,
        loading: null,
        pageContainer: null,
        touchZoneLeft: null,
        touchZoneRight: null,
        touchZoneCenter: null,
        btnBack: null,
        btnMenu: null,
        readerMain: null
    };
    
    // Initialize the reader
    function init() {
        // Get data from server-rendered page
        if (window.READER_DATA) {
            state.bookId = window.READER_DATA.bookId;
            state.currentPage = window.READER_DATA.currentPage;
            state.totalPages = window.READER_DATA.totalPages;
            state.pages = window.READER_DATA.pages;
            state.book = window.READER_DATA.book;
        }
        
        // Get existing DOM elements
        elements.currentPageImg = document.getElementById('current-page-img');
        elements.nextPageImg = document.getElementById('next-page-img');
        elements.currentPageSpan = document.getElementById('current-page');
        elements.totalPagesSpan = document.getElementById('total-pages');
        elements.toolbar = document.getElementById('toolbar');
        elements.loading = document.getElementById('loading');
        elements.pageContainer = document.getElementById('page-container');
        elements.touchZoneLeft = document.getElementById('touch-left');
        elements.touchZoneRight = document.getElementById('touch-right');
        elements.btnMenu = document.getElementById('menu-btn');
        elements.readerMain = document.getElementById('reader-main');
        
        // Convert existing controls to floating style
        convertToFloatingControls();
        
        // Create center touch zone
        createCenterTouchZone();
        
        // Set up event listeners
        setupEventListeners();
        
        // Optimize image for full screen
        optimizeImageDisplay();
        
        // Start preloading next page
        preloadNextPage();
        
        // Hide toolbar initially for full-screen experience
        hideToolbar();
        
        console.log('Full-screen manga reader initialized');
    }
    
    function convertToFloatingControls() {
        // Find existing back button and convert to floating
        var existingBackBtn = document.querySelector('.btn-back');
        if (existingBackBtn) {
            existingBackBtn.innerHTML = '←';
            existingBackBtn.title = 'Back to series';
            elements.btnBack = existingBackBtn;
        }
        
        // Convert menu button to floating
        if (elements.btnMenu) {
            elements.btnMenu.innerHTML = '⋯';
            elements.btnMenu.title = 'Toggle controls';
        }
    }
    
    function createCenterTouchZone() {
        // Create center touch zone for toggling toolbar
        elements.touchZoneCenter = document.createElement('div');
        elements.touchZoneCenter.className = 'touch-zone-center';
        elements.touchZoneCenter.addEventListener('click', function() {
            toggleToolbar();
        });
        
        // Add to reader main
        if (elements.readerMain) {
            elements.readerMain.appendChild(elements.touchZoneCenter);
        }
    }
    
    function setupEventListeners() {
        // Touch zones for navigation
        if (elements.touchZoneLeft) {
            elements.touchZoneLeft.addEventListener('click', function() {
                goToPreviousPage();
            });
        }
        
        if (elements.touchZoneRight) {
            elements.touchZoneRight.addEventListener('click', function() {
                goToNextPage();
            });
        }
        
        // Menu button
        if (elements.btnMenu) {
            elements.btnMenu.addEventListener('click', function() {
                toggleToolbar();
            });
        }
        
        // Keyboard navigation
        document.addEventListener('keydown', function(e) {
            var keyCode = e.keyCode || e.which;
            switch(keyCode) {
                case 37: // Left arrow
                case 65: // A key
                    e.preventDefault();
                    goToPreviousPage();
                    break;
                case 39: // Right arrow
                case 68: // D key
                    e.preventDefault();
                    goToNextPage();
                    break;
                case 27: // Escape
                    e.preventDefault();
                    toggleToolbar();
                    break;
            }
        });
        
        // Prevent context menu on long press
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            optimizeImageDisplay();
        });
    }
    
    function optimizeImageDisplay() {
        // Make both images full screen
        if (elements.currentPageImg) {
            elements.currentPageImg.style.width = '100vw';
            elements.currentPageImg.style.height = '100vh';
            elements.currentPageImg.style.objectFit = 'contain';
            elements.currentPageImg.style.position = 'absolute';
            elements.currentPageImg.style.top = '0';
            elements.currentPageImg.style.left = '0';
        }
        
        if (elements.nextPageImg) {
            elements.nextPageImg.style.width = '100vw';
            elements.nextPageImg.style.height = '100vh';
            elements.nextPageImg.style.objectFit = 'contain';
            elements.nextPageImg.style.position = 'absolute';
            elements.nextPageImg.style.top = '0';
            elements.nextPageImg.style.left = '0';
        }
    }
    
    function showLoading() {
        if (elements.loading) {
            elements.loading.style.display = 'flex';
        }
    }
    
    function hideLoading() {
        if (elements.loading) {
            elements.loading.style.display = 'none';
        }
    }
    
    function updatePageInfo() {
        if (elements.currentPageSpan) {
            elements.currentPageSpan.textContent = state.currentPage;
        }
        if (elements.totalPagesSpan) {
            elements.totalPagesSpan.textContent = state.totalPages;
        }
    }
    
    function updateReadProgress(pageNumber) {
        // Send read progress update to Komga API
        var xhr = new XMLHttpRequest();
        xhr.open('PATCH', '/api/books/' + state.bookId + '/read-progress', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        // Fire and forget - don't wait for response
        xhr.send(JSON.stringify({
            page: pageNumber
        }));
        
        console.log('Updated read progress to page:', pageNumber);
    }
    
    function swapToNextPage() {
        if (state.currentPage >= state.totalPages || state.isLoading) {
            return;
        }
        
        var nextPageNumber = state.currentPage + 1;
        
        // Check if next page is already loaded in nextPageImg
        if (elements.nextPageImg && elements.nextPageImg.src && 
            elements.nextPageImg.src.includes('/pages/' + nextPageNumber)) {
            
            // Instantly swap the images - no loading time!
            var tempSrc = elements.currentPageImg.src;
            var tempAlt = elements.currentPageImg.alt;
            
            elements.currentPageImg.src = elements.nextPageImg.src;
            elements.currentPageImg.alt = elements.nextPageImg.alt;
            elements.currentPageImg.style.display = 'block';
            
            // Hide the next page image
            elements.nextPageImg.style.display = 'none';
            
            // Update state
            state.currentPage = nextPageNumber;
            updatePageInfo();
            updateReadProgress(nextPageNumber);
            
            // Preload the new next page
            preloadNextPage();
            
            console.log('Swapped to page:', nextPageNumber);
        } else {
            // Fallback to loading if preload failed
            loadPageDirectly(nextPageNumber);
        }
    }
    
    function swapToPreviousPage() {
        if (state.currentPage <= 1 || state.isLoading) {
            return;
        }
        
        var prevPageNumber = state.currentPage - 1;
        // For previous page, we need to load directly since we only preload next
        loadPageDirectly(prevPageNumber);
    }
    
    function loadPageDirectly(pageNumber) {
        if (pageNumber < 1 || pageNumber > state.totalPages || state.isLoading) {
            return;
        }
        
        state.isLoading = true;
        showLoading();
        
        var imageUrl = '/api/books/' + state.bookId + '/pages/' + pageNumber;
        
        // Create new image to test loading
        var img = new Image();
        img.onload = function() {
            if (elements.currentPageImg) {
                elements.currentPageImg.src = imageUrl;
                elements.currentPageImg.alt = 'Page ' + pageNumber;
                elements.currentPageImg.style.display = 'block';
                optimizeImageDisplay();
            }
            
            state.currentPage = pageNumber;
            updatePageInfo();
            hideLoading();
            state.isLoading = false;
            
            // Update read progress on Komga server
            updateReadProgress(pageNumber);
            
            // Preload next page after loading current
            preloadNextPage();
        };
        
        img.onerror = function() {
            console.error('Failed to load page:', pageNumber);
            hideLoading();
            state.isLoading = false;
        };
        
        img.src = imageUrl;
    }
    
    function preloadNextPage() {
        var nextPageNumber = state.currentPage + 1;
        
        if (nextPageNumber > state.totalPages || !elements.nextPageImg) {
            return;
        }
        
        var imageUrl = '/api/books/' + state.bookId + '/pages/' + nextPageNumber;
        
        // Load the next page into the hidden next-page-img element
        elements.nextPageImg.onload = function() {
            console.log('Preloaded page:', nextPageNumber);
        };
        
        elements.nextPageImg.onerror = function() {
            console.error('Failed to preload page:', nextPageNumber);
        };
        
        elements.nextPageImg.src = imageUrl;
        elements.nextPageImg.alt = 'Page ' + nextPageNumber;
        elements.nextPageImg.style.display = 'none'; // Keep hidden until swap
    }
    
    function goToNextPage() {
        if (state.currentPage < state.totalPages) {
            swapToNextPage();
        } else {
            // Try to load next book
            loadNextBook();
        }
    }
    
    function goToPreviousPage() {
        if (state.currentPage > 1) {
            swapToPreviousPage();
        } else {
            // Try to load previous book
            loadPreviousBook();
        }
    }
    
    function loadNextBook() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/books/' + state.bookId + '/next', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var nextBook = JSON.parse(xhr.responseText);
                    window.location.href = '/book/' + nextBook.id;
                } else {
                    console.log('No next book available');
                }
            }
        };
        xhr.send();
    }
    
    function loadPreviousBook() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/books/' + state.bookId + '/previous', true);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    var prevBook = JSON.parse(xhr.responseText);
                    window.location.href = '/book/' + prevBook.id;
                } else {
                    console.log('No previous book available');
                }
            }
        };
        xhr.send();
    }
    
    function showToolbar() {
        if (elements.toolbar) {
            elements.toolbar.classList.remove('hidden');
            state.toolbarVisible = true;
        }
    }
    
    function hideToolbar() {
        if (elements.toolbar) {
            elements.toolbar.classList.add('hidden');
            state.toolbarVisible = false;
        }
    }
    
    function toggleToolbar() {
        if (state.toolbarVisible) {
            hideToolbar();
        } else {
            showToolbar();
        }
    }
    
    // Public API
    window.MangaReader = {
        nextPage: goToNextPage,
        prevPage: goToPreviousPage,
        goToPage: loadPageDirectly,
        toggleToolbar: toggleToolbar,
        showToolbar: showToolbar,
        hideToolbar: hideToolbar,
        state: state
    };
    
    // Initialize when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 