const fs = require("fs");
const path = require("path");
const {src, dest, series, parallel} = require("gulp");
const rename = require("gulp-rename");
const transform = require("gulp-transform");
const jsdoc2md = require("jsdoc-to-markdown");
const {info} = require("fancy-log");
const {magenta} = require("chalk");
const rimraf = require("rimraf");
const filter = require("gulp-filter");
const mkdirp = require("mkdirp");
const hasha = require("hasha");

const clubRoot = path.resolve(__dirname, "../Bondage-College/BondageClub");
const output = path.resolve(__dirname, "output");
const cacheDir = path.resolve(__dirname, ".cache");

let cache;
try {
    cache = require("./.cache/cache.json");
} catch {
    cache = {};
}

exports.clean = parallel(clean, cleanCache);
exports.cleanCache = series(cleanCache);
exports.markdown = series(markdownTask(true));
exports.markdownNoCache = series(cleanMarkdown, markdownTask(false));
exports.textile = series(
    cleanTextile,
    markdownTask(true),
    generateTextile,
);
exports.textileNoCache = series(
    parallel(cleanMarkdown, cleanTextile),
    markdownTask(false),
    generateTextile,
);

function clean(cb) {
    return rimraf(output, cb);
}

function cleanCache(cb) {
    return rimraf(cacheDir, cb);
}

function cleanMarkdown(cb) {
    return rimraf(path.join(output, "doc", "markdown"), cb);
}

function markdownTask(useCache) {
    return function generateMarkdown(cb) {
        return generateMarkdownTask(useCache, cb);
    };
}

function generateMarkdownTask(useCache, cb) {
    const stream = src([
        `${clubRoot}/**/*.js`,
        `!${clubRoot}/Tools/**`,
        `!${clubRoot}/Scripts/socket.io/**`,
        `!${clubRoot}/Scripts/three/**`,
        `!${clubRoot}/Scripts/webgl/**`,
    ])
        .pipe(filter((file => markdownFilter(file, useCache))))
        .pipe(transform("utf8", (content, file) => markdownTransform(content, file, useCache)))
        .pipe(filter(file => !!file.contents.length))
        .pipe(rename({extname: ".md"}))
        .pipe(dest(path.join(output, "doc", "markdown")));

    stream.on("end", () => {
        info(`Markdown generation complete${useCache ? ", saving cache..." : ""}`);
        if (useCache) {
            mkdirp(cacheDir).then(() => fs.writeFile(path.join(cacheDir, "cache.json"), JSON.stringify(cache), cb));
        } else {
            cb();
        }
    });
}

function markdownFilter(file, useCache) {
    if (!useCache) {
        return true;
    }
    const fileHash = hasha(file.contents);
    return fileHash !== cache[file.path];
}

function markdownTransform(content, file, useCache) {
    info(`Generating markdown for file ${magenta(file.path)}`);
    return jsdoc2md.render({source: content})
        .then(cache[file.path] = hasha(content));
}

function cleanTextile(cb) {
    return rimraf(path.join(output, "doc", "textile"), cb);
}

function generateTextile() {
    return src(`${output}/doc/markdown/**/*.md`)
        .pipe(transform("utf8", markdownToTextile))
        .pipe(rename({extname: ".textile"}))
        .pipe(dest(path.join(output, "doc", "textile")));
}

function markdownToTextile(markdown, file) {
    info(`Generating textile for file ${magenta(file.path)}`);
    const header = `h1. ${file.stem}\n\n{{>toc}}\n\n`;
    const constants = [];
    const content = markdown
        // Replace headings
        .replace(/^##\s*(Functions|Constants)\s*$/mg, "h2. $1")
        .replace(/^(#+)\s*(.+)?$/mg, (match, p1, p2) => `h${p1.length + 1}. ${p2}\n\n`)
        // Remove dl element
        .replace(/<dl>[\s\S]+?<\/dl>/g, "")
        // Translate code blocks
        .replace(/<\/?code>/g, "@")
        // Remove anchors
        .replace(/<a[\s\S]+?<\/a>/g, "")
        // Remove table heading separators
        .replace(/^(?:\|\s*-+\s*)+\|/mg, "")
        // Compress tables
        .replace(/\|\n+\|/g, "|\n|")
        // Replace escaped | characters
        .replace(/\\\|/g, "|")
        // Replace duplicated hyphens
        .replace(/(?:\s*-)+\s*/g, " - ")
        // Store global constant definitions
        .replace(/h3\.[\s\S]+?\*\*Kind\*\*:\s*global constant/g, (match) => {
            constants.push(match);
            return "";
        })
        // Put global constants in the right place
        .replace(/h2\. Constants/, match => {
            return `${match}\n\n${constants.join("\n\n")}`;
        })
        // Trim trailing whitespace
        .replace(/^(\s+)+$/mg, "")
        // Keep at most one consecutive empty line
        .replace(/\n{3,}/g, "\n\n");

    return header + content;
}
