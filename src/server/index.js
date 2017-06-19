const path = require('path');
const process = require('process');
const os = require('os');
const express = require('express');
const chokidar = require('chokidar');
const fs = require('fs-extra');
const rimraf = require('rimraf');

let config = {};
try {
  config = require('../../config.json');
} catch (e) {
  console.log('config file "config.json" is not found');
}

const watchInterval = 1000;

const mainCssFile = 'main.css';
const mainLessFile = 'main.less';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-ui'));
console.log(`temporary working directory '${tmpDir}' is created`);

const pathToCss = path.join(tmpDir, mainCssFile);
const pathToLess = path.join(tmpDir, mainLessFile);

try {
  // create main.less file
  fs.outputFileSync(pathToLess, `
@import "${tmpDir}/resources/less/main.less";
@import (optional) "${tmpDir}/customization/less/main.less";`);
  console.log("The main.less was saved!");
} catch (err) {
  console.log(err);
}

const lessRecompile = function() {
  console.log(`start less file '${pathToLess}' recompiling into \n'${pathToCss}' file...`);

  // eslint-disable-next-line consistent-return
  fs.readFile(pathToLess, 'utf8', function(err, lessText) {
    if (err) {
      return console.log(err);
    }
    console.log(`\n---\n${lessText}\n----\n`);
    // eslint-disable-next-line max-len, consistent-return
    require('less').render(`@import "${tmpDir}/main.less";`, { relativeUrls: false, rootpath: 'fake' }, function(e, output) {
      if (e) {
        return console.log(e);
      }
      // eslint-disable-next-line consistent-return
      fs.writeFile(pathToCss, output.css, function(err) {
        if (err) {
          return console.log("Error writing file: " + err);
        }
      });
      // });console.log(output.css);
    });
  });
};

const directoryWatcher = (directory, callback) => {
  chokidar.watch(directory, {
    usePolling: true,
    interval: watchInterval,
    binaryInterval: watchInterval,
    alwaysStat: true,
    awaitWriteFinish: true
  }).on('all', callback);
};

const direrctoryWatchHandler = function(event, path, tmpPath) {
  if (event === 'change' || event === 'add') {
    fs.copy(path, tmpPath, function(err) {
      if (err) {
        console.error(err);
      }
    });
  }

  if (event === 'unlink' || event === 'unlinkDir') {
    fs.remove(tmpPath, function(err) {
      if (err) {
        console.error(err);
      }
    });
  }

  if ('ready') {
    // console.log('READY');
  }
};

const originalResourcesDirectory = path.join(__dirname, '../client/resources');
console.log("RESOURCES:", originalResourcesDirectory);
const temporaryResourcesDirectory = path.join(tmpDir, 'resources');

// Watcher for custom directory, ignores .dotfiles???
// eslint-disable-next-line no-unused-vars
const originalResourcesDirectoryWatcher = directoryWatcher(originalResourcesDirectory, (event, path) => {
  direrctoryWatchHandler(event, path, path.replace(originalResourcesDirectory, temporaryResourcesDirectory));
});

if (config.pathToCustomization) {
  console.log(`path to customization '${config.pathToCustomization}'`);

  const tmpCustomDir = path.join(tmpDir, 'customization');
  const customDir = path.join(config.pathToCustomization);

  // Watcher for custom directory, ignores .dotfiles
  // eslint-disable-next-line no-unused-vars
  const customDirWatcher = directoryWatcher(config.pathToCustomization, (event, path) => {
    direrctoryWatchHandler(event, path, path.replace(customDir, tmpCustomDir));
  });

}

let recompileLessTimer;
// Watcher for standard less files. Run less recompiling.???
// eslint-disable-next-line no-unused-vars
const temporaryResourcesDirectoryWatcher = directoryWatcher(path.join(tmpDir, '**/*.less'), (event, path) => {
  // console.log(`(event:${event}): ${path} is changed, recompiling less files`);
  // run less recompiling if less file was changed.
  clearTimeout(recompileLessTimer);
  recompileLessTimer = setTimeout(lessRecompile, 1000);
});

const app = express();
app.use(require('cors')());
app.use(require('compression')());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.get(`/${mainCssFile}`, (req, res) => {
  res.sendFile(pathToCss, function(err) {
    if (err) {
      console.log(err);
      res.status(err.status).end();
    }
  });
});

if (config.pathToCustomization) {
  app.use('/', express.static(path.join(tmpDir, 'customization')));
}
app.use('/', express.static(temporaryResourcesDirectory));
app.use('/demo', express.static(path.join(__dirname, '../client/demo')));

const port = process.env.PORT || 3042;
const host = 'localhost';
app.listen(port, host, (err) => {
  if (err) {
    console.log(err);
    return;
  }

  console.log(`Listening at http://${host}:${port}`);
});

const exitHandler = (options = { exit: false }) => {
  return (code) => {
    console.log(`about to exit with code '${code}'`);
    console.log(`... deleting temporary working directory '${tmpDir}'`);
    rimraf.sync(tmpDir);
    if (options.exit) {
      process.exit();
    }
  }
};

// the program will not close instantly
process.stdin.resume();
// do something when app is closing
process.on('exit', exitHandler());

// catches ctrl+c event
process.on('SIGINT', exitHandler({ exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler({ exit: true }));
