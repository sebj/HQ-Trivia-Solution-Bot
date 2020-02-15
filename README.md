# HQ Trivia Solution Bot

A [HQ Trivia](https://en.wikipedia.org/wiki/HQ_(game)) (💀) solution bot mostly built over the course of 3 days in 2018. Old, rough code.

Techniques inspired by ["I Also Wrote a Bot for HQ Trivia" by Benjamin Schwartz](https://medium.com/@LtHummus/i-also-wrote-a-bot-for-hq-trivia-7c9932a9c6d4).

## Process
* Watches a folder for phone screenshots of the current question in the game (for example taken by screenshotting a connected iPhone via QuickTime Player's Movie Recording feature)
* When a new screenshot is added:
  * Crop to core text
  * Convert to greyscale
  * Increase contrast
  * Use Tesseract OCR to find the question & 3 answer choices, using the game's Circular font to improve the chances of matches
  * Find key phrases from the question (proper nouns, filtering punctuation)
  * For each answer choice:
    * Count the number of occurrences of key question phrases in that answer's Wikipedia page
    * Count the number of ocurrences of key question phrases in that answer's Google search results page
  * Suggest the answer with the most matches, or the least if the question contains 'not'

## Installation / Usage
1. `npm install`
2. `brew install tesseract`
3. Make a copy of `config.json.template` named `config.json`
4. Create a Google API client, and fill in the `googleApiKey` in `config.json`
5. Create a Google Custom Search Engine, and fill in the `googleCSECx` key in `config.json`
6. If phone screenshots do not appear in your desktop folder by default, set a custom screenshot folder path to watch in `config.json` (`watchPath`)
7. `node index.js`