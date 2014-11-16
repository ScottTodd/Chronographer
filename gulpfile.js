// starting reference: http://markgoodyear.com/2014/01/getting-started-with-gulp/

// Load and alias plugins.
var gulp = require('gulp'),
    sass = require('gulp-ruby-sass'),
    autoprefixer = require('gulp-autoprefixer'),
    minifycss = require('gulp-minify-css'),
    minifyhtml = require('gulp-minify-html'),
    jshint = require('gulp-jshint'),
    browserify = require('browserify'),
    transform = require('vinyl-transform'),
    uglify = require('gulp-uglify'),
    imagemin = require('gulp-imagemin'),
    rename = require('gulp-rename'),
    concat = require('gulp-concat'),
    notify = require('gulp-notify'),
    cache = require('gulp-cache'),
    connect = require('gulp-connect'),
    open = require('gulp-open'),
    run = require('gulp-run'),
    del = require('del');

// Styles
gulp.task('styles', function() {
  return gulp.src('src/styles/**/*.scss')
    .pipe(sass({ style: 'expanded', }))
    .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
    .pipe(concat('main.css'))
    .pipe(gulp.dest('dist/styles'))
    .pipe(rename({ suffix: '.min' }))
    .pipe(minifycss())
    .pipe(gulp.dest('dist/styles'))
    .pipe(connect.reload())
    .pipe(notify({ message: 'Styles task complete' }));
});

// Scripts
gulp.task('scripts', function() {
  var browserified = transform(function(filename) {
    var b = browserify([filename], {debug: true});
    return b.bundle();
  });

  // Check code quality with jshint.
  gulp.src(['src/js/**/*.js', '!src/js/shaders/*.js'])
    .pipe(jshint('.jshintrc'))
    .pipe(jshint.reporter('default'));

  // Browserify and uglify into dist folder.
  return gulp.src(['src/js/main.js'])
    .pipe(browserified)
    .pipe(gulp.dest('dist/scripts'))
    .pipe(rename({ suffix: '.min' }))
    .pipe(uglify())
    .pipe(gulp.dest('dist/scripts'))
    .pipe(connect.reload())
    .pipe(notify({ message: 'Scripts task complete' }));
});

// Shaders
gulp.task('shaders', function() {
  // Convert shaders into exported javascript strings.
  run('python util/convertGLSL.py').exec();

  return gulp.src('src/js/shaders/*.js')
    .pipe(notify({ message: 'Shaders task complete' }));
});

// HTML
gulp.task('html', function() {
  return gulp.src('src/html/**/*.html')
    .pipe(minifyhtml({ quotes: true }))
    .pipe(concat('chronographer.html'))
    .pipe(gulp.dest('dist/html'))
    .pipe(notify({ message: 'HTML task complete' }));
});

// Images
gulp.task('images', function() {
  return gulp.src('src/images/**/*')
    .pipe(cache(imagemin({ optimizationLevel: 3, progressive: true, interlaced: true })))
    .pipe(gulp.dest('dist/images'))
    .pipe(connect.reload())
    .pipe(notify({ message: 'Images task complete' }));
});

// Clean
gulp.task('clean', function(cb) {
    del(['dist/scripts', 'dist/styles', 'dist/images'], cb)
});

// Watch
gulp.task('watch', function() {
  gulp.watch('src/styles/**/*.scss', ['styles']);
  gulp.watch(['src/js/**/*.js', '!src/js/shaders/*.js'], ['scripts']);
  gulp.watch('src/js/**/*.glsl', ['shaders', 'scripts']);
  gulp.watch('src/html/**/*.html', ['html']);
  gulp.watch('src/images/**/*', ['images']);
});

gulp.task('connect', ['styles', 'scripts', 'shaders', 'images', 'html', 'watch'], function() {
    connect.server({
        livereload: true,
        port: 8080
    });

    gulp.src('./index.html')
      .pipe(open('', {
        url : 'http://localhost:8080/examples/location-history/index.html'
      }));
});

// Default task
gulp.task('default', ['connect']);

// Build once task
gulp.task('once', ['clean'], function() {
    gulp.start('styles', 'scripts', 'images');
});
