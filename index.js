const os = require('os')
const chokidar = require('chokidar')
const config = require('./config.json')
const processImage = require('./lib').processImage

const username = os.userInfo().username
const watchPath = config.watchPath || `/Users/${username}/Desktop`

let watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
});

watcher.on('add', path => path.endsWith('.jpg') && processImage(path))
//processImage(config.testPath)