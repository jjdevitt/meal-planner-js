'use strict';
// Quick DuckDuckGo search check (equivalent of the original test.py).
const { createSearch } = require('../src/config');

createSearch()('list Recipes for healthy 30-minute dinner recipes no processed foods fresh protein')
  .then((results) => console.log(results || '(no results)'))
  .catch((err) => {
    console.error(`Search failed: ${err.message}`);
    process.exit(1);
  });
