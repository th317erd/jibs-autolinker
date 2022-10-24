#!/bin/env node

const Path = require('node:path');
const FileSystem = require('node:fs');

function loadConfig() {
  try {
    let config = require(Path.resolve(process.cwd(), '.jibs-autolinker.json'));
    return config;
  } catch (error) {
    return {};
  }
}

function _getModulesPath() {
  let config = loadConfig();
  if (config && config['modules'])
    return Path.resolve(process.cwd(), config['modules']);

  let publicPath = Path.resolve(process.cwd(), 'public');
  if (FileSystem.existsSync(publicPath)) {
    let stats = FileSystem.statSync(publicPath);
    if (stats.isDirectory())
      return Path.resolve(publicPath, 'modules');
  }

  return Path.resolve(process.cwd(), 'modules');
}

function getNodeModulesPath() {
  let config = loadConfig();
  if (config && config['node_modules'])
    return Path.resolve(process.cwd(), config['node_modules']);

  return Path.resolve(process.cwd(), 'node_modules');
}

function getModulesPath() {
  let modulePath = _getModulesPath();

  try {
    FileSystem.mkdirSync(modulePath, { recursive: true });
  } catch (error) {}

  return modulePath;
}

function loadModulePackageJSON(modulePath) {
  try {
    return require(Path.join(modulePath, 'package.json'));
  } catch (error) {}
}

function getModuleInfo(modulePath) {
  let packageJSON = loadModulePackageJSON(modulePath);
  if (!packageJSON)
    return {};

  if (typeof packageJSON.browser !== 'string')
    return {};

  return packageJSON;
}

function cleanModules(modulesPath) {
  let fileNames = FileSystem.readdirSync(modulesPath);

  for (let i = 0, il = fileNames.length; i < il; i++) {
    let fileName      = fileNames[i];
    let fullFileName  = Path.join(modulesPath, fileName);
    let stats         = FileSystem.lstatSync(fullFileName);

    if (!stats.isSymbolicLink())
      continue;

    FileSystem.unlinkSync(fullFileName);
  }
}

function linkModules(nodeModulePath, modulesPath, _depth) {
  let depth       = _depth || 0;
  let moduleDirs  = FileSystem.readdirSync(nodeModulePath);
  let config      = loadConfig();

  for (let i = 0, il = moduleDirs.length; i < il; i++) {
    let moduleDir = moduleDirs[i];
    if (moduleDir.charAt(0) === '.')
      continue;

    if (config && Array.isArray(config.include) && config.include.indexOf(moduleDir) < 0)
      continue;

    if (config && Array.isArray(config.exclude) && config.exclude.indexOf(moduleDir) >= 0)
      continue;

    let fullModuleDir = Path.join(nodeModulePath, moduleDir);

    if (moduleDir.charAt(0) === '@' && depth === 0) {
      linkModules(fullModuleDir, modulesPath, depth + 1);
      continue;
    }

    let { browser: browserPath, name } = getModuleInfo(fullModuleDir);
    if (!browserPath)
      continue;

    let sourcePath = Path.join(modulesPath, name || moduleDir);
    let targetPath = Path.dirname(Path.resolve(fullModuleDir, browserPath));

    if (process.platform === 'win32') {
      FileSystem.symlinkSync(targetPath, sourcePath);
    } else {
      FileSystem.symlinkSync(targetPath, sourcePath);
    }
  }

  return moduleDirs;
}

(function() {
  let modulesPath = getModulesPath();

  cleanModules(modulesPath);
  linkModules(getNodeModulesPath(), modulesPath);
})();
