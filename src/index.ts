import { readFile, readdir } from 'fs'
import { promisify } from 'util'
import { resolve } from 'path'

const ls = async (folder: string): Promise<string[]> => {
  try {
    return promisify(readdir)(folder)
  } catch (e) {
    return []
  }
}
const read = promisify(readFile)
const readJSON = async (path: string) =>
  JSON.parse(await read(path, 'utf-8'))

interface Config {
  deep: boolean
  file: string
  onlyCount: boolean
  onlyProd: boolean
}

interface PkgLicense {
  package: string
  license: string
}

interface ConfigFile {
  whitelist: string[]
  exceptions: PkgLicense[]
}

const isPkgLicense = (d: any): d is PkgLicense =>
  d && d.package && d.license
  && d.package === String(d.package)
  && d.license === String(d.license)

const defaultConfig: Config = {
  deep: false,
  file: 'allowed-licenses.json',
  onlyCount: false,
  onlyProd: false,
}

const parseArgs = () =>
  process.argv.reduce((r, d, i, args): Config => {
    if (d === '--deep') { return { ...r, deep: true } }
    if (d === '--only-prod') { return { ...r, onlyProd: true } }
    if (d === '--count') { return { ...r, onlyCount: true } }
    const nextArg = args[i + 1]
    if (
      d === '--config'
      && nextArg
      && String(nextArg).endsWith('.json')
    ) {
      return { ...r, file: String(nextArg) }
    }
    return r
  }, defaultConfig)

const getPackageLicense = async (pathToPackageJson: string): Promise<string> => {
  const json = await readJSON(pathToPackageJson)
  return json?.license || 'No license in package.json'
}

const addLicense = async (pkg: string): Promise<PkgLicense> => ({
  package: pkg,
  license: await getPackageLicense(resolve('node_modules', pkg, 'package.json')),
})

const readConfigFile = async ({ file }: Config): Promise<ConfigFile> => {
  try {
    const json = await readJSON(file)
    return {
      whitelist: json?.whitelist || [],
      exceptions: (json?.exceptions || []).filter(isPkgLicense),
    }
  } catch (e) {
    console.log(e)
    throw `Could not read config from ${file}`
  }
}

const getDependencies = async (): Promise<{ prod: string[], dev: string[] }> => {
  try {
    const json = await readJSON('package.json')
    return {
      prod: Object.keys(json?.dependencies || {}),
      dev: Object.keys(json?.devDependencies || {}),
    }
  } catch (e) {
    console.log(e)
    throw 'Could not read package.json'
  }
}

const countLicenses = (all: PkgLicense[]) =>
  all
    .reduce((r: {[key: string]: number}, d: PkgLicense): {[key: string]: number} =>
      r[d.license]
        ? { ...r, [d.license]: r[d.license] + 1 }
        : { ...r, [d.license]: 1 },
      {},
    )

const getAllModules = async (): Promise<string[]> => [
  ...(await ls('node_modules')).filter(d => !d.startsWith('.') && !d.startsWith('@')),
  ...(await ls('node_modules/@types')).map(d => `@types/${d}`),
]

const run = async () => {
  const config = await parseArgs()
  const { whitelist, exceptions } = await readConfigFile(config)
  const { prod, dev } = await getDependencies()

  const packages = config.deep
    ? await getAllModules()
    : [...prod, ...(config.onlyProd ? [] : dev)]

  const packagesWithLicense = await Promise.all(
    packages.map(addLicense)
  )

  console.log([
    'License count:',
    JSON.stringify(countLicenses(packagesWithLicense), null, 2),
  ].join('\n'))

  const isException = (pkg: PkgLicense) =>
    Boolean(
      exceptions.find(d =>
        d.license === pkg.license
        && d.package === pkg.package
      )
    )
  
  const notWhitelisted = packagesWithLicense.filter(d => !whitelist.includes(d.license))
  const errors = notWhitelisted.filter(d => !isException(d))

  if (!config.onlyCount && errors.length !== 0) {
    console.log([
      'Not allowed licenses:',
      JSON.stringify(errors, null, 2),
    ].join('\n'))
    throw new Error('Some dependencies use not allowed licenses')
  }
}

run()
