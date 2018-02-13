const fs = require('fs');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const colors = require('colors');

const occurrences = (string, subString, allowOverlapping) => {
  string += "";
  subString += "";
  if (subString.length <= 0) return (string.length + 1);

  var n = 0,
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

const processImage = path => {
  const top = 400;
  const bottom = 900;
  const left = 150;
  var config1 = { width: 1174 - left - left, height: 2278 - top - bottom, top, left };
  console.log('\033c')
  console.log('Processing...');
  exec(`tesseract "${path}" "${path}.log"`, (err, stdout, stderr) => {
    //fs.unlink(`${path}`, () => { });
    if (err) {
      // node couldn't execute the command
      console.log(`err: ${err}`);
      return;
    }

    const contents = fs.readFileSync(`${path}.log.txt`, 'utf8');
    // Delete log file
    fs.unlink(`${path}.log.txt`, () => { });

    const lines = contents.split('\n').filter(x => x && x.length > 1);
    const questionLines = lines.slice(0, lines.length - 1);
    const title = questionLines.slice(0, questionLines.length - 3).join(' ');
    const shouldInvert = title.toLowerCase().indexOf(' not ') >= 0;
    const options = questionLines.slice(questionLines.length - 3, questionLines.length);
    const searchTitle = shouldInvert ? title.replace(/ not /i, ' ') : title;

    console.log(`${colors.gray('Got question:')} ${title}`);
    console.log(`${colors.gray('Got options:')}  ${options.join(', ')}`);

    const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36' };
    const promises = ['', ...options].map(o => fetch(`https://www.google.com/search?q=${encodeURIComponent(searchTitle)}+${encodeURIComponent('"' + o + '"')}`, { headers }));
    Promise.all(promises.map(p => p.then(res => res.text()))).then((results) => {
      const $ = cheerio.load(results[0]);
      const genericSearch = results[0].toLowerCase();

      const optionsWithCounts = options.map(o => ({ name: o }));
      for (let i = 0; i < optionsWithCounts.length; ++i) {
        const result = results[i + 1];
        const $$ = cheerio.load(result);
        optionsWithCounts[i].scopedCount = parseInt($$('#resultStats').text().toLowerCase().replace('about ', '').replace(' results', '').replace(/,/g, ''), 10);
      }

      const sortedOptions = optionsWithCounts
        .map(o => ({ ...o, count: occurrences(genericSearch, o.name.toLowerCase(), true) }))
        .sort((o1, o2) => {
          if (o1.count === o2.count) {
            return o1.scopedCount > o2.scopedCount ? -1 : 1;
          }
          return o1.count > o2.count ? -1 : 1
        });

      if (shouldInvert) {
        sortedOptions.reverse();
      }

      console.log(shouldInvert ? colors.bgRed(colors.white('\nQuestion has NOT - reversing results\n')) : '');
      if (sortedOptions && sortedOptions.length > 0) {
        console.log(colors.bgBlack(colors.green(`Top Answer: ${sortedOptions[0].name} (${sortedOptions[0].count} - ${sortedOptions[0].scopedCount})`)));
      }
      
      console.log();
      const resultSections = $('div.g');
      const first = resultSections.first();
      const next = first.next();
      const third = next.next();
      const four = third.next();
      const five = four.next();

      console.log('Raw Google results:');
      [first, next, third].forEach(x => {
        //console.log(`\t${x.find('h3.r').text()} [${x.find('cite').text().substring(0, 50)}...]`)
        x.find('span.st').text().split('\n').forEach(y => {
          //console.log(`\t\t${y}`);
        });
        //console.log();
      });

      console.log(JSON.stringify(sortedOptions, null, 2));
    });
  });
}
var watcher = chokidar.watch('/Users/Seb/Desktop', {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
});


watcher.on('add', path => path.endsWith('.jpg') && processImage(path))

//processImage('/Users/Seb/Desktop/Screen Shot 2018-02-13 at 21.25.26.jpg')
processImage('/Users/Seb/Desktop/Screen Shot 2018-02-13 at 21.05.29.jpg')