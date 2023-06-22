# Jekyll offline search plugin

A plugin for Jekyll to search for all posts and rank them by relevance. Relevance is determined by TF-IDF. Newer posts relevance is boosted exponentally so that they show up ealier in the results.

## Installation

Install the plugin via `bundler` in the latest version:

```shell
bundle add jekyll_ranked_search
```

Edit your `_config.yml` and add the plugin:

```yml
plugins:
  - jekyll_ranked_search
```

Finally, restart your Jekyll server locally if it is currently running. This will generate the two files `/js/search.js` and `/search.json` in your `_site` folder. As a next step, you will need to load the search plugin in your HTML code.

## Usage
In your template, add the following lines:

```html
<!-- Put the following line in your head -->
<script type="module" src="/js/search.js"></script>

<!-- Place this line where you want to render the search box -->
<search-box></search-box>
```

You only need to add the `<script>` tag once. It is recommended to add it to the header. The search box will fill 100% of the width of its parent container. The `<search-box>` tag is a [WebComponent](-97https://www.webcomponents.org) that uses [Lit](https://lit.dev) and follows W3C standards and are available in all [modern browswers](https://caniuse.com/custom-elementsv1).

## Configuration
No configuration is currently possible.
