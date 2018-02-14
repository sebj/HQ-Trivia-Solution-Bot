const fs = require('fs'),
os = require('os'),
Jimp = require('jimp'),
{ exec } = require('child_process'),
fetch = require('node-fetch'),
colors = require('colors'),

config = require('./config.json')

const GOOGLE_API_KEY = config.googleApiKey
const GOOGLE_CX = config.googleCSECx

const convertImage = filePath => 
  Jimp.read(filePath)
    .then(image => {
      // Remove the last 3 characters (png), replace with '.hq.jpg'
      const convertedFilePath = filePath.slice(0, -4) + '.hq.jpg'

      const { width, height } = image.bitmap

      const horizontalInsetPercent = 80 / 614
      const topInsetPercent = 154 / 873
      const heightPercent = 394 / 873

      const cropX = Math.round(width * horizontalInsetPercent)
      const cropY = Math.round(height * topInsetPercent)
      const cropWidth = width - (2 * cropX)
      const cropHeight = height * heightPercent

      image
        .crop(cropX, cropY, cropWidth, cropHeight)
        .background(0xFFFFFF)
        .greyscale()
        .contrast(0.5)
        .write(convertedFilePath)

      return convertedFilePath

    }).catch(err => console.error(err))

const deleteFile = path => fs.unlink(path, () => {})

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.1 Safari/605.1.15'

const checkConfig = () => {
  if (!GOOGLE_API_KEY) {
    console.log(colors.red('Missing Google API Key'))
    return false
  }

  if (!GOOGLE_CX) {
    console.log(colors.red('Missing Google Custom Search Engine Cx Key'))
    return false
  }

  return true
}

const readText = processedImageFilePath => {
  const path = processedImageFilePath

  return new Promise((resolve, reject) => {
    exec(`tesseract "${path}" "${path}.log"`, (err, stdout, stderr) => {
      // Delete the screenshot
      //deleteFile(path)

      if (err) {
        console.log(`Tesseract OCR error: ${err}`)
        return reject(err)
      }

      const outputPath = `${path}.log.txt`

      const contents = fs.readFileSync(outputPath, 'utf8')
      deleteFile(outputPath)

      // Filter non-empty/non-blank lines
      const lines = contents.split('\n').filter(x => x && x.length > 1)

      const title = lines.slice(0, lines.length - 3).join(' ')

      // Last 3 lines are the 3 available choice options
      const choices = lines.slice(lines.length - 3)

      resolve({ title, choices })
    })
  })
}

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

const answerQuestion = (title, choices) => {
  const isInvertedQuestion = title.toLowerCase().includes('not')

  const searchTitle = isInvertedQuestion ? title.replace(/ not /i, ' ') : title
  const encodedSearchTitle = encodeURIComponent(searchTitle)
  const searchHeaders = { 'User-Agent': USER_AGENT }

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
  return Promise.all(promises.map(p => p.then(res => res.json())))
    .then(results =>
      parseGoogleSearchResults(choices, isInvertedQuestion, results))
    .catch(e => {
      // Ignored
    })
}

const processImage = imageFilePath => {
  if (!imageFilePath) {
    console.log(colors.red('Invalid image path'))
    return false
  }

  checkConfig()

  console.log('\033c')
  console.log(colors.gray('Processing...'))

  convertImage(imageFilePath)
  .then(processedImageFilePath => readText(processedImageFilePath))
  .then(({ title, choices }) => {

    if (title && choices.length == 3) {
      console.log(`${colors.gray('Question:')} ${title}`)
      console.log(`${colors.gray('Choices:')}  ${choices.join(', ')}`)

    } else {
      console.log(colors.red('Sorry, couldn\'t read the question!'))
      return
    }

    return answerQuestion(title, choices)
  })
  .catch(err => console.log(colors.red('Something went wrong with that question!')))
}

module.exports = { processImage, deleteFile }
