const gulp = require('gulp');
const htmlmin = require('gulp-htmlmin');        // minifies html files
const sass = require('gulp-sass');              // compiles sass and minifies html
const postcss = require('gulp-postcss');        // required by the autoprefixer
const autoprefixer = require('autoprefixer');   // adds vendor prefixes to html for better browser compatibility
const critical = require('critical').stream;    // inlines critical css styles and lazy loads the rest
const browserify = require('browserify');       // transpiles ES6 to ES5
const babelify = require('babelify');           // transpiles ES6 to ES5
const source = require('vinyl-source-stream');  // makes it easier to work with browserify
const buffer = require('vinyl-buffer');         // makes it easier to work with browserify
const uglify = require('gulp-uglify');          // minifies js code
const sourcemaps = require('gulp-sourcemaps');  // generates source maps
const imagemin = require('gulp-imagemin');      // optimizes images
const browserSync = require('browser-sync').create();   // development server
const del = require('del');                     // deletes a file or folder
const size = require('gulp-size');              // displays the size of the project
const rename = require('gulp-rename');          // renames a file
const runSequence = require('run-sequence');    // runs tasks sequentially (they run asynchronously by default)

// clean the dist directory
gulp.task('del', done =>
    del(['dist'], done)
);

/* ====================  HTML  ==================== */

// build html files
gulp.task('html-copy', () =>
    gulp.src('src/**/*.html')
        .pipe(gulp.dest('dist'))
);

// build html files
gulp.task('html-minify', () =>
    gulp.src('dist/**/*.html')
        .pipe(htmlmin({
            removeComments: true,
            collapseWhitespace: true
        }))
        .pipe(size())
        .pipe(gulp.dest('dist'))
);

// inline critical styles
gulp.task('critical', () =>
    gulp.src('dist/**/*.html')
        .pipe(critical({ base: 'dist/', inline: true, css: ['dist/css/main.css'] }))
        .pipe(gulp.dest('dist'))
);

gulp.task('html', done => runSequence('html-copy', 'critical', 'html-minify', () => done()))

// watch html files
gulp.task('html:watch', () =>
    gulp.watch('src/**/*.html', ['html'])
        .on('change', browserSync.reload)
);

/* ====================  SASS  ==================== */

/**
 * Bundles a sass file from a given entry path to a given output path
 * @param {*} param0 
 * @param {String} param0.entry - path to the entry file
 * @param {String} param0.output - path to the output file
 */
function bundleSASS({ entry, ouput } = { entry: 'src/sass/main.scss', ouput: 'dist/css/main.css' }) {
    const splitPath = ouput.split('/');
    const outputFile = splitPath[splitPath.length - 1];
    const outputDir = splitPath.slice(0, -1).join('/');

    return gulp.src(entry)
        .pipe(sourcemaps.init())
        .pipe(sass({ outputStyle: 'compressed' }).on('error', sass.logError))
        .pipe(postcss([autoprefixer('last 2 version', '>= 5%')]))
        .pipe(rename(outputFile))
        .pipe(sourcemaps.write('.'))
        .pipe(size())
        .pipe(gulp.dest(outputDir));
}

// build sass files
gulp.task('sass', () =>
    bundleSASS({
        entry: 'src/sass/main.scss',
        ouput: 'dist/css/main.css'
    }).pipe(browserSync.stream())
);

// watch sass files
gulp.task('sass:watch', () =>
    gulp.watch('src/sass/**/*.scss', ['sass'])
);

/**
 * Bundles a JavaScript file from a given entry path to a given output path
 * @param {*} param0 
 * @param {String} param0.entry - path to the entry file
 * @param {String} param0.output - path to the output file
 */
function bundleJS({ entry, ouput } = { entry: 'src/js/main.js', ouput: 'dist/js/main.js' }) {
    const splitPath = ouput.split('/');
    const outputFile = splitPath[splitPath.length - 1];
    const outputDir = splitPath.slice(0, -1).join('/');

    return browserify(entry)
        .transform(babelify, { presets: ['env'] })
        .bundle()
        .pipe(source(outputFile))
        .pipe(buffer())
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(size())
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(outputDir));
}

/* ====================  JAVASCRIPT  ==================== */

// main.js - main script
gulp.task('main', () =>
    bundleJS({
        entry: 'src/js/main.js',
        ouput: 'dist/js/main.js'
    })
);

// sw.js - service worker script
gulp.task('sw', () =>
    bundleJS({
        entry: 'src/sw.js',
        ouput: 'dist/sw.js'
    })
);

// build js files
gulp.task('js', ['main', 'sw']);

// watch js files
gulp.task('js:watch', () =>
    gulp.watch('src/js/**/*.js', ['js'])
        .on('change', browserSync.reload)
);

/* ====================  IMAGES  ==================== */

// build images for production
gulp.task('images:build', () =>
    gulp.src('src/images/**')
        .pipe(imagemin([
            imagemin.gifsicle({ interlaced: true }),
            imagemin.jpegtran({ progressive: true }),
            imagemin.optipng({ optimizationLevel: 7 })
        ]))
        .pipe(size())
        .pipe(gulp.dest('dist/images'))
);

// build images for development
gulp.task('images:dev', () =>
    gulp.src('src/images/**')
        .pipe(gulp.dest('dist/images'))
);

// watch images
gulp.task('images:watch', () =>
    gulp.watch('src/images/**', ['images:dev'])
        .on('change', browserSync.reload)
);

/* ====================  BROWSER-SYNC  ==================== */

gulp.task('browser-sync', () =>
    browserSync.init({
        server: {
            baseDir: 'dist'
        },
        port: 3000
    })
);

// production build
gulp.task('build:prod', done =>
    // first delete the dist folder
    // then build for production
    // sass has to run before html so that crtical styles cand be inlined
    runSequence('del', 'sass', ['html', 'js', 'images:build'], () => done())
);

// development build
gulp.task('build:dev', done =>
    // first delete the dist folder
    // then build for development
    // sass has to run before html so that crtical styles cand be inlined
    runSequence('del', 'sass', ['html', 'js', 'images:dev'], () => done())
);

// watch
gulp.task('watch', ['html:watch', 'js:watch', 'sass:watch', 'images:watch']);

// serve
gulp.task('serve', done =>
    // first build for development
    // then start watching files 
    // then start the development server
    runSequence('build:dev', 'watch', 'browser-sync', () => done())
);