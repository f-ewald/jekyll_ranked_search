import {LitElement, html, css} from 'https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js';
import 'https://cdn.jsdelivr.net/npm/@github/relative-time-element';


class SearchBox extends LitElement {
  static properties = {
    _isLoading: {state: true, type: Boolean},
    _data: {state: false, type: Array},
    _results : {state: true, type: Array},
    _open: {state: true, type: Boolean},
    _placeholder: {state: true, type: String},

    // Lazy loading
    lazy: {type: Boolean, attribute: true},
  };

  /**
   * Constructor. Sets up default values.
   */
  constructor() {
    super();

    // No data initially loaded
    this._data = [];

    // Results are initially empty
    this._results = [];

    // Start in closed state, show no results
    this._open = false;

    // Default to not loading
    this._isLoading = false;

    // Disable lazy loading by default
    this.lazy = false;

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
      // margin: 0 auto;
      padding: .4em;
      border: 1px solid #ccc;
      font-size: 1.2em;
      border-radius: 4px;
      box-shadow: 1px 1px 3px #AAA;
      z-index: 11;
    }

    #results {
      position: absolute;
      width: 100%;
      margin-top: 4px;
      z-index: 10;
      background-color: #F6F6F6;
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

    document.addEventListener('click', (event) => {
      if (!event.composedPath().includes(this) && this._open) {
          this.toggle();
      }
    });
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

  async loadData() {
    // Set state during loading
    this._isLoading = true;
    this.updatePlaceholder();

    const response = await fetch("/search.json");
    const jsonData = await response.json();
    jsonData.word2doc = new Map(Object.entries(jsonData.word2doc));
    jsonData.bow = new Map(Object.entries(jsonData.bow));
    jsonData.tfidf = new Map(Object.entries(jsonData.tfidf));
    this._data = jsonData;
    
    // Cleanup state
    this._isLoading = false;
    this.updatePlaceholder();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }

  search(event) {
    if (event.key === "Escape") {
      this.close();
      return;
    }
    const query = event.target.value.toLowerCase().trim();
    if (query === "") {
      this._results = [];
      this.close();
      return;
    }

    // Split query into word-tokens
    const tokens = query.split(" ");

    // Find token ids for each token
    let tokenIds = new Set();
    for (const token of tokens) {
      if (token === "") {
        continue;
      }
      if (this._data.bow.has(token)) {
        tokenIds.add(this._data.bow.get(token));
      } else {
        // If one of the tokens is not available, we can return immediately
        // as there will be no results
        this._results = [];
        this.close();
        return;
      }
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
    this._results = candidates.map((idx) => this._data.docs[idx]).slice(0, 8);
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
  focus(_) {
    if (this.lazy && this._data.length === 0 && !this._isLoading) {
      this.loadData();
    }
  }

  render() {
    return html`<div>
      <input id="q" type="text" placeholder="${this._placeholder}" @keyup="${this.search}" @click=${this.openIfResults} @focus=${this.focus}>
      ${this._open ? html`
        <div id="results">
          ${this._results.map((result) => html`
            <a class="resultItem" href="${result.url}">
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
