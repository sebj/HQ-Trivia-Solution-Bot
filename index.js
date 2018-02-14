const fs = require('fs')
const os = require('os')
const chokidar = require('chokidar')
const { exec } = require('child_process')
const fetch = require('node-fetch')
const cheerio = require('cheerio')
const colors = require('colors')
const config = require('./config.json')

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

const deleteFile = path => {
  fs.unlink(path, () => { });
}

const parseTesseractOutput = outputPath => {
  const contents = fs.readFileSync(outputPath, 'utf8')
  deleteFile(outputPath)

  // Filter non-empty/non-blank lines
  const lines = contents.split('\n').filter(x => x && x.length > 1);

  const questionLines = lines.slice(0, lines.length - 1);
  const title = questionLines.slice(0, questionLines.length - 3).join(' ');
  const isInvertedQuestion = title.toLowerCase().indexOf(' not ') >= 0;
  const choices = questionLines.slice(questionLines.length - 3, questionLines.length);

  return {
    title,
    isInvertedQuestion,
    choices
  }
}

const parseGoogleSearchResults = (questionChoices, isInvertedQuestion, results) => {

  if (!results || results.length == 0) {
    return
  }

  const $ = cheerio.load(results[0]);
  const genericSearch = results[0].toLowerCase();

  const choicesWithCounts = questionChoices.map(o => ({ name: o }));

  for (let i = 0; i < choicesWithCounts.length; ++i) {
    const result = results[i + 1];
    const $$ = cheerio.load(result);
    choicesWithCounts[i].scopedCount = parseInt($$('#resultStats').text().toLowerCase().replace('about ', '').replace(' results', '').replace(/,/g, ''), 10);
  }

  const sortedChoices = choicesWithCounts
    .map(o => ({ ...o, count: countOccurrences(genericSearch, o.name.toLowerCase(), true) }))
    .sort((o1, o2) => {
      if (o1.count === o2.count) {
        return o1.scopedCount > o2.scopedCount ? -1 : 1;
      }
      
      return o1.count > o2.count ? -1 : 1
    });

  if (isInvertedQuestion) {
    sortedChoices.reverse();
  }

  console.log(isInvertedQuestion ? colors.bgRed(colors.white('\nQuestion has NOT - reversing results\n')) : '');
  if (sortedChoices && sortedChoices.length > 0) {
    console.log(colors.bgBlack(colors.green(`Top Answer: ${sortedChoices[0].name} (${sortedChoices[0].count} - ${sortedChoices[0].scopedCount})`)));
  }

  console.log()
  const resultSections = $('div.g');
  const first = resultSections.first();
  const next = first.next();
  const third = next.next();
  const four = third.next();
  const five = four.next();

  console.log('Raw Google results:')

  [first, next, third].forEach(x => {
    //console.log(`\t${x.find('h3.r').text()} [${x.find('cite').text().substring(0, 50)}...]`)
    x.find('span.st').text().split('\n').forEach(y => {
      //console.log(`\t\t${y}`);
    });
    //console.log();
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
      // node couldn't execute the command
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
      return fetch(url, { searchHeaders })
    });
    
    Promise.all(
      promises.map(p => p.then(res => res.text()))
    ).then(results => parseGoogleSearchResults(results));
  });
}

const username = os.userInfo().username
const watchPath = config.watchPath || `/Users/${username}/Desktop`

let watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
});

watcher.on('add', path => path.endsWith('.jpg') && processImage(path))

// Testing:
// processImage('image/path/here')
// const testPath = config.testPath
processImage(testPath)