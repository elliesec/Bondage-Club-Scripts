# Bondage Club Scripts

A collection of useful scripts for the Bondage Club repositories.

**Important**: If you have just pulled down a new version of the repository, it is advisable to run the `clean` script before running any other scripts, otherwise strange things may happen. No attempt is currently being made to make changes backwards-compatible. 

Note that this repository is intended to sit alongside the `Bondage-College` and `Bondage-Club-Server` repositories:

```
- Root Directory
|-- Bondage-Club-Scripts
|-- Bondage-Club-Server
|-- Bondage-College
```

## Setup

Ensure you have Node.js and npm installed, and install dependencies with npm:

```
> npm i
```

## Available Scripts

### Cleaning

#### Clean

Completely removes the output and cache directories, allowing scripts to be run fresh.

```
> npm run clean
```

#### Clean Cache

Removes all caches, allowing them to be rebuilt on the next script run.

```
> npm run clean:cache
```

### Documentation

#### JSDoc

Generates JSDoc web pages in the `output/doc/jsdoc` directory.

```
> npm run jsdoc
```

#### Markdown

Generates Markdown documentation in the `output/doc/markdown` directory.

**Note:** This can take a little while to run for the first time.

```
> npm run markdown
```

To run without the markdown cache (does not delete the cache):

```
> npm run markdown:noCache
```

#### Textile

Generates documentation in the Textile markup format (for use in wikis) in the `output/doc/textile` directory.

**Note:** This can take a little while to run.

```
> npm run textile
```

To run without the markdown cache (does not delete the cache):

```
> npm run textile:noCache
```
