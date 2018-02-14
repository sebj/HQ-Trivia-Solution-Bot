var Jimp = require("jimp");
const os = require('os')
const chokidar = require('chokidar')
const config = require('./config.json')
const processImage = require('./lib').processImage

const username = os.userInfo().username
const watchPath = config.watchPath

function toJpeg(path) {
	console.log(path);
	Jimp.read(path).then(function (imageConvert) {
	    imageConvert.quality(80)
	         .write(config.watchPath + "/test.jpg"); // save
		}).catch(function (err) {
	    console.error(err);
	});
}

function solveQuestion(path) {
	console.log("Solving...");
	toJpeg(path);
	processImage(config.watchPath + "/test.jpg")
}

let watcher = chokidar.watch(watchPath, {
  ignored: /(^|[\/\\])\../,
  ignoreInitial: true,
  persistent: true
});

watcher.on('add', path => path.endsWith('.png') && solveQuestion(path))

