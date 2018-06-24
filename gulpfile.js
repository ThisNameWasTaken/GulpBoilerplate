const gulp = require('gulp');
const htmlmin = require('gulp-htmlmin');        // minifies html files
const sass = require('gulp-sass');              // transpiles sass to css
const cssnano = require('cssnano');             // minifies css
const postcss = require('gulp-postcss');        // required by the autoprefixer and cssnano
const autoprefixer = require('autoprefixer');   // adds vendor prefixes to html for better browser compatibility
const critical = require('critical').stream;    // inlines critical css styles and lazy loads the rest
const browserify = require('browserify');       // transpiles ES6 to ES5
const babelify = require('babelify');           // transpiles ES6 to ES5
const source = require('vinyl-source-stream');  // makes it easier to work with browserify
const buffer = require('vinyl-buffer');         // makes it easier to work with browserify
const uglify = require('gulp-uglify');          // minifies js code
const sourcemaps = require('gulp-sourcemaps');  // generates source maps
const imagemin = require('gulp-imagemin');      // optimizes images
const jsonminify = require('gulp-jsonminify');  // minifies json files
const browserSync = require('browser-sync').create();   // development server
const del = require('del');                     // deletes a file or folder
const sizereport = require('gulp-sizereport');  // displays the size of the project
const rename = require('gulp-rename');          // renames a file
const runSequence = require('run-sequence');    // runs tasks sequentially (they run asynchronously by default)
const plumber = require('gulp-plumber');        // prevents task chains from being ended even if there are errors
const rev = require('gulp-rev');                // handles static asset revisioning by appending content hash to filenames unicorn.css → unicorn-d41d8cd98f.css
const revRewrite = require('gulp-rev-rewrite'); // rewrites occurences of filenames which have been renamed
const revDelete = require('gulp-rev-delete-original'); // deletes original files after rev

const sourceDir = 'src';
const destDir = 'dist';

// clean the destination directory
gulp.task('del', done =>
    del([destDir], done)
);

/* ====================  HTML  ==================== */

// copy html files
gulp.task('html-copy', () =>
    gulp.src(`${sourceDir}/**/*.html`)
        .pipe(gulp.dest(destDir))
);

// minify html files
gulp.task('html-minify', () =>
    gulp.src(`${destDir}/**/*.html`)
        .pipe(htmlmin({
            removeComments: true,
            collapseWhitespace: true
        }))
        .pipe(gulp.dest(destDir))
);

// inline critical styles
gulp.task('critical', function () {
    const revManifest = require(`./${destDir}/rev-manifest.json`);
    console.log(`${destDir}/css/${revManifest['main.css']}`);
    return gulp.src(`${destDir}/**/*.html`)
        .pipe(critical({ base: destDir + '/', inline: true, css: [`${destDir}/css/${revManifest['main.css']}`] }))
        .pipe(gulp.dest(destDir))
});

gulp.task('html', done => runSequence('html-copy', 'revRewrite', 'critical', 'html-minify', () => done()));

// watch html files
gulp.task('html:watch', () =>
    gulp.watch(`${sourceDir}/**/*.html`, ['html'])
        .on('change', browserSync.reload)
);

/* ====================  SASS  ==================== */

/**
 * Bundles a sass file from a given entry path to a given output path
 * @param {*} param0 
 * @param {String} param0.entry - path to the entry file
 * @param {String} param0.output - path to the output file
 */
function bundleSASS({ entry, output } = { entry: `${sourceDir}/sass/main.scss`, output: `${destDir}/css/main.css` }) {
    const splitPath = output.split('/');
    const outputFile = splitPath[splitPath.length - 1];
    const outputDir = splitPath.slice(0, -1).join('/');

    return gulp.src(entry)
        .pipe(plumber())
        .pipe(sourcemaps.init())
        .pipe(sass({ includePaths: ['node_modules'] }).on('error', sass.logError))
        .pipe(postcss([autoprefixer('last 2 version', '>= 5%'), cssnano()]))
        .pipe(rename(outputFile))
        .pipe(rev())
        .pipe(revDelete()) // Remove the unrevved files
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(outputDir))
        .pipe(rev.manifest({
            base: './dist/',
            merge: true
        }))
        .pipe(gulp.dest('dist'));
}

// build sass files
gulp.task('sass', () =>
    bundleSASS({
        entry: `${sourceDir}/sass/main.scss`,
        output: `${destDir}/css/main.css`
    }).pipe(browserSync.stream())
);

// watch sass files
gulp.task('sass:watch', () =>
    gulp.watch(`${sourceDir}/sass/**/*.scss`, ['sass'])
);

/**
 * Bundles a JavaScript file from a given entry path to a given output path
 * @param {*} param0 
 * @param {String} param0.entry - path to the entry file
 * @param {String} param0.output - path to the output file
 */
function bundleJS({ entry, output } = { entry: `${sourceDir}/js/main.js`, output: `${destDir}/js/main.js` }) {
    const splitPath = output.split('/');
    const outputFile = splitPath[splitPath.length - 1];
    const outputDir = splitPath.slice(0, -1).join('/');

    return browserify(entry)
        .transform(babelify, {
            presets: ['env'],
            // fixes this error:
            // ParseError: 'import' and 'export' may appear only with 'sourceType: module'
            // https://github.com/babel/babelify#why-arent-files-in-node_modules-being-transformed
            global: true,
            ignore: /\/node_modules\/(?!.*\/)/
        })
        .bundle()
        .on('error', function (error) {
            console.error(error);
            this.emit('end');
        })
        .pipe(source(outputFile))
        .pipe(buffer())
        .pipe(sourcemaps.init())
        .pipe(uglify())
        .pipe(rev())
        .pipe(revDelete()) // Remove the unrevved files
        .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest(outputDir))
        .pipe(rev.manifest({
            base: './dist/',
            merge: true
        }))
        .pipe(gulp.dest('dist'));
}

/* ====================  JAVASCRIPT  ==================== */

// main.js - main script
gulp.task('main', () =>
    bundleJS({
        entry: `${sourceDir}/js/main.js`,
        output: `${destDir}/js/main.js`
    })
);

// sw.js - service worker script
gulp.task('sw', () =>
    bundleJS({
        entry: `${sourceDir}/sw.js`,
        output: `${destDir}/sw.js`
    })
);

// build js files
gulp.task('js', ['main', 'sw']);

// watch js files
gulp.task('js:watch', () =>
    gulp.watch(`${sourceDir}/js/**/*.js`, ['js'])
        .on('change', browserSync.reload)
);

/* ====================  JSON  ==================== */

// copy and minify json files
gulp.task('json', () =>
    gulp.src([`${sourceDir}/**/*.json`])
        .pipe(jsonminify())
        .pipe(gulp.dest(destDir))
);

// watch json files
gulp.task('json:watch', () =>
    // save the json changes as well js files
    // so all js files that use the changed json files
    // are updated
    gulp.watch(`${sourceDir}/**/*.json`, ['json', 'js'])
        .on('change', browserSync.reload)
);

/* ====================  IMAGES  ==================== */

// build images for production
gulp.task('images:build', () =>
    gulp.src(`${sourceDir}/images/**`)
        .pipe(imagemin([
            imagemin.gifsicle({ interlaced: true }),
            imagemin.jpegtran({ progressive: true }),
            imagemin.optipng({ optimizationLevel: 7 })
        ]))
        .pipe(gulp.dest(`${destDir}/images`))
);

// build images for development
gulp.task('images:dev', () =>
    gulp.src(`${sourceDir}/images/**`)
        .pipe(gulp.dest(`${destDir}/images`))
);

// watch images
gulp.task('images:watch', () =>
    gulp.watch(`${sourceDir}/images/**`, ['images:dev'])
        .on('change', browserSync.reload)
);

/* ====================  ASSET REVISION  ==================== */

gulp.task('copy-rev-manifest', () =>
    gulp.src('rev-manifest.json')
        .pipe(gulp.dest(destDir))
);

gulp.task('delete-rev-manifest', done =>
    del('rev-manifest.json', done)
);

gulp.task('move-rev-manifest', () =>
    runSequence('copy-rev-manifest', 'delete-rev-manifest')
);

gulp.task('revRewrite', function () {
    const manifest = gulp.src('dist/rev-manifest.json');

    return gulp.src('dist/**/*')
        .pipe(revRewrite({ manifest: manifest }))
        .pipe(gulp.dest('dist'));
});

/* ====================  SIZE  ==================== */

gulp.task('sizereport', () =>
    gulp.src([
        '!./dist/**/*.map', // ignore sourcemaps
        './dist/**/*'
    ]).pipe(sizereport({
        gzip: true
    }))
);

/* ====================  BROWSER-SYNC  ==================== */

gulp.task('browser-sync', () =>
    browserSync.init({
        server: {
            baseDir: destDir
        },
        port: 3000
    })
);

// production build
gulp.task('build:prod', done =>
    // first delete the destination folder
    // then build for production
    // sass has to run before html so that crtical styles cand be inlined
    runSequence('del', 'html-copy', ['sass', 'js', 'json', 'images:build'], 'move-rev-manifest', 'revRewrite', 'critical', 'html-minify', 'sizereport', () => done())
);

// development build
gulp.task('build:dev', done =>
    // first delete the destination folder
    // then build for development
    // sass has to run before html so that crtical styles cand be inlined
    runSequence('del', 'html-copy', ['sass', 'js', 'json', 'images:dev'], 'move-rev-manifest', 'revRewrite', 'critical', 'html-minify', 'sizereport', () => done())
);

// watch
gulp.task('watch', ['html:watch', 'js:watch', 'sass:watch', 'json:watch', 'images:watch']);

// serve
gulp.task('serve', done =>
    // first build for development
    // then start watching files 
    // then start the development server
    runSequence('build:dev', 'watch', 'browser-sync', () => done())
);