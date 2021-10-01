import JsonFile from '@expo/json-file';
import fs from 'fs-extra';
import { sync as globSync } from 'glob';
import indentString from 'indent-string';
import path from 'path';

import { parseSdkMajorVersion } from './ExponentTools';

function _validatePodfileSubstitutions(substitutions) {
  const validKeys = [
    // a pod dependency on ExpoKit (can be local or remote)
    'EXPOKIT_DEPENDENCY',
    // local path to ExpoKit dependency
    'EXPOKIT_PATH',
    // tag to use for ExpoKit dependency
    'EXPOKIT_TAG',
    // the contents of dependencies.json enumerated as deps in podfile format
    'EXPONENT_CLIENT_DEPS',
    // postinstall for detached projects (defines EX_DETACHED among other things)
    'PODFILE_DETACHED_POSTINSTALL',
    // same as previous but also defines EX_DETACHED_SERVICE
    'PODFILE_DETACHED_SERVICE_POSTINSTALL',
    // ExponentIntegrationTests
    'PODFILE_TEST_TARGET',
    // unversioned react native pod dependency, probably at the path given in
    // REACT_NATIVE_PATH, with a bunch of subspecs.
    'PODFILE_UNVERSIONED_RN_DEPENDENCY',
    // postinstall hook for unversioned deps
    'PODFILE_UNVERSIONED_POSTINSTALL',
    // versioned rn dependencies (paths to versioned-react-native directories)
    // read from template files
    'PODFILE_VERSIONED_RN_DEPENDENCIES',
    // versioned rn postinstall hooks read from template files
    'PODFILE_VERSIONED_POSTINSTALLS',
    // list of generated Expo subspecs to include under a versioned react native dependency
    'REACT_NATIVE_EXPO_SUBSPECS',
    // path to use for the unversioned react native dependency
    'REACT_NATIVE_PATH',
    // name of the main build target, e.g. Exponent
    'TARGET_NAME',
    // path from Podfile to versioned-react-native
    'VERSIONED_REACT_NATIVE_PATH',
    // Expo universal modules dependencies
    'PODFILE_UNVERSIONED_EXPO_MODULES_DEPENDENCIES',
    // Universal modules configurations to be included in the Podfile
    'UNIVERSAL_MODULES',
    // Relative path from iOS project directory to folder where unimodules are installed.
    'UNIVERSAL_MODULES_PATH',
  ];

  for (const key in substitutions) {
    if (substitutions.hasOwnProperty(key)) {
      if (!validKeys.includes(key)) {
        throw new Error(`Unrecognized Podfile template key: ${key}`);
      }
    }
  }
  return true;
}

/**
 * @param sdkVersion if specified, indicates which sdkVersion this project uses
 *  as 'UNVERSIONED', e.g. if we are detaching a sdk15 project, we render
 *  an unversioned dependency pointing at RN#sdk-15.
 */
function _renderUnversionedReactNativeDependency(options, sdkVersion) {
  const sdkMajorVersion = parseSdkMajorVersion(sdkVersion);

  if (sdkMajorVersion >= 39) {
    return indentString(`
# Install React Native and its dependencies
require_relative '../node_modules/react-native/scripts/react_native_pods'
use_react_native!(production: true)`);
  }

  if (sdkMajorVersion >= 36) {
    return indentString(
      `
# Install React Native and its dependencies
require_relative '../node_modules/react-native/scripts/autolink-ios.rb'
use_react_native!`
    );
  }

  const glogLibraryName = sdkMajorVersion < 26 ? 'GLog' : 'glog';
  return indentString(
    `
${_renderUnversionedReactDependency(options)}
${_renderUnversionedYogaDependency(options)}
${_renderUnversionedThirdPartyDependency(
  'DoubleConversion',
  path.join('third-party-podspecs', 'DoubleConversion.podspec'),
  options
)}
${_renderUnversionedThirdPartyDependency(
  'Folly',
  path.join('third-party-podspecs', 'Folly.podspec'),
  options
)}
${_renderUnversionedThirdPartyDependency(
  glogLibraryName,
  path.join('third-party-podspecs', `${glogLibraryName}.podspec`),
  options
)}
`,
    2
  );
}

function _renderUnversionedReactDependency(options, sdkVersion) {
  if (!options.reactNativePath) {
    throw new Error(`Unsupported options for RN dependency: ${options}`);
  }
  const attributes = {
    path: options.reactNativePath,
    inhibit_warnings: true,
    subspecs: [
      'Core',
      'ART',
      'RCTActionSheet',
      'RCTAnimation',
      'RCTCameraRoll',
      'RCTGeolocation',
      'RCTImage',
      'RCTNetwork',
      'RCTText',
      'RCTVibration',
      'RCTWebSocket',
      'DevSupport',
      'CxxBridge',
    ],
  };
  return `pod 'React',
${indentString(_renderDependencyAttributes(attributes), 2)}`;
}

function _renderUnversionedYogaDependency(options) {
  let attributes;
  if (options.reactNativePath) {
    attributes = {
      path: path.join(options.reactNativePath, 'ReactCommon', 'yoga'),
      inhibit_warnings: true,
    };
  } else {
    throw new Error(`Unsupported options for Yoga dependency: ${options}`);
  }
  return `pod 'yoga',
${indentString(_renderDependencyAttributes(attributes), 2)}`;
}

function _renderUnversionedThirdPartyDependency(podName, podspecRelativePath, options) {
  let attributes;
  if (options.reactNativePath) {
    attributes = {
      podspec: path.join(options.reactNativePath, podspecRelativePath),
      inhibit_warnings: true,
    };
  } else {
    throw new Error(`Unsupported options for ${podName} dependency: ${options}`);
  }
  return `pod '${podName}',
${indentString(_renderDependencyAttributes(attributes), 2)}`;
}

function _renderDependencyAttributes(attributes) {
  const attributesStrings = [];
  for (const key of Object.keys(attributes)) {
    const value = JSON.stringify(attributes[key], null, 2);
    attributesStrings.push(`:${key} => ${value}`);
  }
  return attributesStrings.join(',\n');
}

function createSdkFilterFn(sdkVersion) {
  if (sdkVersion && String(sdkVersion).toUpperCase() === 'UNVERSIONED') {
    return () => false;
  }
  if (sdkVersion === undefined || !sdkVersion.match(/^\d+\.\d+.\d+$/)) {
    return;
  }
  const sdkVersionWithUnderscores = sdkVersion.replace(/\./g, '_');
  return i => i.endsWith(`/ReactABI${sdkVersionWithUnderscores}.rb`);
}

async function _renderVersionedReactNativeDependenciesAsync(
  templatesDirectory,
  versionedReactNativePath,
  expoSubspecs,
  shellAppSdkVersion
) {
  const filterFn = createSdkFilterFn(shellAppSdkVersion);
  let result = await _concatTemplateFilesInDirectoryAsync(
    path.join(templatesDirectory, 'versioned-react-native', 'dependencies'),
    filterFn
  );
  expoSubspecs = expoSubspecs.map(subspec => `'${subspec}'`).join(', ');
  result = result.replace(/\$\{VERSIONED_REACT_NATIVE_PATH\}/g, versionedReactNativePath);
  result = result.replace(/\$\{REACT_NATIVE_EXPO_SUBSPECS\}/g, expoSubspecs);
  return result;
}

async function _renderVersionedReactNativePostinstallsAsync(
  templatesDirectory,
  shellAppSdkVersion
) {
  const filterFn = createSdkFilterFn(shellAppSdkVersion);
  return _concatTemplateFilesInDirectoryAsync(
    path.join(templatesDirectory, 'versioned-react-native', 'postinstalls'),
    filterFn
  );
}

async function _concatTemplateFilesInDirectoryAsync(directory, filterFn) {
  const templateFilenames = globSync('*.rb', { absolute: true, cwd: directory }).sort();
  const filteredTemplateFilenames = filterFn
    ? templateFilenames.filter(filterFn)
    : templateFilenames;
  const templateStrings = [];
  // perform this in series in order to get deterministic output
  for (let fileIdx = 0, nFiles = filteredTemplateFilenames.length; fileIdx < nFiles; fileIdx++) {
    const filename = filteredTemplateFilenames[fileIdx];
    const templateString = await fs.readFile(filename, 'utf8');
    if (templateString) {
      templateStrings.push(templateString);
    }
  }
  return templateStrings.join('\n');
}

function _renderDetachedPostinstall(sdkVersion, isServiceContext) {
  const sdkMajorVersion = parseSdkMajorVersion(sdkVersion);
  const podNameExpression = sdkMajorVersion < 33 ? 'target.pod_name' : 'pod_name';
  const targetExpression = sdkMajorVersion < 33 ? 'target' : 'target_installation_result';

  const podsRootSub = '${PODS_ROOT}';
  const maybeDetachedServiceDef = isServiceContext
    ? `config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'EX_DETACHED_SERVICE=1'`
    : '';

  const maybeFrameworkSearchPathDef =
    sdkMajorVersion < 33
      ? `
          # Needed for GoogleMaps 2.x
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] ||= []
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '${podsRootSub}/GoogleMaps/Base/Frameworks'
          config.build_settings['FRAMEWORK_SEARCH_PATHS'] << '${podsRootSub}/GoogleMaps/Maps/Frameworks'`
      : '';
  // In SDK39, in preparation for iOS 14 we've decided to remove IDFA code.
  // By adding this macro to shell apps we'll remove this code from Branch
  // on compilation level, see:
  // https://github.com/BranchMetrics/ios-branch-deep-linking-attribution/blob/ac991f9d0bc9bad640b25a0f1192679a8cfa083a/Branch-SDK/BNCSystemObserver.m#L49-L75
  const excludeIdfaCodeFromBranchSinceSDK39 =
    sdkMajorVersion >= 39
      ? `
      if ${podNameExpression} == 'Branch'
        ${targetExpression}.native_target.build_configurations.each do |config|
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'BRANCH_EXCLUDE_IDFA_CODE=1'
        end
      end`
      : '';
  return `
      if ${podNameExpression} == 'ExpoKit'
        ${targetExpression}.native_target.build_configurations.each do |config|
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'EX_DETACHED=1'
          ${maybeDetachedServiceDef}
          # Enable Google Maps support
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HAVE_GOOGLE_MAPS=1'
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'HAVE_GOOGLE_MAPS_UTILS=1'
          ${maybeFrameworkSearchPathDef}
        end
      end

      ${excludeIdfaCodeFromBranchSinceSDK39}
`;
}

function _renderTestTarget(reactNativePath) {
  return `
  target 'ExponentIntegrationTests' do
    inherit! :search_paths
  end

  target 'Tests' do
    inherit! :search_paths
  end
`;
}

async function _renderPodDependenciesAsync(dependenciesConfigPath, options) {
  const dependencies = await new JsonFile(dependenciesConfigPath).readAsync();
  const type = options.isPodfile ? 'pod' : 'ss.dependency';
  const noWarningsFlag = options.isPodfile ? `, :inhibit_warnings => true` : '';
  const depsStrings = dependencies.map(dependency => {
    let builder = '';
    if (dependency.comments) {
      builder += dependency.comments.map(commentLine => `  # ${commentLine}`).join('\n');
      builder += '\n';
    }
    const otherPodfileFlags = options.isPodfile && dependency.otherPodfileFlags;
    builder += `  ${type} '${dependency.name}', '${dependency.version}'${noWarningsFlag}${
      otherPodfileFlags || ''
    }`;
    return builder;
  });
  return depsStrings.join('\n');
}

async function renderExpoKitPodspecAsync(pathToTemplate, pathToOutput, moreSubstitutions) {
  const templatesDirectory = path.dirname(pathToTemplate);
  const templateString = await fs.readFile(pathToTemplate, 'utf8');
  const dependencies = await _renderPodDependenciesAsync(
    path.join(templatesDirectory, 'dependencies.json'),
    { isPodfile: false }
  );
  let result = templateString.replace(/\$\{IOS_EXPOKIT_DEPS\}/g, indentString(dependencies, 2));
  if (moreSubstitutions && moreSubstitutions.IOS_EXPONENT_CLIENT_VERSION) {
    result = result.replace(
      /\$\{IOS_EXPONENT_CLIENT_VERSION\}/g,
      moreSubstitutions.IOS_EXPONENT_CLIENT_VERSION
    );
  }

  await fs.writeFile(pathToOutput, result);
}

/**
 *  @param pathToTemplate path to template Podfile
 *  @param pathToOutput path to render final Podfile
 *  @param moreSubstitutions dictionary of additional substitution keys and values to replace
 *         in the template, such as: TARGET_NAME, REACT_NATIVE_PATH
 */
async function renderPodfileAsync(
  pathToTemplate,
  pathToOutput,
  moreSubstitutions,
  shellAppSdkVersion,
  sdkVersion = 'UNVERSIONED'
) {
  if (!moreSubstitutions) {
    moreSubstitutions = {};
  }
  const templatesDirectory = path.dirname(pathToTemplate);
  const templateString = await fs.readFile(pathToTemplate, 'utf8');

  const reactNativePath = moreSubstitutions.REACT_NATIVE_PATH;
  let rnDependencyOptions;
  if (reactNativePath) {
    rnDependencyOptions = { reactNativePath };
  } else {
    rnDependencyOptions = {};
  }

  const expoKitPath = moreSubstitutions.EXPOKIT_PATH;
  const expoKitTag = moreSubstitutions.EXPOKIT_TAG;
  let expoKitDependencyOptions = {};
  if (expoKitPath) {
    expoKitDependencyOptions = { expoKitPath };
  } else if (expoKitTag) {
    expoKitDependencyOptions = { expoKitTag };
  }

  let versionedRnPath = moreSubstitutions.VERSIONED_REACT_NATIVE_PATH;
  if (!versionedRnPath) {
    versionedRnPath = './versioned-react-native';
  }
  let rnExpoSubspecs = moreSubstitutions.REACT_NATIVE_EXPO_SUBSPECS;
  if (!rnExpoSubspecs) {
    rnExpoSubspecs = ['Expo'];
  }

  const versionedDependencies = await _renderVersionedReactNativeDependenciesAsync(
    templatesDirectory,
    versionedRnPath,
    rnExpoSubspecs,
    shellAppSdkVersion
  );
  const versionedPostinstalls = await _renderVersionedReactNativePostinstallsAsync(
    templatesDirectory,
    shellAppSdkVersion
  );
  const podDependencies = await _renderPodDependenciesAsync(
    path.join(templatesDirectory, 'dependencies.json'),
    { isPodfile: true }
  );

  let universalModules = moreSubstitutions.UNIVERSAL_MODULES;
  if (!universalModules) {
    universalModules = [];
  }

  const substitutions = {
    EXPONENT_CLIENT_DEPS: podDependencies,
    PODFILE_UNVERSIONED_RN_DEPENDENCY: _renderUnversionedReactNativeDependency(
      rnDependencyOptions,
      sdkVersion
    ),
    PODFILE_DETACHED_POSTINSTALL: _renderDetachedPostinstall(sdkVersion, false),
    PODFILE_VERSIONED_RN_DEPENDENCIES: versionedDependencies,
    PODFILE_TEST_TARGET: shellAppSdkVersion ? '' : _renderTestTarget(reactNativePath),
    ...moreSubstitutions,
  };
  _validatePodfileSubstitutions(substitutions);

  let result = templateString;
  for (const key in substitutions) {
    if (substitutions.hasOwnProperty(key)) {
      const replacement = substitutions[key];
      result = result.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), replacement);
    }
  }

  await fs.writeFile(pathToOutput, result);
}

export { renderExpoKitPodspecAsync, renderPodfileAsync };
