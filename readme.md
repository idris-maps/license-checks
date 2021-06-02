# license-checks

## Install

```
npm install license-checks
```

## Usage

```
license-checks
```

### Options

* `--deep` check all modules in `node_modules` (defaults to `dependencies` and `devDependencies`)
* `--only-prod` check only `dependencies` in `package.json` (defaults to `dependencies` and `devDependencies`)
* `--count` only log license count (defaults to throwing an error when licenses are not whitelisted)
* `--config FILE` set the path to the config file (defaults to `allowed-licenses.json`)

### Config file

You must have a config file. Either `allowed-licenses.json` or another JSON file (if defined with `--config`)

The JSON may have two keys:

* `whitelist` (`string[]`) a list of whitelisted licenses
* `exceptions` (`{ package: string, license: string[] }`) exceptions by package and license

**Example file**

```json
{
  "whitelist": [
    "GPLv2",
    "MIT",
  ],
  "exceptions": [
    {
      "package": "some-commercial-package-i-have-a-license-for",
      "license": "commercial"
    }
  ]
}
```
