import {LitElement, html, css} from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';
import 'https://cdn.jsdelivr.net/npm/@github/relative-time-element';


class SearchBox extends LitElement {
  static properties = {
    _isLoading: {state: true, type: Boolean},
    _data: {state: false, type: Array},
    _results : {state: true, type: Array},
    _open: {state: true, type: Boolean},
    _placeholder: {state: true, type: String},
    _activeIndex: {state: true, type: Number},

    // Lazy loading
    lazy: {type: Boolean, attribute: true},

    // Maximum number of results to show
    maxResults: {type: Number, attribute: "max-results"},
  };

  /**
   * Constructor. Sets up default values.
   */
  constructor() {
    super();

    // No data initially loaded
    this._data = null;

    // Results are initially empty, none selected via keyboard
    this._results = [];
    this._activeIndex = -1;

    // Latest query, re-run once data finishes loading
    this._query = "";

    // Closes the results when clicking outside of the component
    this._onDocumentClick = (event) => {
      if (this._open && !event.composedPath().includes(this)) {
        this.close();
      }
    };

    // Start in closed state, show no results
    this._open = false;

    // Default to not loading
    this._isLoading = false;

    // Disable lazy loading by default
    this.lazy = false;

    // Default to maximum of 8 results
    this.maxResults = 8;

    this._placeholder = "Search...";
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
    }

    input#q {
      box-sizing: border-box;
      width: 100%;
      padding: .4em 30px;
      border: 1px solid #ccc;
      font-size: 1.2em;
      border-radius: 4px;
      box-shadow: 1px 1px 3px #AAA;
    }

    label {
      position: relative;
    }

    label::before {
      content: "";
      position: absolute;
      left: 10px;
      top: 0;
      bottom: 0;
      width: 20px;
      background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor' class=''%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z' /%3E%3C/svg%3E") no-repeat center center;
    }

    #results {
      position: absolute;
      width: 100%;
      margin-top: 4px;
      z-index: 10;
      background-color: #F6F6F6;
      overflow: hidden;
      border-radius: 4px;
      box-shadow: 1px 1px 2px #888;
    }

    .hide {
      display: none;
    }

    .resultItem {
      text-decoration: none;
      color: #333;
      padding: .4em;
      display: flex;
      flex-direction: column;
    }

    .resultItem:hover {
      background-color: #F0F0F0;
    }
    .resultItem .title {
      color: #1756a9;
      font-weight: 500;
    }
    .resultItem .datetime {
      color: #666;
      font-size: .8em;
    }
    .resultItem .excerpt {
      font-size: .8em;
    }
    .resultItemActive {
      background-color: #F0F0F0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();

    // Load data if lazy loading is disabled
    if (!this.lazy) {
      this.loadData();
    }

    document.addEventListener('click', this._onDocumentClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocumentClick);
  }

  toggle() {
    this._open = !this._open;
  }

  openIfResults() {
    if (this._results.length > 0) {
      this._open = true;
    }
  }

  close() {
    this._open = false;
  }

  /**
   * Fetches the search index. On failure the placeholder shows an error and,
   * in lazy mode, loading is retried on the next focus.
   */
  async loadData() {
    // Set state during loading
    this._isLoading = true;
    this.updatePlaceholder();

    try {
      const response = await fetch("/search.json");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const jsonData = await response.json();
      jsonData.word2doc = new Map(Object.entries(jsonData.word2doc));
      jsonData.bow = new Map(Object.entries(jsonData.bow));
      jsonData.tfidf = new Map(Object.entries(jsonData.tfidf));
      this._data = jsonData;
    } catch (error) {
      console.error("search-box: failed to load search index", error);
      this._placeholder = "Search unavailable";
    } finally {
      this._isLoading = false;
      this.updatePlaceholder();
    }

    // Show results for anything typed while loading
    this.search(this._query);
  }

  _onInput(event) {
    this._query = event.target.value;
    this.search(this._query);
  }

  _onKeyDown(event) {
    switch (event.key) {
      case "Escape":
        this.close();
        break;
      case "ArrowDown":
        event.preventDefault();
        this._moveActive(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        this._moveActive(-1);
        break;
      case "Enter": {
        const result = this._results[this._activeIndex];
        if (this._open && result) {
          window.location.href = result.url;
        }
        break;
      }
    }
  }

  /**
   * Moves the keyboard selection by `step`, wrapping around at either end.
   */
  _moveActive(step) {
    const count = this._results.length;
    if (count === 0) {
      return;
    }
    this._open = true;
    const start = this._activeIndex === -1 && step < 0 ? 0 : this._activeIndex;
    this._activeIndex = (start + step + count) % count;
  }

  /**
   * Updates results for the given query. Does nothing useful until data is loaded.
   */
  search(rawQuery) {
    this._activeIndex = -1;
    const query = rawQuery.toLowerCase().trim();
    if (query === "" || this._data === null) {
      this._results = [];
      this.close();
      return;
    }

    // Split query into word-tokens, normalized the same way as the index
    const tokens = query.split(/\s+/).map((t) => t.replace(/[^a-z0-9_\/\-]/g, ""));

    // Find token ids for each token. Unknown tokens (e.g. stopwords) are ignored.
    let tokenIds = new Set();
    for (const token of tokens) {
      if (this._data.bow.has(token)) {
        tokenIds.add(this._data.bow.get(token));
      }
    }

    if (tokenIds.size === 0) {
      this._results = [];
      this.close();
      return;
    }

    // Convert tokenIds to array
    tokenIds = [...tokenIds];

    // Initialize docs with first token
    // Subsequent token need to interset with this set
    let docs = new Set(this._data.word2doc.get(tokenIds[0].toString()));
    
    for (const tokenId of tokenIds.slice(1)) {
      // Find document candidates
      const docCandidates = new Set(this._data.word2doc.get(tokenId.toString()));
      docs = new Set([...docs].filter((x) => docCandidates.has(x)));
    }

    // Calculate TF-IDF
    let results = new Map();
    for (const doc of docs) {
      let score = 0;
      for (const tokenId of tokenIds) {
        if (this._data.tfidf.has(`${tokenId},${doc}`)) {
          score += this._data.tfidf.get(`${tokenId},${doc}`);
        }
      }
      results.set(doc, score);
    }

    // Sort by score
    const candidates = [...results.entries()].sort((a, b) => b[1] - a[1]).map((a) => a[0]);
    
    // Get top n results
    this._results = candidates.map((idx) => this._data.docs[idx]).slice(0, this.maxResults);
    this._open = true;
  }

  updatePlaceholder() {
    if (this._isLoading) {
      this._placeholder = "Loading...";
      return;
    }
    if (this._data && this._data.docs && this._data.docs.length > 0) {
      let plural = "";
      if (this._data.docs.length !== 1) {
        plural = "s";
      }
      this._placeholder = "Search in " + this._data.docs.length + ` post${plural}...`;
      return;
    }
  }

  /**
   * Event triggered on search box focus.
   */
  _onFocus() {
    if (this.lazy && this._data === null && !this._isLoading) {
      this.loadData();
    }
  }

  render() {
    return html`<div>
      <label>
      <input id="q" type="text" placeholder="${this._placeholder}" @input=${this._onInput} @keydown=${this._onKeyDown} @click=${this.openIfResults} @focus=${this._onFocus}>
      </label>
      ${this._open ? html`
        <div id="results">
          ${this._results.map((result, idx) => html`
            <a class="resultItem ${idx === this._activeIndex ? "resultItemActive" : ""}" href="${result.url}">
              <div>
                <span class="title">${result.title}</span>
                <span class="datetime">
                  <relative-time datetime="${result.date}">
                    ${result.date}
                  </relative-time>
                </span>
              </div>
              <div class="excerpt">
                ${result.text}
              </div>
            </a>
          `)}
        </div>
      ` : ""}
      
    </div>`;
  }
}
customElements.define('search-box', SearchBox);
