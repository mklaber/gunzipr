import {Command, flags} from '@oclif/command'
import * as klaw from 'klaw'
import {extname} from 'path'
import {
  statSync,
  createReadStream,
  createWriteStream,
  remove,
  pathExists,
} from 'fs-extra'
import {createGunzip} from 'zlib'
import {promisify} from 'util'

const regExpEscape = require('regex-escape')
import {pipeline} from 'stream'
const pipe = promisify(pipeline)

class Gunzipr extends Command {
  static description =
    'Gunzip all files in <path> recursively, leaving the directory structure in place.'

  static examples = [
    '$ gunzipr --keep .',
    '$ gunzipr --overwrite emr-backend-logs',
    '$ gunzipr --overwrite -S=.gzip /tmp/logs/2021-02-11',
  ]

  static flags = {
    version: flags.version({
      char: 'v',
      description: 'Display the current version.',
    }),
    help: flags.help({char: 'h', description: 'Display gunzipr help.'}),
    keep: flags.boolean({
      char: 'k',
      description: 'Keep (do not delete) input files during decompression.',
    }),
    suffix: flags.string({
      char: 'S',
      description: 'This option changes the default suffix from .gz to suffix.',
      default: '.gz',
    }),
    overwrite: flags.boolean({
      char: 'o',
      description: 'Overwrite (do not skip) output files during decompression.',
    }),
    verbose: flags.boolean({
      char: 'V',
      description:
        'This option makes gunzipr log each file that is gunzipped and deleted.',
      default: false,
    }),
  }

  static args = [
    {
      name: 'path',
      required: true,
      description: 'Path to gunzip (use `.` for the current directory).',
    },
  ]

  async run() {
    const {args, flags} = this.parse(Gunzipr)

    const extensionPattern = new RegExp(regExpEscape(flags.suffix) + '$', 'i')

    let filesFound = 0
    let filesGunzipped = 0
    let filesFailed = 0

    for await (const file of klaw(args.path, {
      filter: item => {
        const ext = extname(item)
        // we could do this filter inside the `for` and remove the need for fs.statSync
        // but by doing it this way we can keep klaw from having to statSync *everything*
        // so instead we just statSync directories.
        // n -- # of files
        // m -- # of gzip files
        // d -- # of directories
        // this makes us & klaw statSync m + d + d times
        // without it, we let klaw statSync n + d times
        // also, if we don't return `true` for directories, klaw won't recurse
        return extensionPattern.test(ext) || statSync(item).isDirectory()
      },
    }) as AsyncIterable<klaw.Item>) {
      if (file.stats.isDirectory()) {
        if (flags.verbose) {
          this.log(`[dir] ${file.path} is a directory, walk it`)
        }
        continue
      }

      filesFound += 1

      const destPath = file.path.replace(extensionPattern, '')
      const destExists = await pathExists(destPath)

      if (flags.verbose) {
        this.log(`[<- gz] ${file.path}`)
        if (destExists) {
          if (flags.overwrite) {
            this.warn(`[-> gz] (overwrite) ${destPath}`)
          } else {
            this.log(`[xx gz] skip ${file.path}`)
          }
        } else {
          this.log(`[-> gz] ${destPath}`)
        }
      }

      if (destExists && !flags.overwrite) {
        continue
      }

      filesGunzipped += 1

      const gunzip = createGunzip()
      const source = createReadStream(file.path)
      const destination = createWriteStream(destPath)

      try {
        await pipe(source, gunzip, destination)
      } catch (error) {
        filesFailed += 1
        if (error.code === 'Z_DATA_ERROR') {
          this.warn(`[!! gz] failed ${file.path}`)
          continue
        } else {
          throw error
        }
      }

      if (!flags.keep) {
        if (flags.verbose) {
          this.log(`[rm] ${file.path}`)
        }

        await remove(file.path)
      }
    }

    this.log(`${filesFound} ${flags.suffix} file(s) found`)
    this.log(`${filesGunzipped} ${flags.suffix} file(s) gunzipped`)
    this.log(`${filesFailed} ${flags.suffix} file(s) failed`)
  }
}

export = Gunzipr
