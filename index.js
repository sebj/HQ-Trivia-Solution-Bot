const os = require('os'),
chokidar = require('chokidar'),
config = require('./config.json'),
{ processImage } = require('./lib'),
colors = require('colors')

const username = os.userInfo().username
const watchPath = config.watchPath || `/Users/${username}/Desktop`

const watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
})

const isJPG = filePath => {
  const extension = filePath.slice(filePath.indexOf('.'))
  return extension.endsWith('.jpg') && !extension.includes('.hq.')
}
const isPNG = filePath => {
  const extension = filePath.slice(filePath.indexOf('.'))
  return extension.endsWith('.png') && !extension.includes('.hq.')
}

const isAcceptedImage = filePath => isJPG(filePath) || isPNG(filePath)

watcher.on('add', filePath => 
  isAcceptedImage(filePath) && processImage(filePath)
)

console.log(colors.green('Good luck and have fun!\n'))