const fs = require("fs");
const util = require("util");
const path = require("path");
const { src, dest, series, parallel } = require("gulp");
const rename = require("gulp-rename");
const transform = require("gulp-transform");
const jsdoc2md = require("jsdoc-to-markdown");
const { info } = require("fancy-log");
const { magenta } = require("chalk");
const rimraf = require("rimraf");
const filter = require("gulp-filter");
const mkdirp = require("mkdirp");
const hasha = require("hasha");

const writeFileAsync = util.promisify(fs.writeFile);

const clubRoot = path.resolve(__dirname, "../Bondage-College/BondageClub");
const output = path.resolve(__dirname, "output");
const cacheDir = path.resolve(__dirname, ".cache");

let cache;
try {
	cache = require("./.cache/cache.json");
} catch {
	cache = {
		markdown: {},
	};
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
	const undocumented = [];

	const stream = src([
		`${clubRoot}/**/*.js`,
		`!${clubRoot}/Tools/**`,
		`!${clubRoot}/Scripts/socket.io/**`,
		`!${clubRoot}/Scripts/three/**`,
		`!${clubRoot}/Scripts/webgl/**`,
		`!${clubRoot}/**/node_modules/**`,
	])
		.pipe(transform("utf8", (content, file) => markdownTransform(content, file, useCache)))
		.pipe(filter(file => {
			const hasDocs = !!file.contents.length;
			if (!hasDocs) {
				undocumented.push(file.relative);
			}
			return hasDocs;
		}))
		.pipe(rename({ extname: ".md" }))
		.pipe(dest(path.join(output, "doc", "markdown")));

	stream.on("end", () => {
		writeCache(useCache)
			.then(() => writeUndocumented(undocumented))
			.then(() => cb());
	});
}

function writeCache(useCache) {
	info(`Markdown generation complete${useCache ? ", saving cache..." : ""}`);
	return new Promise(resolve => {
		if (useCache) {
			mkdirp(cacheDir)
				.then(() => writeFileAsync(path.join(cacheDir, "cache.json"), JSON.stringify(cache)))
				.then(resolve);
		} else {
			resolve();
		}
	});
}

function writeUndocumented(undocumented) {
	info(`Markdown generation complete, recording undocumented files...`);
	const bullets = undocumented.sort().map(file => `* ${file}`);
	const markdown = `# Undocumented Files\n\n${bullets.join("\n")}`;
	return mkdirp(path.join(output, "doc")).then(() => writeFileAsync(path.join(output, "doc", "undocumented-files.md"), markdown));
}

function markdownTransform(content, file, useCache) {
	info(`Generating markdown for file ${magenta(file.path)}`);
	const markdownCache = cache.markdown = cache.markdown || {};
	const cacheEntry = cache.markdown[file.path];
	if (useCache && Array.isArray(cacheEntry) && hasha(content) === cacheEntry[0]) {
		return cacheEntry[1];
	} else {
		return jsdoc2md.render({ source: content })
			.then((markdown) => {
				if (useCache) {
					markdownCache[file.path] = [hasha(content), markdown];
				}
				return markdown;
			});
	}
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
    let content = markdown
        // Replace top-level headings
        .replace(/^##\s*(Functions|Constants|Typedefs)\s*$/mg, "h2. $1")
        // Replace other headings
        .replace(/^(#+)\s*(.+)?$/mg, (match, p1, p2) => `h${p1.length + 1}. ${p2}\n\n`)
        // Remove dl element
        .replace(/<dl>[\s\S]+?<\/dl>/g, "");

    // Split out the individual member definitions
    const sections = content.split(/<a name=".+?"><\/a>/);

    const partMap = {
        constant: [],
        function: [],
        typedef: [],
    };
    content = sections[0];
    // Break up the member definitions by member type
    sections.forEach(section => {
        const match = section.match(/\*\*Kind\*\*:\s*global\s*(constant|function|typedef)/);
        if (match) {
            partMap[match[1]].push(section);
        }
    });

    content = content
        // Move relevant member definitions under their correct section headings
        .replace(/h2.\s*(Constant|Function|Typedef)s/g, (match, p1) => {
            key = p1.toLowerCase();
            return `h2. ${p1}s\n\n${partMap[key].join("\n\n")}`;
        })
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
        // Trim trailing whitespace
        .replace(/^(\s+)+$/mg, "")
        // Keep at most one consecutive empty line
        .replace(/\n{3,}/g, "\n\n");

    return header + content;
}
