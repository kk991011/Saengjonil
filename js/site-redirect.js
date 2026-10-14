// Keep previously shared GitHub Pages links working after the Hosting migration.
// Publish to GitHub Pages only after the destination has been deployed and checked.
(function () {
  if (location.hostname !== 'kk991011.github.io') return;
  var base = '/Saengjonil';
  if (location.pathname !== base && !location.pathname.startsWith(base + '/')) return;
  var appPath = location.pathname.slice(base.length) || '/';
  location.replace('https://saengjonil.web.app' + appPath + location.search + location.hash);
})();
