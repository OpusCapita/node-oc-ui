const npsUtils = require('nps-utils');
const path = require('path');
const series = npsUtils.series;
const rimraf = npsUtils.rimraf;
const mkdirp = npsUtils.mkdirp;
const copy = npsUtils.copy;

const stylesSrc = path.resolve(__dirname, './src/client/less/index.less');
const stylesDest = path.resolve(__dirname, './dist/css/index.css');

module.exports = {
  scripts: {
    "default": "nodemon --watch src/server src/server",
    "lint": {
      default: "eslint src",
      fix: "eslint src --fix"
    },
    "compile-css": {
      default: series(
        rimraf('dist/css'),
        mkdirp('dist/css'),
        `lessc --relative-urls ${stylesSrc} ${stylesDest}`,
        `postcss --use autoprefixer --use cssnano --no-map -o ${stylesDest} ${stylesDest}`
      )
    },
    "application-build": {
      default: series(
        rimraf('rimraf dist/application'),
        mkdirp('dist/application/src'),
        'ncp src/server dist/application/src/server',
        'ncp src/client dist/application/src/client',
        copy('configuration.json.sample dist/application'),
        // install prod dependencies only in speficific folder
        copy('package.json dist/application'),
        'npm install --prefix dist/application --only=production --no-bin-links --no-optional',
        rimraf('rimraf dist/application/package.json')
      )
    },
    "application-package": {
      default: series(
        'nps application-build',
        'mvn -Dversion=${npm_package_version} clean package'
      )
    },
    "application-deploy": {
      default: series(
        'nps application-build',
        'mvn -Dversion=${npm_package_version} clean deploy'
      )
    },
    "npm-build": {
      default: series(
        'nps compile-css',
        rimraf('rimraf dist/npm'),
        mkdirp('dist/npm'),
        "ncp src/client dist/npm",
        copy("dist/css/index.css dist/npm")
      )
    },
    "npm-publish": {
      default: series(
        'nps npm-build',
        'npm publish'
      )
    },
    "grails-plugin-build": {
      default: series(
        rimraf('rimraf dist/grails'),
        mkdirp('dist/grails'),
        // 'nps compile-css',
        // copy("dist/css/index.css dist/grails"),
        "ncp src/client dist/grails"
      )
    },
    "grails-plugin-package": {
      default: series(
        "nps grails-plugin-build",
        "grails-plugin-package --release"
      )
    },
    "grails-plugin-deploy": {
      default: series(
        "nps grails-plugin-package",
        "grails-plugin-deploy --release"
      )
    },
    "build-release": {
      default: npsUtils.concurrent.nps('application-package', 'grails-plugin-package', 'npm-build')
    },
    "publish-release": {
      default: series('nps application-deploy', 'nps grails-plugin-deploy', 'nps npm-publish')
    }
  }
}
