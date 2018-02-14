var Jimp = require("jimp");
const os = require('os')
const chokidar = require('chokidar')
const config = require('./config.json')
const processImage = require('./lib').processImage

const username = os.userInfo().username
const watchPath = config.watchPath

function toJpeg(path) {
	console.log("running...");
	console.log(path);
	Jimp.read(path).then(function (imageConvert) {
	    imageConvert.quality(80)
	         .write("test.jpg"); // save 
		}).catch(function (err) {
	    console.error(err);
	});
}

let watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
});

watcher.on('add', path => path.endsWith('.png') && toJpeg(path))

