const fs = require('fs')
const os = require('os')
const { exec } = require('child_process')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const colors = require('colors')

const countOccurrences = (string, subString, allowOverlapping) => {
  string += "";
  subString += "";
  
  if (subString.length <= 0) return (string.length + 1);

  let n = 0,
    pos = 0,
    step = allowOverlapping ? 1 : subString.length;

  while (true) {
    pos = string.indexOf(subString, pos);
    if (pos >= 0) {
      ++n;
      pos += step;
    } else break;
  }
  return n;
}

const deleteFile = path => fs.unlink(path, () => {});

const parseTesseractOutput = outputPath => {
  const contents = fs.readFileSync(outputPath, 'utf8')
  deleteFile(outputPath)

  // Filter non-empty/non-blank lines
  const lines = contents.split('\n').filter(x => x && x.length > 1);

  // Note: The last line from OCR is usually 'Swipe left to reveal comments' if chat is hidden

  const title = lines.slice(0, lines.length - 4).join(' ');
  const isInvertedQuestion = title.toLowerCase().includes('not');
  const choices = lines.slice(lines.length - 4, lines.length - 1);

  return {
    title,
    isInvertedQuestion,
    choices
  }
}

const parseGoogleSearchResults = (questionChoices, isInvertedQuestion, results) => {

  const $ = cheerio.load(results[0]);
  const genericSearch = results[0].toLowerCase();

  const choicesWithCounts = questionChoices.map((choiceName, index) => {
    const result = results[index + 1];
    const $$ = cheerio.load(result);
    const scopedCount = parseInt($$('#resultStats').text().toLowerCase().replace('about ', '').replace(' results', '').replace(/,/g, ''), 10);

    return {
      name: choiceName,
      scopedCount
    }
  })

  const sortedChoices = choicesWithCounts
    .map(o => ({ ...o, count: countOccurrences(genericSearch, o.name.toLowerCase(), true) }))
    .sort((o1, o2) => o2.scopedCount - o1.scopedCount || o2.count - o1.count);

  if (isInvertedQuestion) {
    sortedChoices.reverse();
  }

  if (sortedChoices && sortedChoices.length > 0) {
    const topAnswer = sortedChoices[0];

    console.log(colors.bgBlack(colors.green(`Top Answer: ${topAnswer.name} (${topAnswer.count} - ${topAnswer.scopedCount})\n`)));
  }
  
  const resultSections = $('div.g');
  const first = resultSections.first();
  const next = first.next();
  const third = next.next();
  const four = third.next();
  const five = four.next();

  console.log('Raw Google search results:')

  [first, next, third].forEach(x => {
    console.log(`\t${x.find('h3.r').text()} [${x.find('cite').text().substring(0, 50)}...]`)
    x.find('span.st').text().split('\n').forEach(y => {
      console.log(`\t\t${y}`);
    });
    console.log();
  });

  console.log(JSON.stringify(sortedChoices, null, 2));
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36';

const processImage = path => {
  console.log('\033c')
  console.log('Processing...');

  exec(`tesseract "${path}" "${path}.log"`, (err, stdout, stderr) => {
    // Delete the screenshot
    //deleteFile(path)

    if (err) {
      console.log(`Tesseract OCR error: ${err}`)
      return
    }

    const { title, isInvertedQuestion, choices } = parseTesseractOutput(`${path}.log.txt`)
    
    const searchTitle = isInvertedQuestion ? title.replace(/ not /i, ' ') : title;

    console.log(`${colors.gray('Got question:')} ${title}`);
    console.log(`${colors.gray('Got choices:')}  ${choices.join(', ')}`);

    const searchHeaders = { 'User-Agent': USER_AGENT };

    const baseUrl = `https://www.google.com/search?q=${encodeURIComponent(searchTitle)}+`;

    const promises = ['', ...choices
    ].map(choice => {
      const encodedChoice = encodeURIComponent('"' + choice + '"');
      const url = baseUrl + encodedChoice;
      return fetch(url, { searchHeaders });
    });
    
    Promise.all(promises.map(p => p.then(res => res.text())))
    .then(results => parseGoogleSearchResults(choices, isInvertedQuestion, results))
    .catch(e => {
      // Ignored
    })
  });
}

module.exports = { processImage }