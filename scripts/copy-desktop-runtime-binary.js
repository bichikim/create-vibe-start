// Node ESM requires an explicit extension when this script runs outside a bundler.
// oxlint-disable-next-line import/extensions
import {copyGithubCliBinary} from './desktop-runtime-files.js'

const arguments_ = process.argv.slice(2)
await copyGithubCliBinary(...arguments_)
