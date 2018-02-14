const fs = require('fs')
const os = require('os')
const Jimp = require('jimp')
const { exec } = require('child_process')
const fetch = require('node-fetch')
const colors = require('colors')

const config = require('./config.json')

const GOOGLE_API_KEY = config.googleApiKey
const GOOGLE_CX = config.googleCSECx

const countOccurrences = (string, subString, allowOverlapping) => {
  string += ''
  subString += ''
  
  if (subString.length <= 0) return (string.length + 1)

  let n = 0,
    pos = 0,
    step = allowOverlapping ? 1 : subString.length

  while (true) {
    pos = string.indexOf(subString, pos)
    if (pos >= 0) {
      ++n
      pos += step
    } else break
  }

  return n
}

const deleteFile = path => fs.unlink(path, () => {})

const parseTesseractOutput = outputPath => {
  const contents = fs.readFileSync(outputPath, 'utf8')
  deleteFile(outputPath)

  // Filter non-empty/non-blank lines
  const lines = contents.split('\n').filter(x => x && x.length > 1)

  // Note: The last line from OCR is usually 'Swipe left to reveal comments' if chat is hidden

  const title = lines.slice(0, lines.length - 4).join(' ')
  const isInvertedQuestion = title.toLowerCase().includes('not')
  const choices = lines.slice(lines.length - 4, lines.length - 1)

  return {
    title,
    isInvertedQuestion,
    choices
  }
}

const parseGoogleSearchResults = (questionChoices, isInvertedQuestion, results) => {

  // The first of the results array is the question on its own
  const genericSearch = results[0]

  // Get every search result description, join them into a single long string
  const genericSearchSnippets = genericSearch.items.map(item => item.snippet).join() || ''

  // Get the other 3 search results for each of the 3 answer choices,
  // Map them to an object with name, number of search results & number of
  // occurrences in the generic search.
  // Then sort by occurrences primarily, or search results count if tied.
  const sortedAnswers = results
  .slice(0, results.length - 1)
  .map((result, idx) => {

    const choiceName = questionChoices[idx]
    
    return {
      name: choiceName,
      count: result.searchInformation.totalResults,
      occurrences: countOccurrences(genericSearchSnippets, choiceName.toLowerCase())
    }
  })
  .sort((a, b) => b.occurrences - a.occurrences || b.count - a.count)

  // If the question has 'NOT', reverse the order of the sorted answers
  if (isInvertedQuestion) {
    sortedAnswers.reverse()
  }

  // If we have answers, take the top answer and show it
  if (sortedAnswers && sortedAnswers.length > 0) {
    const topAnswer = sortedAnswers[0]

    console.log(colors.bgBlack(colors.green(`Top Answer: ${topAnswer.name} (${topAnswer.count} - ${topAnswer.occurrences})\n`)))
  }

  // Mostly for debugging purposes, but may inform a human judgement too
  console.log('Raw Google search results:')
  console.log(sortedAnswers)
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36'

const processImage = path => {

  if (!path) {
    console.log(`${colors.red('Invalid image path')}`)
    return
  }

  if (!GOOGLE_API_KEY) {
    console.log(`${colors.red('Missing Google API Key')}`)
    return
  }

  if (!GOOGLE_CX) {
    console.log(`${colors.red('Missing Google Custom Search Engine Cx Key')}`)
    return
  }

  console.log('\033c')
  console.log(`${colors.gray('Processing...')}`)

  exec(`tesseract "${path}" "${path}.log"`, (err, stdout, stderr) => {
    // Delete the screenshot
    //deleteFile(path)

    if (err) {
      console.log(`Tesseract OCR error: ${err}`)
      return
    }

    const { title, isInvertedQuestion, choices } = parseTesseractOutput(`${path}.log.txt`)
    
    const searchTitle = isInvertedQuestion ? title.replace(/ not /i, ' ') : title

    console.log(`${colors.gray('Got question:')} ${title}`)
    console.log(`${colors.gray('Got choices:')}  ${choices.join(', ')}`)

    const searchHeaders = { 'User-Agent': USER_AGENT }
    
    const encodedSearchTitle = encodeURIComponent(searchTitle)

    // Convert each of the answer choices into a promise with a fetch()
    // function call to the Google Search API
    const promises = ['', ...choices
    ].map(choice => {
      const encodedChoice = encodeURIComponent('"' + choice + '"')

      return fetch(`https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&safe=medium&q=${encodedSearchTitle}+${encodedChoice}`, searchHeaders)
    })
    
    // Execute all promises, wait for them to complete, then construct
    // an array with the first promise (generic question search term)
    // and the results of the 3 answer search terms.
    Promise.all(promises.map(p => p.then(res => res.json())))
    .then(results => 
      parseGoogleSearchResults(choices, isInvertedQuestion, results))
    .catch(e => {
      // Ignored
    })
  })
}

module.exports = { processImage, deleteFile }
