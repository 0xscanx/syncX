var webpack = require('webpack');
var webpackConfigFunc = require('./webpack.config');
var gulp = require('gulp');
var zip = require('gulp-zip');
var clean = require('gulp-clean');
var jsoncombine = require('gulp-jsoncombine');
var minimist = require('minimist');
var packageConfig = require('./package.json');
const { exit } = require('process');
const uglify = require('gulp-uglify');

//parse arguments
var knownOptions = {
  string: ['env', 'browser'],
  default: {
    env: 'dev',
    browser: 'chrome'
  }
};

var supported_envs = ['dev', 'pro'];
var brandName = 'SyncX';
var version = packageConfig.version;
var validVersion = version.split('-beta')[0];
var options = {
  env: knownOptions.default.env,
  browser: knownOptions.default.browser
};
options = minimist(process.argv.slice(2), knownOptions);
if (!supported_envs.includes(options.env)) {
  console.error(`not supported env: [${options.env}]. It should be one of ${supported_envs.join(', ')}.`);
  exit(0);
}

//tasks...
function task_clean() {
  return gulp.src(`dist/${options.browser}/*`, { read: false }).pipe(clean());
}

function task_prepare() {
  return gulp.src('build/_raw/**/*').pipe(gulp.dest(`dist/${options.browser}`));
}

function task_merge_manifest() {
  let baseFile = '_base_v3';
  return gulp
    .src([
      `dist/${options.browser}/manifest/${baseFile}.json`,
      `dist/${options.browser}/manifest/${options.browser}.json`
    ])
    .pipe(
      jsoncombine('manifest.json', (data, meta) => {
        const result = Object.assign({}, data[baseFile], data[options.browser]);
        result.version = validVersion;
        return Buffer.from(JSON.stringify(result));
      })
    )
    .pipe(gulp.dest(`dist/${options.browser}`));
}

function task_clean_tmps() {
  return gulp.src(`dist/${options.browser}/manifest`, { read: false }).pipe(clean());
}

function task_webpack(cb) {
  webpack(
    webpackConfigFunc({
      version: validVersion,
      config: options.env,
      browser: options.browser,
      manifest: options.manifest,
      channel: options.channel
    }),
    (err, stats) => {
      if (err) {
        console.error('Webpack error:', err.stack || err);
        if (err.details) {
          console.error('Webpack error details:', err.details);
        }
        cb(err); // 通过回调传递错误，这会导致 Gulp 任务失败
        return;
      }

      const info = stats.toJson();

      if (stats.hasErrors()) {
        console.error('Webpack compilation errors:');
        info.errors.forEach((error) => console.error(error));
        cb(new Error('Webpack compilation failed'));
        return;
      }

      if (stats.hasWarnings()) {
        console.warn('Webpack compilation warnings:');
        info.warnings.forEach((warning) => console.warn(warning));
      }

      // 如果没有错误，打印一些基本的统计信息
      console.log(
        stats.toString({
          chunks: false, // 使构建过程更少冗长
          colors: true // 在控制台中显示颜色
        })
      );

      cb();
    }
  );
}

function task_uglify(cb) {
  if (options.env == 'pro') {
    return gulp
      .src(`dist/${options.browser}/**/*.js`)
      .pipe(uglify())
      .pipe(gulp.dest(`dist/${options.browser}`));
  }
  cb();
}

function task_package(cb) {
  if (options.env == 'pro') {
    if (options.browser == 'firefox') {
      return gulp
        .src(`dist/${options.browser}/**/*`)
        .pipe(zip(`${brandName}-${options.browser}-${options.manifest}-v${version}.xpi`))
        .pipe(gulp.dest('./dist'));
    } else {
      return gulp
        .src(`dist/${options.browser}/**/*`)
        .pipe(zip(`${brandName}-${options.browser}-v${version}.zip`))
        .pipe(gulp.dest('./dist'));
    }
  }
  cb();
}

exports.build = gulp.series(
  task_clean,
  task_prepare,
  task_merge_manifest,
  task_clean_tmps,
  task_webpack,
  // task_uglify,
  task_package
);
