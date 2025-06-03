# Komga UI for Kindle

A minimal manga reader that proxies a Komga API with server-side rendering optimized for e-readers and old mobile devices. Made with Cursor within an hour.

<img width="1506" alt="image" src="https://github.com/user-attachments/assets/c0e39166-d53a-4c6f-8fc7-39d10b1466c1" />


## Features

- **E-ink optimized** with high contrast themes and touch navigation
- **Recently section** with Keep Reading and On Deck lists
- **Touch-optimized controls** for mobile and e-readers
- **Auto-navigation** between books in series
- **Server-side rendering** with minimal JavaScript

## Quick Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure connection**:
   ```bash
   cp config.sample.js config.js
   ```
   Edit `config.js` with your Komga settings:
   ```javascript
   module.exports = {
     KOMGA_API: 'http://YOUR_KOMGA_SERVER:25600/api/v1',
     TOKEN: 'YOUR_API_KEY_HERE',  // From Komga → Settings → Security → API Keys
     PORT: 3000
   };
   ```

3. **Start server**:
   ```bash
   npm start
   ```

4. **Access reader**: http://localhost:3000

## Configuration

### Required Settings
- **KOMGA_API**: Your Komga server URL with `/api/v1` endpoint
- **TOKEN**: API key from Komga (Settings → Security → API Keys)
- **PORT**: Server port (optional, defaults to 3000)

### Security Note
The `config.js` file is gitignored to protect your credentials. Always use `config.sample.js` as a template.

## Usage

### Navigation
- **Touch zones**: Tap left/right sides for page navigation
- **Center tap**: Toggle toolbar visibility
- **Floating controls**: Always-visible back and menu buttons
- **Keyboard**: Arrow keys, A/D keys, Escape

### E-ink Optimization
- **Auto-detection**: Kindle theme applies automatically
- **Manual toggle**: Browser console → `KindleTheme.apply()` or `KindleTheme.remove()`

## API Routes

- `GET /` → Libraries and recently section
- `GET /library/:id` → Series in library
- `GET /series/:id` → Books in series
- `GET /book/:id` → Reading interface
- `GET /recently/keep-reading` → Books in progress
- `GET /recently/on-deck` → Next books to read

## File Structure

```
k4k/
├── config.js              # Your configuration (gitignored)
├── config.sample.js       # Configuration template
├── server.js              # Express server
├── views/                 # EJS templates
├── public/                # CSS and JavaScript
└── README.md
```

## Tech Stack

- **Backend**: Node.js, Express, EJS
- **Frontend**: Vanilla JavaScript, XHR, CSS, HTML

## Browser Compatibility

Any browser support ES5 and CSS3 will work, including:

- Kindle experiemental browser (tested on WebKit 531.2+).
- Safari 5xx on older iOS devices.
- Internet Explorer 11.

## Troubleshooting

**Libraries not loading**: Check Komga server accessibility and API key validity
**Images not loading**: Verify Komga API endpoint and authentication
**Recently section empty**: Start reading books to populate progress data

# TODO

- [x] UI tweaks including:
   - [x] Fix navbar button sizes
   - [x] Better mobile normal UI
   - [x] More informative series page
   - [x] Add tags to series card

- [ ] Filter by tags / status / author

- [x] Key event input, including Kindle page turn button
