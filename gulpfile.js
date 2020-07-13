const path = require("path");
const {src, dest, series, parallel} = require("gulp");
const rename = require("gulp-rename");
const transform = require("gulp-transform");
const jsdoc2md = require("jsdoc-to-markdown");
const {info} = require("fancy-log");
const {magenta} = require("chalk");
const rimraf = require("rimraf");
const filter = require("gulp-filter");

const clubRoot = path.resolve(__dirname, "../Bondage-College/BondageClub");
const output = path.resolve(__dirname, "output");

exports.markdown = series(cleanMarkdown, generateMarkdown);
exports.textile = series(
    parallel(cleanMarkdown, cleanTextile),
    generateMarkdown,
    generateTextile,
);

function cleanMarkdown(cb) {
    return rimraf(path.join(output, "doc", "markdown"), cb);
}

function generateMarkdown() {
    return src([
        `${clubRoot}/**/*.js`,
        `!${clubRoot}/Tools/**`,
        `!${clubRoot}/Scripts/socket.io/**`,
        `!${clubRoot}/Scripts/three/**`,
        `!${clubRoot}/Scripts/webgl/**`,
    ])
        .pipe(transform("utf8", markdownTransform))
        .pipe(filter(file => !!file.contents.length))
        .pipe(rename({extname: ".md"}))
        .pipe(dest(path.join(output, "doc", "markdown")));
}

function markdownTransform(content, file) {
    info(`Generating markdown for file ${magenta(file.path)}`);
    return jsdoc2md.render({source: content});
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
    const content = markdown
        // Replace headings
        .replace(/^##\s*Functions\s*$/m, "h2. Functions")
        .replace(/^(#+)\s*(.+)?$/mg, (match, p1, p2) => `h${p1.length + 1}. ${p2}\n\n`)
        // Remove dl element
        .replace(/<dl>[\s\S]+<\/dl>/, "")
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
        // Keep at most one consecutive empty line
        .replace(/\n{3,}/g, "\n\n");
    return header + content;
}
