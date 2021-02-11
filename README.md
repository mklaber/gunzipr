gunzipr
=======

Gunzip all files in a path, leaving the directory structure in place. This provides a quick way of un-gzipping multiple `*.gz` files in a directory, recursively.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/gunzipr.svg)](https://npmjs.org/package/gunzipr)
[![Downloads/week](https://img.shields.io/npm/dw/gunzipr.svg)](https://npmjs.org/package/gunzipr)
[![License](https://img.shields.io/npm/l/gunzipr.svg)](https://github.com/mklaber/gunzipr/blob/master/package.json)

## Usage

```sh-session
$ npm install -g gunzipr
$ gunzipr .
4 .gz file(s) found
3 .gz file(s) gunzipped
1 .gz file(s) failed
$ gunzipr --help
Gunzip all files in <path> recursively, leaving the directory structure in place.

USAGE
  $ gunzipr PATH
...
```
