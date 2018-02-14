const os = require('os')
const chokidar = require('chokidar')
const Jimp = require('jimp')
const config = require('./config.json')
const { processImage, deleteFile } = require('./lib')

const username = os.userInfo().username
const watchPath = config.watchPath || `/Users/${username}/Desktop`

const watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
})

const isJPG = filePath => filePath.toLowerCase().endsWith('.jpg')
const isPNG = filePath => filePath.toLowerCase().endsWith('.png')

const isAcceptedImage = filePath => isJPG(filePath) || isPNG(filePath)

const checkImage = filePath => {
  if (isPNG(filePath)) {

    Jimp.read(filePath).then(imageConvert => {
      // Remove the last 3 characters (png), replace with 'jpg
      const convertedFilePath = filePath.slice(0, -3) + 'jpg'

      imageConvert
      .quality(100)
      .background(0xFFFFFF)
      .write(convertedFilePath).then(() => {
        // Delete the original file
        deleteFile(filePath)
      })

    }).catch(err => console.error(err))

  } else {
    processImage(filePath)
  }
}

watcher.on('add', filePath => isAcceptedImage(filePath) && checkImage(filePath))