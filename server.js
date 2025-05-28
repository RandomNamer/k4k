const path = require('path');
const express = require('express');
const fetch = require('node-fetch');
const config = require('./config');
const app = express();

const KOMGA_API = config.KOMGA_API;
const TOKEN = config.TOKEN;
const VERBOSE_LOGS = config.VERBOSE_LOGS || false;

// Unified logging function
// isDebug: true for debug level, false for info level
function log(message, isDebug = false) {
  if (isDebug && !VERBOSE_LOGS) {
    return; // Skip debug logs if verbose logging is disabled
  }
  console.log(message);
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Parse JSON bodies for API requests
app.use(express.json());

// Kindle detection middleware
function detectKindle(req, res, next) {
  const userAgent = req.get('User-Agent') || '';

  // Check for Kindle device indicators
  const isKindle = /kindle|silk/i.test(userAgent) ||
                   /mobile.*safari/i.test(userAgent) && /kindle/i.test(userAgent);

  // Also check for e-ink specific indicators
  const isEink = /e-ink|eink|kindle|kobo|nook|boox|remarkable|supernote/i.test(userAgent);

  // Add to response locals so it's available in all templates
  res.locals.isKindle = isKindle || isEink;
  res.locals.userAgent = userAgent;

  log(`Device detection: ${isKindle || isEink ? 'E-ink/Kindle' : 'Regular'} - ${userAgent}`, true);

  next();
}

app.use(detectKindle);

// Fetch JSON helper
async function fetchKomga(endpoint, options = {}) {
  const url = `${KOMGA_API}${endpoint}`;
  const headers = {
    'X-API-Key': TOKEN,
    'Accept': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Komga API Error (${endpoint}):`, error.message);
    throw error;
  }
}

// Fetch with POST for books/list endpoint
async function fetchKomgaPost(endpoint, body = {}, options = {}) {
  const url = `${KOMGA_API}${endpoint}`;
  const headers = {
    'X-API-Key': TOKEN,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      ...options
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Komga POST API Error (${endpoint}):`, error.message);
    throw error;
  }
}

// Fetch binary data (images) helper
async function fetchKomgaBinary(endpoint, options = {}) {
  const url = `${KOMGA_API}${endpoint}`;
  const headers = {
    'X-API-Key': TOKEN,
    'Accept': '*/*',
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  } catch (error) {
    console.error(`Komga Binary API Error (${endpoint}):`, error.message);
    throw error;
  }
}

// Routes

// 1. GET / → list all libraries and recently section
app.get('/', async (req, res) => {
  try {
    const libraries = await fetchKomga('/libraries');

    // Fetch series count for each library
    const librariesWithCounts = await Promise.all(
      (libraries.content || libraries).map(async (library) => {
        try {
          const seriesResponse = await fetchKomga(`/series?library_id=${library.id}&size=0`);
          return {
            ...library,
            seriesCount: seriesResponse.totalElements || seriesResponse.length || 0
          };
        } catch (error) {
          console.warn(`Failed to fetch series count for library ${library.name}:`, error.message);
          return {
            ...library,
            seriesCount: 0
          };
        }
      })
    );

    // Fetch recently data
    let keepReading = [];
    let onDeck = [];

    try {
      // Keep Reading: books with read progress, sorted by read date desc
      // Use the same format as the official web app
      const libraryIds = librariesWithCounts.map(lib => lib.id);
      const keepReadingBody = {
        condition: {
          allOf: [
            {
              anyOf: libraryIds.map(libId => ({
                libraryId: { operator: "is", value: libId }
              }))
            },
            {
              readStatus: { operator: "is", value: "IN_PROGRESS" }
            }
          ]
        }
      };

      const keepReadingResponse = await fetchKomgaPost('/books/list?size=10&sort=readProgress.readDate,desc', keepReadingBody);
      keepReading = keepReadingResponse.content || [];
    } catch (error) {
      console.warn('Failed to fetch keep reading books:', error.message);
    }

    try {
      // On Deck: first unread book of series with at least one book read
      const libraryIds = librariesWithCounts.map(lib => lib.id);
      const libraryParams = libraryIds.map(id => `library_id=${id}`).join('&');
      const onDeckResponse = await fetchKomga(`/books/ondeck?size=10&${libraryParams}`);
      onDeck = onDeckResponse.content || [];
    } catch (error) {
      console.warn('Failed to fetch on deck books:', error.message);
    }

    res.render('libraries', {
      libraries: librariesWithCounts,
      keepReading,
      onDeck
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load libraries' });
  }
});

// 2. GET /library/:libId → list series in a library
app.get('/library/:libId', async (req, res) => {
  try {
    const { libId } = req.params;
    const { sort = '' } = req.query;

    const library = await fetchKomga(`/libraries/${libId}`);
    const sortParam = sort ? `&sort=${sort}` : '';
    const series = await fetchKomga(`/series?library_id=${libId}&size=1000${sortParam}`);
    res.render('series', {
      library,
      series: series.content || series,
      libId,
      currentSort: sort
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load series' });
  }
});

// 3. GET /series/:seriesId → list books in a series
app.get('/series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const { sort = 'metadata.numberSort,asc' } = req.query;

    const series = await fetchKomga(`/series/${seriesId}`);
    const books = await fetchKomga(`/series/${seriesId}/books?size=1000&sort=${sort}`);
    res.render('books', {
      series,
      books: books.content || books,
      seriesId,
      currentSort: sort
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load books' });
  }
});

// 4. GET /book/:bookId → fetch pages list, render first page
app.get('/book/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { page } = req.query;
    const book = await fetchKomga(`/books/${bookId}`);
    const pages = await fetchKomga(`/books/${bookId}/pages`);

    // Determine starting page based on URL parameter, read progress, or default to 1
    let initialPage = 1;

    if (page && !isNaN(page)) {
      // URL parameter takes priority
      const requestedPage = parseInt(page);
      if (requestedPage >= 1 && requestedPage <= pages.length) {
        initialPage = requestedPage;
        log(`Opening book ${bookId} at requested page ${initialPage}`, true);
      } else {
        log(`Invalid page ${requestedPage} requested, using page 1`, true);
      }
    } else if (book.readProgress && book.readProgress.page) {
      // Fall back to read progress
      initialPage = book.readProgress.page;
      log(`Resuming book ${bookId} from page ${initialPage}`, true);
    } else {
      log(`Starting book ${bookId} from page 1`, true);
    }

    res.render('pages', {
      book,
      pages,
      bookId,
      initialPage: initialPage,
      totalPages: pages.length
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load book pages' });
  }
});

// Recently section routes

// Keep Reading books
app.get('/recently/keep-reading', async (req, res) => {
  try {
    // Get all libraries first to build the condition
    const libraries = await fetchKomga('/libraries');
    const libraryIds = (libraries.content || libraries).map(lib => lib.id);

    const keepReadingBody = {
      condition: {
        allOf: [
          {
            anyOf: libraryIds.map(libId => ({
              libraryId: { operator: "is", value: libId }
            }))
          },
          {
            readStatus: { operator: "is", value: "IN_PROGRESS" }
          }
        ]
      }
    };

    const keepReadingResponse = await fetchKomgaPost('/books/list?size=50&sort=readProgress.readDate,desc', keepReadingBody);
    const keepReading = keepReadingResponse.content || [];

    res.render('recently', {
      title: 'Keep Reading',
      books: keepReading,
      type: 'keep-reading'
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load keep reading books' });
  }
});

// On Deck books
app.get('/recently/on-deck', async (req, res) => {
  try {
    // Get all libraries first to build the library_id parameters
    const libraries = await fetchKomga('/libraries');
    const libraryIds = (libraries.content || libraries).map(lib => lib.id);
    const libraryParams = libraryIds.map(id => `library_id=${id}`).join('&');

    const onDeckResponse = await fetchKomga(`/books/ondeck?size=50&${libraryParams}`);
    const onDeck = onDeckResponse.content || [];

    res.render('recently', {
      title: 'On Deck',
      books: onDeck,
      type: 'on-deck'
    });
  } catch (error) {
    res.status(500).render('error', { error: 'Failed to load on deck books' });
  }
});

// API proxy endpoints for client-side navigation

// Get page image
app.get('/api/books/:bookId/pages/:pageNumber', async (req, res) => {
  try {
    const { bookId, pageNumber } = req.params;
    const response = await fetchKomgaBinary(`/books/${bookId}/pages/${pageNumber}`);

    // Forward headers
    res.set('Content-Type', response.headers.get('content-type'));
    res.set('Content-Length', response.headers.get('content-length'));
    res.set('Cache-Control', 'public, max-age=3600');

    // Pipe the image data
    response.body.pipe(res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load page image' });
  }
});

// Get book info (for client-side navigation)
app.get('/api/books/:bookId', async (req, res) => {
  try {
    const { bookId } = req.params;
    const book = await fetchKomga(`/books/${bookId}`);
    res.json(book);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load book info' });
  }
});

// Update read progress
app.patch('/api/books/:bookId/read-progress', async (req, res) => {
  try {
    const { bookId } = req.params;
    const { page, completed } = req.body;

    const progressData = {};
    if (page !== undefined) progressData.page = page;
    if (completed !== undefined) progressData.completed = completed;

    const response = await fetch(`${KOMGA_API}/books/${bookId}/read-progress`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': TOKEN
      },
      body: JSON.stringify(progressData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    res.status(204).send(); // No content response like Komga API
  } catch (error) {
    console.error('Failed to update read progress:', error.message);
    res.status(500).json({ error: 'Failed to update read progress' });
  }
});

// Get next/previous book in series
app.get('/api/books/:bookId/next', async (req, res) => {
  try {
    const { bookId } = req.params;
    const nextBook = await fetchKomga(`/books/${bookId}/next`);
    res.json(nextBook);
  } catch (error) {
    res.status(404).json({ error: 'No next book found' });
  }
});

app.get('/api/books/:bookId/previous', async (req, res) => {
  try {
    const { bookId } = req.params;
    const prevBook = await fetchKomga(`/books/${bookId}/previous`);
    res.json(prevBook);
  } catch (error) {
    res.status(404).json({ error: 'No previous book found' });
  }
});

// TEMPORARY: Key spy endpoint for Kindle page turn button detection
app.post('/api/key-spy', async (req, res) => {
  try {
    const { keyCode, key, code, type, timestamp, userAgent } = req.body;

    console.log('🔍 KEY SPY EVENT:', {
      type: type,
      keyCode: keyCode,
      key: key,
      code: code,
      timestamp: new Date(timestamp).toISOString(),
      userAgent: userAgent || 'unknown'
    });

    res.status(200).json({ logged: true });
  } catch (error) {
    console.error('Key spy logging error:', error);
    res.status(500).json({ error: 'Failed to log key event' });
  }
});

// Error handling
app.use((req, res) => {
  // Ensure isKindle is available for 404 errors
  if (!res.locals.isKindle) {
    const userAgent = req.get('User-Agent') || '';
    const isKindle = /kindle|silk/i.test(userAgent) ||
                     /mobile.*safari/i.test(userAgent) && /kindle/i.test(userAgent);
    const isEink = /e-ink|eink|kindle|kobo|nook|boox|remarkable|supernote/i.test(userAgent);
    res.locals.isKindle = isKindle || isEink;
  }
  res.status(404).render('error', { error: 'Page not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  // Ensure isKindle is available for 500 errors
  if (!res.locals.isKindle) {
    const userAgent = req.get('User-Agent') || '';
    const isKindle = /kindle|silk/i.test(userAgent) ||
                     /mobile.*safari/i.test(userAgent) && /kindle/i.test(userAgent);
    const isEink = /e-ink|eink|kindle|kobo|nook|boox|remarkable|supernote/i.test(userAgent);
    res.locals.isKindle = isKindle || isEink;
  }
  res.status(500).render('error', { error: 'Internal server error' });
});

const PORT = process.env.PORT || config.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  log(`Manga Reader running on http://localhost:${PORT}`);
  log(`Also accessible at http://<machine-IP>:${PORT}`);
  log(`Proxying Komga API: ${KOMGA_API}`);
});
