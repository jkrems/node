export function resolve(specifier, parentModule, defaultResolver) {
  console.dir(arguments);
  if (specifier !== 'test') {
    return defaultResolver(specifier, parentModule);
  }
  return { url: 'file://', format: 'dynamic' };
}
